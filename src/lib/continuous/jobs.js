import 'server-only';

import { getDbNowIso as nowIso } from '@/lib/db/core';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import {
    listDueRecurringJobs,
    countQueuedOrRunningRunsForJob,
    insertRecurringJobRun,
    updateRecurringJob,
    listStaleRunningRuns,
    getRecurringJobsByIds,
    requeueStaleRun,
    failRun,
    listRunnablePendingRuns as listRunnablePendingRunsFromDb,
    getRecurringJobById,
    cancelPendingRun,
    countOverlappingRunningRuns,
    countRunningRunsForJobTypes,
    deferRunForOverlap,
    deferRunForFamilyLock,
    claimPendingRun,
    markJobRunning as markJobRunningInDb,
    releaseJobLock as releaseJobLockInDb,
    completeRun,
    requeueRun,
} from '@/lib/db/jobs';
import {
    addMinutes,
    clamp,
    getEffectiveCadenceMinutes,
    ensureDefaultRecurringJobsForAllClients,
} from '@/lib/continuous/recurring-jobs';
import { upsertVisibilitySnapshotForClient } from '@/lib/continuous/snapshots';
import { cronDispatchOptionsSchema, cronWorkerOptionsSchema } from '@/lib/continuous/schemas';
import { runFullAudit } from '@/lib/audit/run-audit';
import { runTrackedQueriesForClient } from '@/lib/queries/run-tracked-queries';
import { runGscSyncForClient } from '@/lib/seo/gsc-sync';
import { runGa4SyncForClient } from '@/lib/seo/ga4-sync';
import { runCommunityPipeline } from '@/lib/agent-reach/pipeline';
import { sendSlackAlert } from '@/lib/ops/alerts';

async function queueDueJobs({ maxJobsToQueue, source }) {
    const now = nowIso();
    const jobs = await listDueRecurringJobs({
        nowIso: now,
        limit: maxJobsToQueue,
    });

    let queued = 0;
    let skipped = 0;

    for (const job of jobs || []) {
        const existingQueuedOrRunning = await countQueuedOrRunningRunsForJob(job.id);

        if ((existingQueuedOrRunning || 0) > 0) {
            skipped += 1;
            continue;
        }

        const scheduledFor = job.next_run_at || now;
        const dedupeKey = `${job.id}:${String(scheduledFor).slice(0, 16)}`;

        const runInsertPayload = {
            job_id: job.id,
            client_id: job.client_id,
            job_type: job.job_type,
            trigger_source: source,
            status: 'pending',
            attempt_count: 0,
            max_attempts: clamp((job.retry_limit ?? 2) + 1, 1, 20),
            scheduled_for: scheduledFor,
            dedupe_key: dedupeKey,
            run_context: {
                queued_by: 'cron_dispatch',
                queued_at: now,
            },
            result_summary: {},
        };

        try {
            await insertRecurringJobRun(runInsertPayload);
        } catch (insertError) {
            const alreadyQueued = String(insertError?.code || '') === '23505';
            if (alreadyQueued) {
                skipped += 1;
                continue;
            }
            throw new Error(`[Continuous] queueDueJobs insert run: ${insertError?.message || 'unknown insert error'}`);
        }

        await updateRecurringJob(job.id, {
            status: 'pending',
            updated_at: now,
        });

        queued += 1;
    }

    return {
        dueJobs: (jobs || []).length,
        queued,
        skipped,
    };
}

