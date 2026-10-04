import 'server-only';

import { getDbNowIso as nowIso } from '@/lib/db/core';
import { listActiveClientIds } from '@/lib/db/clients';
import {
    upsertRecurringJobs,
    getRecurringJobById,
    insertRecurringJobRun,
    updateRecurringJob,
    listRecurringJobsForClient,
    listRecentRecurringJobRunsForClient,
} from '@/lib/db/jobs';
import { DEFAULT_RECURRING_JOB_CONFIG } from '@/lib/continuous/constants';
import { enforceDailyCadenceMinutes, getContinuousModeLabelFr } from '@/lib/continuous/mode';

// Shared scheduling helpers for recurring definitions and the worker.
export function addMinutes(iso, minutes) {
    const base = iso ? new Date(iso) : new Date();
    return new Date(base.getTime() + minutes * 60 * 1000).toISOString();
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function getEffectiveCadenceMinutes(rawCadenceMinutes) {
    return clamp(enforceDailyCadenceMinutes(rawCadenceMinutes || 1440), 15, 10080);
}

export async function ensureDefaultRecurringJobs(clientId) {
    const rows = Object.entries(DEFAULT_RECURRING_JOB_CONFIG).map(([jobType, config], index) => ({
        client_id: clientId,
        job_type: jobType,
        cadence_minutes: getEffectiveCadenceMinutes(config.cadence_minutes),
        retry_limit: config.retry_limit,
        retry_backoff_minutes: config.retry_backoff_minutes,
        status: 'pending',
        is_active: true,
        next_run_at: addMinutes(nowIso(), 5 + index * 10),
        metadata: {
            seeded_by: 'continuous_visibility_engine',
            default_seed: true,
            mode: getContinuousModeLabelFr(),
        },
    }));

    await upsertRecurringJobs(rows);
}

export async function ensureDefaultRecurringJobsForAllClients() {
    const clientIds = await listActiveClientIds();
    for (const clientId of clientIds) {
        await ensureDefaultRecurringJobs(clientId);
    }

    return clientIds.length;
}

export async function queueRecurringRunNow(jobId, triggerSource = 'manual') {
    const job = await getRecurringJobById(jobId);

    if (job.is_active !== true) {
        throw new Error('Job is inactive. Reactivate it before running now.');
    }

    const dedupeKey = `${job.id}:manual:${String(nowIso()).slice(0, 16)}`;
    const payload = {
        job_id: job.id,
        client_id: job.client_id,
        job_type: job.job_type,
        trigger_source: triggerSource,
        status: 'pending',
        attempt_count: 0,
        max_attempts: clamp((job.retry_limit ?? 2) + 1, 1, 20),
        scheduled_for: nowIso(),
        dedupe_key: dedupeKey,
        run_context: {
            queued_by: 'manual',
        },
        result_summary: {},
    };

    const data = await insertRecurringJobRun(payload);
    await updateRecurringJob(job.id, {
        status: 'pending',
        next_run_at: nowIso(),
    });

    return data;
}

export async function setRecurringJobActive(jobId, isActive) {
    await updateRecurringJob(jobId, {
        is_active: isActive,
        status: isActive ? 'pending' : 'cancelled',
        next_run_at: isActive ? nowIso() : addMinutes(nowIso(), 525600),
    });

    return getRecurringJobById(jobId);
}

export async function updateRecurringJobCadence({ jobId, cadenceMinutes, retryLimit, retryBackoffMinutes }) {
    const effectiveCadence = getEffectiveCadenceMinutes(cadenceMinutes);
    const payload = {
        cadence_minutes: effectiveCadence,
        ...(retryLimit !== null && retryLimit !== undefined ? { retry_limit: clamp(Number(retryLimit), 0, 10) } : {}),
        ...(retryBackoffMinutes !== null && retryBackoffMinutes !== undefined
            ? { retry_backoff_minutes: clamp(Number(retryBackoffMinutes), 5, 1440) }
            : {}),
        next_run_at: nowIso(),
        status: 'pending',
    };

    await updateRecurringJob(jobId, payload);
    return getRecurringJobById(jobId);
}

export async function getRecurringJobHealthSlice(clientId) {
    // Health reads retain the historical initialization of missing definitions.
    await ensureDefaultRecurringJobs(clientId);

    const [jobs, runs] = await Promise.all([
        listRecurringJobsForClient(clientId),
        listRecentRecurringJobRunsForClient(clientId, 40),
    ]);

    const statusCounts = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
    };

    for (const row of runs || []) {
        if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) {
            statusCounts[row.status] += 1;
        }
    }

    return {
        jobs: jobs || [],
        runs: runs || [],
        summary: {
            totalJobs: (jobs || []).length,
            activeJobs: (jobs || []).filter((job) => job.is_active === true).length,
            failedJobs: (jobs || []).filter((job) => job.status === 'failed').length,
            statusCounts,
        },
    };
}
