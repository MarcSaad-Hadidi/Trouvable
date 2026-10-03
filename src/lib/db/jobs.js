import 'server-only';

import { db, getDbNowIso } from '@/lib/db/core';

function addMinutes(iso, minutes) {
    const base = iso ? new Date(iso) : new Date();
    return new Date(base.getTime() + (minutes * 60 * 1000)).toISOString();
}

export async function upsertRecurringJobs(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const { error } = await db().from('recurring_jobs').upsert(rows, { onConflict: 'client_id,job_type', ignoreDuplicates: true });
    if (error) throw new Error(`[DB/jobs] upsertRecurringJobs: ${error.message}`);
}

export async function listDueRecurringJobs({ nowIso = getDbNowIso(), limit = 24 }) {
    const { data, error } = await db()
        .from('recurring_jobs')
        .select('*')
        .eq('is_active', true)
        .neq('status', 'cancelled')
        .lte('next_run_at', nowIso)
        .order('next_run_at', { ascending: true })
        .limit(limit);

    if (error) throw new Error(`[DB/jobs] listDueRecurringJobs: ${error.message}`);
    return data || [];
}

export async function countQueuedOrRunningRunsForJob(jobId) {
    const { count, error } = await db()
        .from('recurring_job_runs')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .in('status', ['pending', 'running']);

    if (error) throw new Error(`[DB/jobs] countQueuedOrRunningRunsForJob ${jobId}: ${error.message}`);
    return Number(count || 0);
}

export async function insertRecurringJobRun(payload) {
    const { data, error } = await db().from('recurring_job_runs').insert(payload).select('*').maybeSingle();
    if (error) throw error;
    return data || null;
}

export async function updateRecurringJob(jobId, updates) {
    const { error } = await db().from('recurring_jobs').update(updates).eq('id', jobId);
    if (error) throw new Error(`[DB/jobs] updateRecurringJob ${jobId}: ${error.message}`);
}

export async function listStaleRunningRuns({ staleBeforeIso, limit = 40 }) {
    const { data, error } = await db()
        .from('recurring_job_runs')
        .select('*')
        .eq('status', 'running')
        .lte('started_at', staleBeforeIso)
        .order('started_at', { ascending: true })
        .limit(limit);

    if (error) throw new Error(`[DB/jobs] listStaleRunningRuns: ${error.message}`);
    return data || [];
}

export async function getRecurringJobsByIds(jobIds) {
    if (!Array.isArray(jobIds) || jobIds.length === 0) return [];
    const { data, error } = await db().from('recurring_jobs').select('*').in('id', jobIds);
    if (error) throw new Error(`[DB/jobs] getRecurringJobsByIds: ${error.message}`);
    return data || [];
}

export async function requeueStaleRun(runId, { scheduledFor, errorMessage }) {
    const { error } = await db()
        .from('recurring_job_runs')
        .update({
            status: 'pending',
            scheduled_for: scheduledFor,
            error_message: errorMessage,
            started_at: null,
        })
        .eq('id', runId)
        .eq('status', 'running');

    if (error) throw new Error(`[DB/jobs] requeueStaleRun ${runId}: ${error.message}`);
}

export async function failRun(runId, { errorMessage, finishedAt = getDbNowIso(), resultSummary = null }) {
    const payload = {
        status: 'failed',
        finished_at: finishedAt,
        error_message: errorMessage,
    };

    if (resultSummary !== null) payload.result_summary = resultSummary;

    const { error } = await db().from('recurring_job_runs').update(payload).eq('id', runId).eq('status', 'running');
    if (error) throw new Error(`[DB/jobs] failRun ${runId}: ${error.message}`);
}

export async function listRunnablePendingRuns({ nowIso = getDbNowIso(), limit = 8 }) {
    const { data, error } = await db()
        .from('recurring_job_runs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', nowIso)
        .order('scheduled_for', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) throw new Error(`[DB/jobs] listRunnablePendingRuns: ${error.message}`);
    return data || [];
}

export async function getRecurringJobById(jobId) {
    const { data, error } = await db().from('recurring_jobs').select('*').eq('id', jobId).single();
    if (error) throw new Error(`[DB/jobs] getRecurringJobById ${jobId}: ${error.message}`);
    return data;
}

export async function listRecurringJobsForClient(clientId) {
    const { data, error } = await db()
        .from('recurring_jobs')
        .select('*')
        .eq('client_id', clientId)
        .order('job_type', { ascending: true });

    if (error) throw new Error(`[DB/jobs] listRecurringJobsForClient ${clientId}: ${error.message}`);
    return data || [];
}