async function recoverStaleRunningRuns() {
    const staleBefore = addMinutes(nowIso(), -45);
    const staleRuns = await listStaleRunningRuns({ staleBeforeIso: staleBefore, limit: 40 });

    if (!staleRuns || staleRuns.length === 0) {
        return { recovered: 0, failed: 0 };
    }

    const jobIds = [...new Set(staleRuns.map((row) => row.job_id).filter(Boolean))];
    const jobRows = await getRecurringJobsByIds(jobIds);

    const jobsById = new Map((jobRows || []).map((row) => [row.id, row]));

    let recovered = 0;
    let failed = 0;

    for (const run of staleRuns) {
        const job = jobsById.get(run.job_id);
        const backoff = clamp(Number(job?.retry_backoff_minutes || 30), 5, 1440);
        const shouldRetry = Number(run.attempt_count || 0) < Number(run.max_attempts || 1);

        if (shouldRetry) {
            const nextRetryAt = addMinutes(nowIso(), backoff);

            try {
                await requeueStaleRun(run.id, {
                    scheduledFor: nextRetryAt,
                    errorMessage: 'Recovered stale running run after timeout. Retry queued automatically.',
                });
                recovered += 1;
                await updateRecurringJob(run.job_id, {
                    status: 'pending',
                    last_failure_at: nowIso(),
                    next_run_at: nextRetryAt,
                });
            } catch {
                // best effort for stale recovery
            }
            continue;
        }

        try {
            await failRun(run.id, {
                finishedAt: nowIso(),
                errorMessage: 'Run timed out and exceeded retry budget.',
            });
            failed += 1;
            await updateRecurringJob(run.job_id, {
                status: 'failed',
                last_failure_at: nowIso(),
                last_run_at: nowIso(),
                next_run_at: addMinutes(nowIso(), getEffectiveCadenceMinutes(job?.cadence_minutes || 1440)),
            });
        } catch {
            // best effort for stale recovery
        }
    }

    return { recovered, failed };
}

async function listRunnablePendingRuns(limit = 8) {
    return listRunnablePendingRunsFromDb({ nowIso: nowIso(), limit });
}
async function markJobRunning(job, lockToken) {
    await markJobRunningInDb(job.id, {
        lockToken,
        lockMinutes: 25,
    });
}

async function releaseJobLock({ job, status, nextRunAt, failureAt = null, successAt = null }) {
    const payload = {
        status,
        lock_token: null,
        locked_until: null,
        last_run_at: nowIso(),
        next_run_at: nextRunAt,
    };

    if (failureAt) payload.last_failure_at = failureAt;
    if (successAt) payload.last_success_at = successAt;

    await releaseJobLockInDb(job.id, payload);
}

const CONFLICTING_JOB_FAMILY_POLICIES = Object.freeze({
    prompt_run: Object.freeze({
        jobTypes: ['prompt_rerun'],
        maxRunningGlobal: 1,
        deferMinutes: 3,
    }),
});

const JOB_TYPE_TO_FAMILY = Object.freeze({
    prompt_rerun: 'prompt_run',
});

function getJobFamilyPolicy(jobType) {
    const family = JOB_TYPE_TO_FAMILY[jobType];
    if (!family) return null;
    const policy = CONFLICTING_JOB_FAMILY_POLICIES[family];
    if (!policy) return null;
    return { family, ...policy };
}

async function claimRun(run) {
    const otherRunningCount = await countOverlappingRunningRuns({
        clientId: run.client_id,
        jobType: run.job_type,
        excludeRunId: run.id,
    });

    if ((otherRunningCount || 0) > 0) {
        await deferRunForOverlap(run.id);
        return { claimed: false, reason: 'overlap' };
    }

    const familyPolicy = getJobFamilyPolicy(run.job_type);
    if (familyPolicy) {
        try {
            const familyRunningCount = await countRunningRunsForJobTypes({
                jobTypes: familyPolicy.jobTypes,
                excludeRunId: run.id,
            });

            if (familyRunningCount >= familyPolicy.maxRunningGlobal) {
                try {
                    await deferRunForFamilyLock(run.id, {
                        family: familyPolicy.family,
                        deferMinutes: familyPolicy.deferMinutes,
                    });
                    return { claimed: false, reason: 'family_lock', family: familyPolicy.family };
                } catch (deferError) {
                    console.warn('[Continuous] family_lock_defer_failed_preclaim', {
                        run_id: run.id,
                        client_id: run.client_id,
                        job_type: run.job_type,
                        family: familyPolicy.family,
                        error: deferError?.message || 'unknown_error',
                    });
                    await deferRunForOverlap(run.id);
                    return { claimed: false, reason: 'overlap' };
                }
            }
        } catch (familyCheckError) {
            // Keep worker ticks alive when global-family lock checks are unavailable
            // (for example during schema drift before migrations are applied).
            console.warn('[Continuous] family_lock_check_unavailable', {
                run_id: run.id,
                client_id: run.client_id,
                job_type: run.job_type,
                family: familyPolicy.family,
                error: familyCheckError?.message || 'unknown_error',
            });
        }
    }

    const nextAttempt = Number(run.attempt_count || 0) + 1;
    const claimResult = await claimPendingRun(run.id, nextAttempt);

    if (claimResult.conflict) {
        if (familyPolicy) {
            try {
                await deferRunForFamilyLock(run.id, {
                    family: familyPolicy.family,
                    deferMinutes: familyPolicy.deferMinutes,
                });
                return { claimed: false, reason: 'family_lock', family: familyPolicy.family };
            } catch (deferError) {
                console.warn('[Continuous] family_lock_defer_failed_conflict', {
                    run_id: run.id,
                    client_id: run.client_id,
                    job_type: run.job_type,
                    family: familyPolicy.family,
                    error: deferError?.message || 'unknown_error',
                });
            }
        }

        await deferRunForOverlap(run.id);
        return { claimed: false, reason: 'overlap' };
    }

    if (!claimResult.data) {
        return { claimed: false, reason: 'already_claimed' };
    }

    return { claimed: true, run: claimResult.data };
}

