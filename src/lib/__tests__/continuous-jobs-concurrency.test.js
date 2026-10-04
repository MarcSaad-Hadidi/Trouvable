import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getClientById: vi.fn(async (clientId) => ({
        id: clientId,
        website_url: 'https://example.com',
    })),
    listActiveClientIds: vi.fn(async () => []),
    upsertRecurringJobs: vi.fn(async () => {}),
    listDueRecurringJobs: vi.fn(async () => []),
    countQueuedOrRunningRunsForJob: vi.fn(async () => 0),
    insertRecurringJobRun: vi.fn(async () => null),
    updateRecurringJob: vi.fn(async () => {}),
    listStaleRunningRuns: vi.fn(async () => []),
    getRecurringJobsByIds: vi.fn(async () => []),
    listRecurringJobsForClient: vi.fn(async () => []),
    listRecentRecurringJobRunsForClient: vi.fn(async () => []),
    requeueStaleRun: vi.fn(async () => {}),
    failRun: vi.fn(async () => {}),
    listRunnablePendingRuns: vi.fn(async () => []),
    getRecurringJobById: vi.fn(async (jobId) => ({
        id: jobId,
        client_id: 'client-a',
        is_active: true,
        status: 'pending',
        cadence_minutes: 1440,
        retry_backoff_minutes: 20,
    })),
    cancelPendingRun: vi.fn(async () => {}),
    countOverlappingRunningRuns: vi.fn(async () => 0),
    countRunningRunsForJobTypes: vi.fn(async () => 0),
    deferRunForOverlap: vi.fn(async () => {}),
    deferRunForFamilyLock: vi.fn(async () => {}),
    claimPendingRun: vi.fn(async (runId, nextAttempt) => ({
        data: {
            id: runId,
            job_id: 'job-a',
            client_id: 'client-a',
            job_type: 'prompt_rerun',
            attempt_count: nextAttempt,
            max_attempts: 3,
        },
        conflict: false,
    })),
    markJobRunning: vi.fn(async () => {}),
    releaseJobLock: vi.fn(async () => {}),
    completeRun: vi.fn(async () => {}),
    requeueRun: vi.fn(async () => {}),
    listRecentRunsForEngineStats: vi.fn(async () => []),
    upsertVisibilityMetricSnapshot: vi.fn(async () => ({})),
    listVisibilityMetricSnapshots: vi.fn(async () => []),
    flattenSnapshotToLegacy: vi.fn(() => ({
        trackedPromptStats: {},
    })),
    getGeoWorkspaceSnapshot: vi.fn(async () => ({
        snapshot: {},
        latestAudit: null,
        modelPerformance: {},
    })),
    getConnectorOverviewForClient: vi.fn(async () => ({
        connections: [],
        providers: {},
        summary: {},
    })),
    runFullAudit: vi.fn(async () => ({
        success: true,
        auditId: 'audit-1',
        seo_score: 70,
        geo_score: 66,
        opportunitiesCount: 0,
        mergeSuggestionsCount: 0,
    })),
    runTrackedQueriesForClient: vi.fn(async () => ({
        totalQueries: 1,
        runs: [{ error: null }],
    })),
    runGscSyncForClient: vi.fn(async () => ({
        fetchedRows: 0,
        syncedRows: 0,
        skipped: false,
        reason: null,
        siteUrl: 'https://example.com',
    })),
    runGa4SyncForClient: vi.fn(async () => ({
        fetchedTrafficRows: 1,
        syncedTrafficRows: 1,
        fetchedPageRows: 1,
        syncedPageRows: 1,
        skipped: false,
        reason: null,
        propertyId: 'prop-1',
    })),
    runCommunityPipeline: vi.fn(async () => ({
        success: true,
        error: null,
        summary: {},
    })),
    sendSlackAlert: vi.fn(async () => {}),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/clients', () => ({
    getClientById: mocks.getClientById,
    listActiveClientIds: mocks.listActiveClientIds,
}));