export async function listRecentRecurringJobRunsForClient(clientId, limit = 40) {
    const { data, error } = await db()
        .from('recurring_job_runs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`[DB/jobs] listRecentRecurringJobRunsForClient ${clientId}: ${error.message}`);
    return data || [];
}

export async function cancelPendingRun(runId, reason) {
    const { error } = await db()
        .from('recurring_job_runs')
        .update({
            status: 'cancelled',
            cancelled_at: getDbNowIso(),
            error_message: reason,
        })
        .eq('id', runId)
        .eq('status', 'pending');

    if (error) throw new Error(`[DB/jobs] cancelPendingRun ${runId}: ${error.message}`);
}

export async function countOverlappingRunningRuns({ clientId, jobType, excludeRunId }) {
    const { count, error } = await db()
        .from('recurring_job_runs')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('job_type', jobType)
        .eq('status', 'running')
        .neq('id', excludeRunId);

    if (error) throw new Error(`[DB/jobs] countOverlappingRunningRuns: ${error.message}`);
    return Number(count || 0);
}

export async function countRunningRunsForJobTypes({ jobTypes, excludeRunId = null }) {
    if (!Array.isArray(jobTypes) || jobTypes.length === 0) return 0;

    let query = db()
        .from('recurring_job_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running')
        .in('job_type', jobTypes);

    if (excludeRunId) {
        query = query.neq('id', excludeRunId);
    }

    const { count, error } = await query;
    if (error) throw new Error(`[DB/jobs] countRunningRunsForJobTypes: ${error.message}`);
    return Number(count || 0);
}

async function deferPendingRun(runId, { deferMinutes = 5, message }) {
    const { error } = await db()
        .from('recurring_job_runs')
        .update({
            scheduled_for: addMinutes(getDbNowIso(), deferMinutes),
            error_message: message,
        })
        .eq('id', runId)
        .eq('status', 'pending');

    if (error) throw new Error(`[DB/jobs] deferPendingRun ${runId}: ${error.message}`);
}

export async function deferRunForOverlap(runId) {
    await deferPendingRun(runId, {
        deferMinutes: 5,
        message: 'Deferred to prevent overlap for same client/job_type.',
    });
}

export async function deferRunForFamilyLock(runId, { family, deferMinutes = 3 }) {
    const familyLabel = String(family || 'unknown_family').trim();
    await deferPendingRun(runId, {
        deferMinutes,
        message: `Deferred because job family lock "${familyLabel}" is currently held by another run.`,
    });
}

export async function claimPendingRun(runId, nextAttempt) {
    let data = null;
    let error = null;

    try {
        const result = await db()
            .from('recurring_job_runs')
            .update({
                status: 'running',
                attempt_count: nextAttempt,
                started_at: getDbNowIso(),
                error_message: null,
            })
            .eq('id', runId)
            .eq('status', 'pending')
            .select('*')
            .maybeSingle();
        data = result.data;
        error = result.error;
    } catch (thrownError) {
        error = thrownError;
    }

    if (error) {
        const conflictSignature = [
            error?.code,
            error?.message,
            error?.details,
            error?.hint,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        const uniqueViolation = conflictSignature.includes('23505')
            || conflictSignature.includes('duplicate key value')
            || conflictSignature.includes('unique constraint');
        if (uniqueViolation) {
            return { data: null, conflict: true };
        }
        throw new Error(`[DB/jobs] claimPendingRun ${runId}: ${error.message}`);
    }

    return { data: data || null, conflict: false };
}

export async function markJobRunning(jobId, { lockToken, lockMinutes = 25 }) {
    const { error } = await db()
        .from('recurring_jobs')
        .update({
            status: 'running',
            lock_token: lockToken,
            locked_until: addMinutes(getDbNowIso(), lockMinutes),
        })
        .eq('id', jobId)
        .eq('is_active', true);

    if (error) throw new Error(`[DB/jobs] markJobRunning ${jobId}: ${error.message}`);
}

export async function releaseJobLock(jobId, payload) {
    const { error } = await db().from('recurring_jobs').update(payload).eq('id', jobId);
    if (error) throw new Error(`[DB/jobs] releaseJobLock ${jobId}: ${error.message}`);
}

export async function completeRun(runId, { finishedAt = getDbNowIso(), summary = {} }) {
    const { error } = await db()
        .from('recurring_job_runs')
        .update({
            status: 'completed',
            finished_at: finishedAt,
            error_message: null,
            result_summary: summary,
        })
        .eq('id', runId)
        .eq('status', 'running');

    if (error) throw new Error(`[DB/jobs] completeRun ${runId}: ${error.message}`);
}

export async function requeueRun(runId, { scheduledFor, errorMessage, summary = {} }) {
    const { error } = await db()
        .from('recurring_job_runs')
        .update({
            status: 'pending',
            scheduled_for: scheduledFor,
            started_at: null,
            error_message: errorMessage,
            result_summary: summary,
        })
        .eq('id', runId)
        .eq('status', 'running');

    if (error) throw new Error(`[DB/jobs] requeueRun ${runId}: ${error.message}`);
}

export async function listRecentRunsForEngineStats(limit = 80) {
    const { data, error } = await db()
        .from('recurring_job_runs')
        .select('id, client_id, job_type, status, created_at, started_at, finished_at, attempt_count, max_attempts, error_message')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`[DB/jobs] listRecentRunsForEngineStats: ${error.message}`);
    return data || [];
}