async function executeAuditRefresh(jobRun) {
    const client = await dbGetClientById(jobRun.client_id);
    if (!client?.website_url) {
        return {
            success: false,
            error: 'Client website URL is missing for scheduled audit refresh.',
            summary: {
                audit_id: null,
                seo_score: null,
                geo_score: null,
            },
        };
    }

    const result = await runFullAudit(client.id, client.website_url);

    return {
        success: result.success === true,
        error: result.success === true ? null : result.error || 'Audit refresh failed',
        summary: {
            audit_id: result.auditId || null,
            seo_score: result.seo_score ?? null,
            geo_score: result.geo_score ?? null,
            opportunities_count: result.opportunitiesCount ?? null,
            merge_suggestions_count: result.mergeSuggestionsCount ?? null,
        },
    };
}

async function executePromptRerun(jobRun) {
    const result = await runTrackedQueriesForClient({
        clientId: jobRun.client_id,
        trackedQueryId: null,
        performedBy: 'system@cron',
        actionTypeOverride: 'geo_queries_run_scheduled',
    });

    const successful = (result.runs || []).filter((run) => !run.error).length;
    const failed = (result.runs || []).filter((run) => run.error).length;

    if ((result.totalQueries || 0) === 0) {
        return {
            success: false,
            error: result.message || 'No active tracked prompts are available.',
            summary: {
                total_queries: 0,
                successful: 0,
                failed: 0,
            },
        };
    }

    return {
        success: failed === 0,
        error: failed === 0 ? null : `Prompt rerun completed with ${failed} failed query(ies).`,
        summary: {
            total_queries: result.totalQueries || 0,
            successful,
            failed,
        },
    };
}

async function executeRunByType(run) {
    switch (run.job_type) {
        case 'audit_refresh':
            return executeAuditRefresh(run);
        case 'prompt_rerun':
            return executePromptRerun(run);
        case 'gsc_sync_daily': {
            const result = await runGscSyncForClient(run.client_id);
            return {
                success: true,
                error: null,
                summary: {
                    fetched_rows: result.fetchedRows || 0,
                    synced_rows: result.syncedRows || 0,
                    skipped: result.skipped === true,
                    reason: result.reason || null,
                    site_url: result.siteUrl || null,
                },
            };
        }
        case 'ga4_sync_daily': {
            const result = await runGa4SyncForClient(run.client_id);
            return {
                success: true,
                error: null,
                summary: {
                    fetched_traffic_rows: result.fetchedTrafficRows || 0,
                    synced_traffic_rows: result.syncedTrafficRows || 0,
                    fetched_page_rows: result.fetchedPageRows || 0,
                    synced_page_rows: result.syncedPageRows || 0,
                    skipped: result.skipped === true,
                    reason: result.reason || null,
                    property_id: result.propertyId || null,
                },
            };
        }
        case 'community_sync': {
            const result = await runCommunityPipeline(run.client_id, { triggerSource: 'cron' });
            return {
                success: result.success,
                error: result.error || null,
                summary: result.summary || {},
            };
        }
        default:
            return {
                success: false,
                error: `Unsupported job type: ${run.job_type}`,
                summary: {},
            };
    }
}
async function finalizeRunSuccess({ run, job, summary }) {
    const now = nowIso();

    await completeRun(run.id, {
        finishedAt: now,
        summary: summary || {},
    });

    const nextRunAt = addMinutes(now, getEffectiveCadenceMinutes(job.cadence_minutes || 1440));
    await releaseJobLock({
        job,
        status: 'completed',
        nextRunAt,
        successAt: now,
    });

    await upsertVisibilitySnapshotForClient({
        clientId: run.client_id,
        source: 'cron',
        sourceJobRunId: run.id,
        metadata: {
            reason: 'job_success',
            job_type: run.job_type,
            run_id: run.id,
        },
    });
}