vi.mock('@/lib/db/jobs', () => ({
    upsertRecurringJobs: mocks.upsertRecurringJobs,
    listDueRecurringJobs: mocks.listDueRecurringJobs,
    countQueuedOrRunningRunsForJob: mocks.countQueuedOrRunningRunsForJob,
    insertRecurringJobRun: mocks.insertRecurringJobRun,
    updateRecurringJob: mocks.updateRecurringJob,
    listStaleRunningRuns: mocks.listStaleRunningRuns,
    getRecurringJobsByIds: mocks.getRecurringJobsByIds,
    listRecurringJobsForClient: mocks.listRecurringJobsForClient,
    listRecentRecurringJobRunsForClient: mocks.listRecentRecurringJobRunsForClient,
    requeueStaleRun: mocks.requeueStaleRun,
    failRun: mocks.failRun,
    listRunnablePendingRuns: mocks.listRunnablePendingRuns,
    getRecurringJobById: mocks.getRecurringJobById,
    cancelPendingRun: mocks.cancelPendingRun,
    countOverlappingRunningRuns: mocks.countOverlappingRunningRuns,
    countRunningRunsForJobTypes: mocks.countRunningRunsForJobTypes,
    deferRunForOverlap: mocks.deferRunForOverlap,
    deferRunForFamilyLock: mocks.deferRunForFamilyLock,
    claimPendingRun: mocks.claimPendingRun,
    markJobRunning: mocks.markJobRunning,
    releaseJobLock: mocks.releaseJobLock,
    completeRun: mocks.completeRun,
    requeueRun: mocks.requeueRun,
    listRecentRunsForEngineStats: mocks.listRecentRunsForEngineStats,
}));

vi.mock('@/lib/db/snapshots', () => ({
    upsertVisibilityMetricSnapshot: mocks.upsertVisibilityMetricSnapshot,
    listVisibilityMetricSnapshots: mocks.listVisibilityMetricSnapshots,
}));

vi.mock('@/lib/operator-intelligence/kpi-core', () => ({
    flattenSnapshotToLegacy: mocks.flattenSnapshotToLegacy,
}));

vi.mock('@/lib/operator-intelligence/snapshot', () => ({
    getGeoWorkspaceSnapshot: mocks.getGeoWorkspaceSnapshot,
}));

vi.mock('@/lib/connectors', () => ({
    getConnectorOverviewForClient: mocks.getConnectorOverviewForClient,
}));

vi.mock('@/lib/audit/run-audit', () => ({
    runFullAudit: mocks.runFullAudit,
}));

vi.mock('@/lib/queries/run-tracked-queries', () => ({
    runTrackedQueriesForClient: mocks.runTrackedQueriesForClient,
}));

vi.mock('@/lib/seo/gsc-sync', () => ({
    runGscSyncForClient: mocks.runGscSyncForClient,
}));

vi.mock('@/lib/seo/ga4-sync', () => ({
    runGa4SyncForClient: mocks.runGa4SyncForClient,
}));

vi.mock('@/lib/agent-reach/pipeline', () => ({
    runCommunityPipeline: mocks.runCommunityPipeline,
}));

vi.mock('@/lib/ops/alerts', () => ({
    sendSlackAlert: mocks.sendSlackAlert,
}));

vi.mock('@/lib/continuous/mode', () => ({
    enforceDailyCadenceMinutes: (value) => Number(value || 1440),
    getContinuousModeLabelFr: () => 'quotidien_hobby',
    isDailyFirstMode: () => true,
}));

vi.mock('@/lib/continuous/metrics-core', () => ({
    buildMetricTrendSummary: () => ({ latest: null, previous: null, delta: null }),
    classifyFreshness: () => ({ state: 'fresh', hours: 1 }),
    splitImprovingDeclining: () => ({ improving: [], declining: [] }),
}));

vi.mock('@/lib/continuous/schemas', () => ({
    cronDispatchOptionsSchema: {
        parse: (raw = {}) => ({
            maxJobsToQueue: raw.maxJobsToQueue ?? 24,
            source: raw.source ?? 'cron',
        }),
    },
    cronWorkerOptionsSchema: {
        parse: (raw = {}) => ({
            maxRunsToExecute: raw.maxRunsToExecute ?? 8,
            source: raw.source ?? 'cron',
        }),
    },
}));

import {
    processContinuousTick,
    processContinuousWorkerTick,
    upsertVisibilitySnapshotForClient,
} from '@/lib/continuous/jobs';

function makeRun({ id, jobId, clientId, jobType, attemptCount = 0, maxAttempts = 3 }) {
    return {
        id,
        job_id: jobId,
        client_id: clientId,
        job_type: jobType,
        status: 'pending',
        attempt_count: attemptCount,
        max_attempts: maxAttempts,
        scheduled_for: '2026-04-18T09:00:00.000Z',
        created_at: '2026-04-18T08:00:00.000Z',
    };
}