async function finalizeRunFailure({ run, job, errorMessage, summary }) {
    const now = nowIso();
    const backoffMinutes = clamp(Number(job.retry_backoff_minutes || 30), 5, 1440);

    const hasRetryBudget = Number(run.attempt_count || 0) < Number(run.max_attempts || 1);

    if (hasRetryBudget) {
        const nextAttemptAt = addMinutes(now, backoffMinutes);
        await requeueRun(run.id, {
            scheduledFor: nextAttemptAt,
            errorMessage,
            summary: summary || {},
        });

        await releaseJobLock({
            job,
            status: 'pending',
            nextRunAt: nextAttemptAt,
            failureAt: now,
        });

        console.warn('[Continuous] run_retry_scheduled', {
            run_id: run.id,
            client_id: run.client_id,
            job_type: run.job_type,
            attempt_count: run.attempt_count,
            max_attempts: run.max_attempts,
            next_attempt_at: nextAttemptAt,
        });

        return { retried: true };
    }

    await failRun(run.id, {
        finishedAt: now,
        errorMessage,
        resultSummary: summary || {},
    });

    const nextRunAt = addMinutes(now, getEffectiveCadenceMinutes(job.cadence_minutes || 1440));
    await releaseJobLock({
        job,
        status: 'failed',
        nextRunAt,
        failureAt: now,
    });

    console.error('[Continuous] run_final_failure', {
        run_id: run.id,
        client_id: run.client_id,
        job_type: run.job_type,
        attempt_count: run.attempt_count,
        max_attempts: run.max_attempts,
        error_message: errorMessage,
    });

    sendSlackAlert({
        type: run.job_type || 'unknown_job_type',
        clientId: run.client_id,
        runId: run.id,
        errorMessage,
    }).catch((alertError) => {
        console.error('[Continuous] Slack alert failed:', alertError?.message || alertError);
    });

    return { retried: false };
}

export async function processContinuousTick(rawOptions = {}) {
    const options = cronDispatchOptionsSchema.parse(rawOptions);
    const tickStartMs = Date.now();
    const summary = {
        startedAt: nowIso(),
        source: options.source,
        mode: 'dispatch_enqueue_only',
        seededJobsForClients: 0,
        staleRecovered: { recovered: 0, failed: 0 },
        queue: { dueJobs: 0, queued: 0, skipped: 0 },
        errors: [],
    };

    try {
        summary.seededJobsForClients = await ensureDefaultRecurringJobsForAllClients();
        summary.staleRecovered = await recoverStaleRunningRuns();
        summary.queue = await queueDueJobs({
            maxJobsToQueue: options.maxJobsToQueue,
            source: options.source,
        });
    } catch (error) {
        summary.errors.push(error?.message || 'dispatch_failed');
        throw error;
    } finally {
        summary.finishedAt = nowIso();
        summary.durationMs = Date.now() - tickStartMs;
    }

    return summary;
}

const MAX_PARALLEL_RUNS = 4;
const MAX_RUNS_PER_TICK_HARD_LIMIT = 24;
const RUN_EXECUTION_TIMEOUT_MS = 8 * 60 * 1000;

async function withRunTimeout(runId, promise, timeoutMs = RUN_EXECUTION_TIMEOUT_MS) {
    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(`Run ${runId} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }
}

async function processSingleWorkerRun(runnable) {
    const job = await getRecurringJobById(runnable.job_id);
    if (!job) {
        throw new Error(`Job not found for run ${runnable.id}`);
    }

    if (job.is_active !== true || job.status === 'cancelled') {
        await cancelPendingRun(runnable.id, 'Job is inactive or cancelled.');
        return {
            status: 'cancelled',
            runId: runnable.id,
            jobType: runnable.job_type,
        };
    }

    const claimed = await claimRun(runnable);
    if (!claimed.claimed) {
        if (claimed.reason === 'family_lock') {
            console.warn('[Continuous] run_deferred_family_lock', {
                run_id: runnable.id,
                client_id: runnable.client_id,
                job_type: runnable.job_type,
                family: claimed.family || 'unknown_family',
            });
        }

        return {
            status:
                claimed.reason === 'overlap'
                    ? 'skipped_overlap'
                    : claimed.reason === 'family_lock'
                      ? 'skipped_family_lock'
                      : 'skipped_claimed',
            runId: runnable.id,
            jobType: runnable.job_type,
        };
    }

    const lockToken = `${claimed.run.id}:${Date.now()}`;
    await markJobRunning(job, lockToken);

    try {
        const execution = await withRunTimeout(claimed.run.id, executeRunByType(claimed.run), RUN_EXECUTION_TIMEOUT_MS);

        if (execution.success) {
            await finalizeRunSuccess({
                run: claimed.run,
                job,
                summary: execution.summary,
            });

            return {
                status: 'completed',
                runId: claimed.run.id,
                jobType: claimed.run.job_type,
            };
        }

        const failure = await finalizeRunFailure({
            run: claimed.run,
            job,
            errorMessage: execution.error || 'Job execution failed',
            summary: execution.summary,
        });

        return {
            status: failure.retried ? 'retried' : 'failed',
            runId: claimed.run.id,
            jobType: claimed.run.job_type,
        };
    } catch (runError) {
        const failure = await finalizeRunFailure({
            run: claimed.run,
            job,
            errorMessage: runError?.message || 'Job execution failed unexpectedly',
            summary: {},
        });

        return {
            status: failure.retried ? 'retried' : 'failed',
            runId: claimed.run.id,
            jobType: claimed.run.job_type,
        };
    }
}

export async function processContinuousWorkerTick(rawOptions = {}) {
    const options = cronWorkerOptionsSchema.parse(rawOptions);
    const tickStartMs = Date.now();
    const summary = {
        startedAt: nowIso(),
        source: options.source,
        mode: 'worker_execute_runs',
        maxParallelRuns: MAX_PARALLEL_RUNS,
        maxRunsPerTick: Math.min(options.maxRunsToExecute, MAX_RUNS_PER_TICK_HARD_LIMIT),
        runnable: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        retried: 0,
        skippedOverlap: 0,
        skippedFamilyLock: 0,
        errors: [],
    };

    const runnableRuns = await listRunnablePendingRuns(summary.maxRunsPerTick);
    summary.runnable = runnableRuns.length;

    for (let index = 0; index < runnableRuns.length; index += MAX_PARALLEL_RUNS) {
        const batch = runnableRuns.slice(index, index + MAX_PARALLEL_RUNS);
        const settled = await Promise.allSettled(batch.map((run) => processSingleWorkerRun(run)));

        for (const result of settled) {
            if (result.status === 'rejected') {
                summary.failed += 1;
                summary.errors.push(result.reason?.message || 'run_execution_failed');
                console.error('[Continuous] processContinuousWorkerTick run error:', result.reason);
                continue;
            }

            const outcome = result.value;
            if (outcome.status === 'completed') {
                summary.processed += 1;
                summary.completed += 1;
                continue;
            }
            if (outcome.status === 'retried') {
                summary.processed += 1;
                summary.retried += 1;
                continue;
            }
            if (outcome.status === 'failed') {
                summary.processed += 1;
                summary.failed += 1;
                continue;
            }
            if (outcome.status === 'skipped_overlap') {
                summary.skippedOverlap += 1;
            }
            if (outcome.status === 'skipped_family_lock') {
                summary.skippedFamilyLock += 1;
            }
        }
    }

    summary.finishedAt = nowIso();
    summary.durationMs = Date.now() - tickStartMs;

    return summary;
}