function setClaimMockFromRuns(runsById, conflictRunIds = new Set()) {
    mocks.claimPendingRun.mockImplementation(async (runId, nextAttempt) => {
        if (conflictRunIds.has(runId)) {
            return { data: null, conflict: true };
        }

        const base = runsById[runId];
        if (!base) return { data: null, conflict: false };

        return {
            data: {
                ...base,
                attempt_count: nextAttempt,
            },
            conflict: false,
        };
    });
}

describe('continuous jobs concurrency guards', () => {
    beforeEach(() => {
        Object.values(mocks).forEach((fn) => fn.mockClear());
    });

    it('serializes prompt_rerun globally across clients and defers the overlapping run', async () => {
        const runA = makeRun({
            id: 'run-a',
            jobId: 'job-a',
            clientId: 'client-a',
            jobType: 'prompt_rerun',
        });
        const runB = makeRun({
            id: 'run-b',
            jobId: 'job-b',
            clientId: 'client-b',
            jobType: 'prompt_rerun',
        });

        mocks.listRunnablePendingRuns.mockResolvedValue([runA, runB]);
        mocks.getRecurringJobById.mockImplementation(async (jobId) => ({
            id: jobId,
            client_id: jobId === 'job-a' ? 'client-a' : 'client-b',
            is_active: true,
            status: 'pending',
            cadence_minutes: 1440,
            retry_backoff_minutes: 20,
        }));
        mocks.countRunningRunsForJobTypes.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        setClaimMockFromRuns({
            [runA.id]: runA,
            [runB.id]: runB,
        });

        const summary = await processContinuousWorkerTick({
            source: 'manual',
            maxRunsToExecute: 8,
        });

        expect(summary.completed).toBe(1);
        expect(summary.skippedFamilyLock).toBe(1);
        expect(summary.failed).toBe(0);
        expect(mocks.runTrackedQueriesForClient).toHaveBeenCalledTimes(1);
        expect(mocks.deferRunForFamilyLock).toHaveBeenCalledTimes(1);
        expect(mocks.releaseJobLock).toHaveBeenCalledTimes(1);
        expect(mocks.releaseJobLock.mock.calls[0][1]?.status).toBe('completed');
    });

    it('keeps worker execution alive when family-lock check is unavailable (schema drift fallback)', async () => {
        const run = makeRun({
            id: 'run-family-check-fallback',
            jobId: 'job-family-check-fallback',
            clientId: 'client-family-check-fallback',
            jobType: 'prompt_rerun',
        });

        mocks.listRunnablePendingRuns.mockResolvedValue([run]);
        mocks.getRecurringJobById.mockResolvedValue({
            id: run.job_id,
            client_id: run.client_id,
            is_active: true,
            status: 'pending',
            cadence_minutes: 1440,
            retry_backoff_minutes: 20,
        });
        mocks.countRunningRunsForJobTypes.mockRejectedValueOnce(new Error('relation missing'));
        setClaimMockFromRuns({ [run.id]: run });

        const summary = await processContinuousWorkerTick({
            source: 'manual',
            maxRunsToExecute: 2,
        });

        expect(summary.completed).toBe(1);
        expect(summary.failed).toBe(0);
        expect(summary.skippedFamilyLock).toBe(0);
        expect(mocks.runTrackedQueriesForClient).toHaveBeenCalledTimes(1);
    });

    it('releases the job lock after a failed prompt_rerun that is retried', async () => {
        const run = makeRun({
            id: 'run-retry',
            jobId: 'job-retry',
            clientId: 'client-x',
            jobType: 'prompt_rerun',
            attemptCount: 0,
            maxAttempts: 3,
        });

        mocks.listRunnablePendingRuns.mockResolvedValue([run]);
        mocks.getRecurringJobById.mockResolvedValue({
            id: 'job-retry',
            client_id: 'client-x',
            is_active: true,
            status: 'pending',
            cadence_minutes: 1440,
            retry_backoff_minutes: 20,
        });
        setClaimMockFromRuns({ [run.id]: run });
        mocks.runTrackedQueriesForClient.mockResolvedValue({
            totalQueries: 2,
            runs: [{ error: null }, { error: 'provider_down' }],
        });

        const summary = await processContinuousWorkerTick({
            source: 'manual',
            maxRunsToExecute: 4,
        });

        expect(summary.retried).toBe(1);
        expect(summary.failed).toBe(0);
        expect(mocks.requeueRun).toHaveBeenCalledTimes(1);
        expect(mocks.releaseJobLock).toHaveBeenCalledTimes(1);
        expect(mocks.releaseJobLock.mock.calls[0][1]?.status).toBe('pending');
    });

    it('defers cleanly when DB claim detects a lock conflict race', async () => {
        const run = makeRun({
            id: 'run-conflict',
            jobId: 'job-conflict',
            clientId: 'client-z',
            jobType: 'prompt_rerun',
        });

        mocks.listRunnablePendingRuns.mockResolvedValue([run]);
        mocks.getRecurringJobById.mockResolvedValue({
            id: 'job-conflict',
            client_id: 'client-z',
            is_active: true,
            status: 'pending',
            cadence_minutes: 1440,
            retry_backoff_minutes: 20,
        });
        setClaimMockFromRuns({ [run.id]: run }, new Set([run.id]));

        const summary = await processContinuousWorkerTick({
            source: 'manual',
            maxRunsToExecute: 2,
        });

        expect(summary.skippedFamilyLock).toBe(1);
        expect(summary.completed).toBe(0);
        expect(summary.failed).toBe(0);
        expect(mocks.deferRunForFamilyLock).toHaveBeenCalledTimes(1);
        expect(mocks.runTrackedQueriesForClient).not.toHaveBeenCalled();
    });

    it('recovers stale running runs so family lock is not stuck indefinitely', async () => {
        const staleRun = {
            id: 'stale-run-1',
            job_id: 'job-stale-1',
            client_id: 'client-stale-1',
            job_type: 'prompt_rerun',
            status: 'running',
            attempt_count: 0,
            max_attempts: 3,
            started_at: '2026-04-18T00:00:00.000Z',
        };

        mocks.listStaleRunningRuns.mockResolvedValue([staleRun]);
        mocks.getRecurringJobsByIds.mockResolvedValue([
            {
                id: 'job-stale-1',
                cadence_minutes: 1440,
                retry_backoff_minutes: 15,
            },
        ]);
        mocks.listDueRecurringJobs.mockResolvedValue([]);

        const summary = await processContinuousTick({
            source: 'cron',
            maxJobsToQueue: 4,
        });

        expect(summary.staleRecovered.recovered).toBe(1);
        expect(summary.staleRecovered.failed).toBe(0);
        expect(mocks.requeueStaleRun).toHaveBeenCalledTimes(1);
        expect(mocks.updateRecurringJob).toHaveBeenCalledWith(
            'job-stale-1',
            expect.objectContaining({ status: 'pending' }),
        );
    });

    it('keeps non-conflicting job families parallel (no unnecessary global blocking)', async () => {
        const auditRun = makeRun({
            id: 'run-audit',
            jobId: 'job-audit',
            clientId: 'client-audit',
            jobType: 'audit_refresh',
        });
        const ga4Run = makeRun({
            id: 'run-ga4',
            jobId: 'job-ga4',
            clientId: 'client-ga4',
            jobType: 'ga4_sync_daily',
        });

        mocks.listRunnablePendingRuns.mockResolvedValue([auditRun, ga4Run]);
        mocks.getRecurringJobById.mockImplementation(async (jobId) => ({
            id: jobId,
            client_id: jobId === 'job-audit' ? 'client-audit' : 'client-ga4',
            is_active: true,
            status: 'pending',
            cadence_minutes: 1440,
            retry_backoff_minutes: 20,
        }));
        setClaimMockFromRuns({
            [auditRun.id]: auditRun,
            [ga4Run.id]: ga4Run,
        });

        const summary = await processContinuousWorkerTick({
            source: 'cron',
            maxRunsToExecute: 8,
        });

        expect(summary.completed).toBe(2);
        expect(summary.skippedFamilyLock).toBe(0);
        expect(mocks.countRunningRunsForJobTypes).not.toHaveBeenCalled();
        expect(mocks.runFullAudit).toHaveBeenCalledTimes(1);
        expect(mocks.runGa4SyncForClient).toHaveBeenCalledTimes(1);
    });
});

describe('partial daily snapshot persistence', () => {
    it('persists unavailable metrics as null and records source metadata', async () => {
        mocks.flattenSnapshotToLegacy.mockReturnValueOnce({
            status: 'partial',
            sources: { mentions: 'unavailable' },
            competitorMentions: null,
            seoScore: 0,
            trackedPromptStats: {},
        });
        await upsertVisibilitySnapshotForClient({ clientId: 'client-a', metadata: { reason: 'fixture' } });
        expect(mocks.upsertVisibilityMetricSnapshot).toHaveBeenLastCalledWith(
            expect.objectContaining({
                seo_score: 0,
                competitor_visibility_count: null,
                metadata: { reason: 'fixture', data_status: 'partial', data_sources: { mentions: 'unavailable' } },
            }),
        );
    });
});
