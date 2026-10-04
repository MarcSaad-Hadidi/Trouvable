import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
    from: vi.fn(),
    workspace: vi.fn(),
    flatten: vi.fn(),
    activeClients: vi.fn(),
    engine: vi.fn(async () => {
        throw new Error('Execution engines must never run in read contract tests');
    }),
    engineImports: [],
    queries: [],
    responses: new Map(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/core', () => ({
    db: () => ({ from: io.from }),
    getDbNowIso: () => new Date().toISOString(),
}));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({ from: io.from }) }));
vi.mock('@/lib/db/clients', () => ({
    listActiveClientIds: io.activeClients,
    getClientById: io.engine,
}));
vi.mock('@/lib/operator-intelligence/snapshot', () => ({ getGeoWorkspaceSnapshot: io.workspace }));
vi.mock('@/lib/operator-intelligence/kpi-core', () => ({ flattenSnapshotToLegacy: io.flatten }));
// The real connector overview and repository keep their initialization and scoping.
vi.mock('@/lib/connectors/providers/ga4', () => ({
    getGa4SnapshotFromDb: async ({ clientId }) => ({ provider: 'ga4', clientId, hasRealData: false }),
}));
vi.mock('@/lib/connectors/providers/gsc', () => ({
    getGscSnapshotFromDb: async ({ clientId }) => ({ provider: 'gsc', clientId, hasRealData: false }),
}));
vi.mock('@/lib/connectors/providers/agent-reach', () => ({
    getAgentReachSnapshotFromDb: async ({ clientId }) => ({ provider: 'agent_reach', clientId, hasRealData: false }),
}));
vi.mock('@/lib/audit/run-audit', () => {
    io.engineImports.push('audit');
    return { runFullAudit: io.engine };
});
vi.mock('@/lib/queries/run-tracked-queries', () => {
    io.engineImports.push('prompts');
    return { runTrackedQueriesForClient: io.engine };
});
vi.mock('@/lib/seo/gsc-sync', () => {
    io.engineImports.push('gsc');
    return { runGscSyncForClient: io.engine };
});
vi.mock('@/lib/seo/ga4-sync', () => {
    io.engineImports.push('ga4');
    return { runGa4SyncForClient: io.engine };
});
vi.mock('@/lib/agent-reach/pipeline', () => {
    io.engineImports.push('community');
    return { runCommunityPipeline: io.engine };
});
vi.mock('@/lib/ops/alerts', () => {
    io.engineImports.push('alerts');
    return { sendSlackAlert: io.engine };
});

import { ensureDefaultRecurringJobsForAllClients, getRecurringJobHealthSlice } from '../continuous/recurring-jobs.js';
import { getTrendSlice } from '../continuous/trends.js';
import { captureDailySnapshotsForAllClients, upsertVisibilitySnapshotForClient } from '../continuous/snapshots.js';

const frozenNow = '2026-10-04T02:30:00.000Z';
const emptyCounts = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };

function queriesFor(table, operation = 'read') {
    return io.queries.filter((query) => query.table === table && query.operation === operation);
}

function respond(table, operation, clientId, result) {
    io.responses.set(`${table}:${operation}:${clientId}`, result);
}

function makeQuery(table) {
    const recorded = { table, operation: 'read', steps: [] };
    io.queries.push(recorded);
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'upsert', 'single']) {
        query[method] = (...args) => {
            recorded.steps.push([method, ...args]);
            if (method === 'upsert') {
                recorded.operation = 'upsert';
                recorded.payload = args[0];
            }
            return query;
        };
    }
    query.then = (resolve, reject) => {
        const clientId =
            recorded.steps.find(([method, field]) => method === 'eq' && field === 'client_id')?.[2] ||
            recorded.payload?.client_id ||
            recorded.payload?.[0]?.client_id;
        const response = io.responses.get(`${table}:${recorded.operation}:${clientId}`) || {
            data:
                table === 'visibility_metric_snapshots' && recorded.operation === 'upsert'
                    ? { id: `snapshot-${clientId}`, ...recorded.payload }
                    : [],
            error: null,
        };
        return Promise.resolve(response).then(resolve, reject);
    };
    return query;
}

beforeEach(() => {
    vi.clearAllMocks();
    io.queries.length = 0;
    io.responses.clear();
    vi.useFakeTimers();
    vi.setSystemTime(frozenNow);
    vi.stubEnv('CONTINUOUS_DAILY_FIRST_MODE', '1');
    io.from.mockImplementation(makeQuery);
    io.activeClients.mockResolvedValue([]);
    io.workspace.mockImplementation(async (clientId) => ({
        snapshot: { clientId, status: 'available', sources: {}, errors: [] },
        latestAudit: null,
        modelPerformance: [],
    }));
    io.flatten.mockImplementation((snapshot) => ({
        status: snapshot.status,
        sources: snapshot.sources,
        trackedPromptStats: {},
    }));
});

afterEach(() => {
    expect(io.engine).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('continuous functional contracts', () => {
    it('seeds five defaults before health reads, retaining order, cadence, retries and duplicate policy', async () => {
        const health = await getRecurringJobHealthSlice('client-a');
        expect(io.queries.map(({ table, operation }) => `${table}:${operation}`)).toEqual([
            'recurring_jobs:upsert',
            'recurring_jobs:read',
            'recurring_job_runs:read',
        ]);
        const seed = queriesFor('recurring_jobs', 'upsert')[0];
        expect(seed.steps).toEqual([
            [
                'upsert',
                [
                    ['audit_refresh', 2, 30, '02:35'],
                    ['prompt_rerun', 2, 20, '02:45'],
                    ['gsc_sync_daily', 1, 60, '02:55'],
                    ['ga4_sync_daily', 1, 60, '03:05'],
                    ['community_sync', 1, 60, '03:15'],
                ].map(([jobType, retryLimit, backoff, time]) => ({
                    client_id: 'client-a',
                    job_type: jobType,
                    cadence_minutes: 1440,
                    retry_limit: retryLimit,
                    retry_backoff_minutes: backoff,
                    status: 'pending',
                    is_active: true,
                    next_run_at: `2026-10-04T${time}:00.000Z`,
                    metadata: {
                        seeded_by: 'continuous_visibility_engine',
                        default_seed: true,
                        mode: 'quotidien_hobby',
                    },
                })),
                { onConflict: 'client_id,job_type', ignoreDuplicates: true },
            ],
        ]);
        expect(queriesFor('recurring_jobs')[0].steps).toEqual([
            ['select', '*'],
            ['eq', 'client_id', 'client-a'],
            ['order', 'job_type', { ascending: true }],
        ]);
        expect(queriesFor('recurring_job_runs')[0].steps).toEqual([
            ['select', '*'],
            ['eq', 'client_id', 'client-a'],
            ['order', 'created_at', { ascending: false }],
            ['limit', 40],
        ]);
        expect(health).toEqual({
            jobs: [],
            runs: [],
            summary: { totalJobs: 0, activeJobs: 0, failedJobs: 0, statusCounts: emptyCounts },
        });
    });

    it('rejects failed initialization before either health read', async () => {
        respond('recurring_jobs', 'upsert', 'client-a', { data: null, error: { message: 'seed unavailable' } });
        await expect(getRecurringJobHealthSlice('client-a')).rejects.toThrow('upsertRecurringJobs: seed unavailable');
        expect(io.queries).toHaveLength(1);
    });

    it('keeps existing job settings and counts only recognized statuses with strict active flags', async () => {
        const jobs = [
            { id: 'a', is_active: false, status: 'cancelled', cadence_minutes: 5000 },
            { id: 'b', is_active: true, status: 'failed' },
            { id: 'c', is_active: 1, status: 'pending' },
        ];
        const runs = ['pending', 'running', 'completed', 'failed', 'cancelled', 'other', 'failed'].map((status) => ({
            status,
        }));
        respond('recurring_jobs', 'read', 'client-a', { data: jobs, error: null });
        respond('recurring_job_runs', 'read', 'client-a', { data: runs, error: null });
        expect(await getRecurringJobHealthSlice('client-a')).toEqual({
            jobs,
            runs,
            summary: {
                totalJobs: 3,
                activeJobs: 1,
                failedJobs: 1,
                statusCounts: { ...emptyCounts, pending: 1, running: 1, completed: 1, failed: 2, cancelled: 1 },
            },
        });
    });

    it.each(['recurring_jobs', 'recurring_job_runs'])(
        'propagates %s read failures instead of empty health',
        async (table) => {
            respond(table, 'read', 'client-a', { data: null, error: { message: 'read unavailable' } });
            await expect(getRecurringJobHealthSlice('client-a')).rejects.toThrow('read unavailable');
        },
    );

    it('treats successful null DB rows as empty health', async () => {
        for (const table of ['recurring_jobs', 'recurring_job_runs'])
            respond(table, 'read', 'client-a', { data: null, error: null });
        expect((await getRecurringJobHealthSlice('client-a')).summary).toEqual({
            totalJobs: 0,
            activeJobs: 0,
            failedJobs: 0,
            statusCounts: emptyCounts,
        });
    });

    it('seeds all eligible clients sequentially and stops at the first failure', async () => {
        io.activeClients.mockResolvedValue(['client-a', 'client-b', 'client-c']);
        respond('recurring_jobs', 'upsert', 'client-b', { data: null, error: { message: 'seed b failed' } });
        await expect(ensureDefaultRecurringJobsForAllClients()).rejects.toThrow('seed b failed');
        expect(queriesFor('recurring_jobs', 'upsert').map(({ payload }) => payload[0].client_id)).toEqual([
            'client-a',
            'client-b',
        ]);
    });

    it('returns the number of clients initialized, including an empty listing', async () => {
        await expect(ensureDefaultRecurringJobsForAllClients()).resolves.toBe(0);
        io.activeClients.mockResolvedValue(['client-a', 'client-b']);
        await expect(ensureDefaultRecurringJobsForAllClients()).resolves.toBe(2);
    });

    it('preserves an empty trend without inventing scores, dates or actions', async () => {
        const trend = await getTrendSlice('client-a');
        expect(trend.status).toBe('available');
        expect(trend.metrics).toHaveLength(6);
        for (const metric of trend.metrics) {
            expect(metric).toMatchObject({ latest: null, previous: null, delta: null, latestDate: null, points: [] });
            expect(Object.keys(metric.windows)).toEqual(['d7', 'd30', 'd90']);
        }
        expect(trend).toMatchObject({
            snapshots: [],
            snapshotCoverage: { count: 0, startDate: null, endDate: null },
            improving: [],
            declining: [],
            actionCenter: [],
            freshness: { audit: { state: 'missing', hours: null }, runs: { state: 'missing', hours: null } },
            dailyMode: { enabled: true, cadenceFloorMinutes: 1440, label: 'quotidien_hobby' },
        });
        expect(queriesFor('visibility_metric_snapshots')[0].steps).toEqual([
            ['select', '*'],
            ['eq', 'client_id', 'client-a'],
            ['order', 'snapshot_date', { ascending: true }],
            ['limit', 120],
        ]);
        const connectorSeed = queriesFor('client_data_connectors', 'upsert')[0];
        expect(connectorSeed.steps[0][2]).toEqual({ onConflict: 'client_id,provider', ignoreDuplicates: true });
        expect(connectorSeed.payload.map(({ client_id, provider }) => [client_id, provider])).toEqual([
            ['client-a', 'ga4'],
            ['client-a', 'gsc'],
            ['client-a', 'agent_reach'],
        ]);
    });

    it('retains historical zero outside the windows while current data remains partial', async () => {
        const history = [
            { snapshot_date: '2026-01-01', seo_score: 10 },
            { snapshot_date: '2026-01-02', seo_score: 0 },
        ];
        respond('visibility_metric_snapshots', 'read', 'client-a', { data: history, error: null });
        io.workspace.mockResolvedValue({
            snapshot: { status: 'partial', sources: { runs: 'unavailable' }, errors: [{ source: 'runs' }] },
            latestAudit: null,
            modelPerformance: [],
        });
        const trend = await getTrendSlice('client-a');
        expect(trend).toMatchObject({
            status: 'partial',
            dataSources: { runs: 'unavailable' },
            errors: [{ source: 'runs' }],
            snapshotCoverage: { count: 2, startDate: '2026-01-01', endDate: '2026-01-02' },
            snapshots: history,
        });
        const seo = trend.metrics.find(({ key }) => key === 'seo_score');
        expect(seo).toMatchObject({ latest: 0, previous: 10, delta: -10, points: [] });
        for (const window of Object.values(seo.windows))
            expect(window).toMatchObject({ latest: 0, previous: 10, delta: -10, points: [] });
        expect(trend.actionCenter[0]).toMatchObject({ id: 'score_drop_seo_score', evidence: 'derived_from_snapshots' });
    });

    it('retains measured windows, deltas and freshness under daily and free cadence modes', async () => {
        respond('visibility_metric_snapshots', 'read', 'client-a', {
            data: [
                { snapshot_date: '2026-08-01', seo_score: 30 },
                { snapshot_date: '2026-09-15', seo_score: 20 },
                { snapshot_date: '2026-10-03', seo_score: 0 },
            ],
            error: null,
        });
        io.flatten.mockReturnValue({
            lastAuditAt: '2026-09-30T10:30:00.000Z',
            lastGeoRunAt: '2026-10-01T14:30:00.000Z',
            trackedPromptStats: {},
        });
        const daily = await getTrendSlice('client-a');
        expect(daily.metrics[0]).toMatchObject({ latest: 0, previous: 20, delta: -20 });
        expect(Object.values(daily.metrics[0].windows).map(({ points }) => points.length)).toEqual([1, 2, 3]);
        expect(daily.freshness).toMatchObject({
            audit: { state: 'warning', hours: 88 },
            runs: { state: 'warning', hours: 60 },
            mode: 'quotidien_hobby',
        });
        vi.stubEnv('CONTINUOUS_DAILY_FIRST_MODE', 'off');
        const free = await getTrendSlice('client-a');
        expect(free.freshness).toMatchObject({
            audit: { state: 'stale', hours: 88 },
            runs: { state: 'stale', hours: 60 },
            mode: 'cadence_libre',
        });
        expect(free.actionCenter.map(({ id }) => id)).toEqual(['score_drop_seo_score', 'stale_audit', 'stale_runs']);
        expect(free.dailyMode).toEqual({ enabled: false, cadenceFloorMinutes: 1440, label: 'cadence_libre' });
    });

    it('keeps client A and B histories, health and connectors scoped independently', async () => {
        for (const [clientId, value] of [
            ['client-a', 0],
            ['client-b', 80],
        ]) {
            respond('visibility_metric_snapshots', 'read', clientId, {
                data: [{ snapshot_date: '2026-10-03', seo_score: value }],
                error: null,
            });
            respond('recurring_jobs', 'read', clientId, { data: [{ id: `job-${clientId}` }], error: null });
        }
        const [a, b] = await Promise.all([getTrendSlice('client-a'), getTrendSlice('client-b')]);
        expect(a.metrics[0].latest).toBe(0);
        expect(b.metrics[0].latest).toBe(80);
        expect(a.jobs.jobs[0].id).toBe('job-client-a');
        expect(b.jobs.jobs[0].id).toBe('job-client-b');
        expect(a.connectors.providers.ga4.clientId).toBe('client-a');
        expect(b.connectors.providers.ga4.clientId).toBe('client-b');
        expect(io.workspace.mock.calls).toEqual([['client-a'], ['client-b']]);
    });

    it.each([
        ['visibility_metric_snapshots', 'read'],
        ['recurring_jobs', 'upsert'],
        ['client_data_connectors', 'upsert'],
        ['client_data_connectors', 'read'],
    ])('propagates required trend source failure %s/%s', async (table, operation) => {
        respond(table, operation, 'client-a', { data: null, error: { message: 'required source failed' } });
        await expect(getTrendSlice('client-a')).rejects.toThrow('required source failed');
    });

    it('propagates workspace failures rather than fabricating a trend or snapshot', async () => {
        io.workspace.mockRejectedValue(new Error('workspace failed'));
        await expect(getTrendSlice('client-a')).rejects.toThrow('workspace failed');
        await expect(upsertVisibilitySnapshotForClient({ clientId: 'client-a' })).rejects.toThrow('workspace failed');
        expect(queriesFor('visibility_metric_snapshots', 'upsert')).toEqual([]);
    });

    it('captures UTC date, observed zero, nulls, provenance and reserved metadata', async () => {
        io.flatten.mockReturnValue({
            status: 'partial',
            sources: { mentions: 'unavailable' },
            seoScore: 0,
            geoScore: null,
            trackedPromptStats: { mentionRatePercent: 0 },
            lastAuditAt: '2026-10-01T00:00:00.000Z',
        });
        const captured = await upsertVisibilitySnapshotForClient({
            clientId: 'client-a',
            source: 'manual',
            sourceJobRunId: 'run-a',
            metadata: { reason: 'fixture', data_status: 'wrong', data_sources: { wrong: true } },
        });
        const payload = {
            client_id: 'client-a',
            source: 'manual',
            source_job_run_id: 'run-a',
            snapshot_date: '2026-10-04',
            captured_at: frozenNow,
            seo_score: 0,
            geo_score: null,
            visibility_proxy_percent: null,
            mention_rate_percent: 0,
            citation_coverage_percent: null,
            competitor_visibility_count: null,
            freshness_audit_at: '2026-10-01T00:00:00.000Z',
            freshness_run_at: null,
            metadata: { reason: 'fixture', data_status: 'partial', data_sources: { mentions: 'unavailable' } },
        };
        expect(captured).toEqual({ id: 'snapshot-client-a', ...payload });
        expect(queriesFor('visibility_metric_snapshots', 'upsert')[0].steps).toEqual([
            ['upsert', payload, { onConflict: 'client_id,snapshot_date' }],
            ['select', '*'],
            ['single'],
        ]);
        expect(io.workspace).toHaveBeenCalledWith('client-a');
        expect(queriesFor('recurring_jobs', 'upsert')).toEqual([]);
    });

    it('captures missing metrics as null with default source and metadata', async () => {
        io.flatten.mockReturnValue(undefined);
        const captured = await upsertVisibilitySnapshotForClient({ clientId: 'client-b' });
        expect(captured).toMatchObject({
            client_id: 'client-b',
            source: 'system',
            source_job_run_id: null,
            seo_score: null,
            geo_score: null,
            mention_rate_percent: null,
            metadata: { data_status: 'available', data_sources: {} },
        });
    });

    it('rejects snapshot persistence failures', async () => {
        respond('visibility_metric_snapshots', 'upsert', 'client-a', {
            data: null,
            error: { message: 'snapshot write failed' },
        });
        await expect(upsertVisibilitySnapshotForClient({ clientId: 'client-a' })).rejects.toThrow(
            'upsertVisibilityMetricSnapshot: snapshot write failed',
        );
    });

    it('captures a daily batch sequentially, continuing after failure without seeding jobs', async () => {
        io.activeClients.mockResolvedValue(['client-a', 'client-b', 'client-c']);
        let releaseFirst;
        let firstStarted;
        const firstGate = new Promise((resolve) => {
            releaseFirst = resolve;
        });
        const started = new Promise((resolve) => {
            firstStarted = resolve;
        });
        io.workspace.mockImplementationOnce(async (clientId) => {
            firstStarted();
            await firstGate;
            return { snapshot: { clientId, status: 'available', sources: {} }, latestAudit: null };
        });
        respond('visibility_metric_snapshots', 'upsert', 'client-b', {
            data: null,
            error: { message: 'snapshot b failed' },
        });
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        const capture = captureDailySnapshotsForAllClients();
        await started;
        expect(io.workspace.mock.calls).toEqual([['client-a']]);
        releaseFirst();
        await expect(capture).resolves.toEqual({ captured: 2, total: 3 });
        expect(io.workspace.mock.calls).toEqual([['client-a'], ['client-b'], ['client-c']]);
        expect(errorLog).toHaveBeenCalledTimes(1);
        expect(queriesFor('recurring_jobs', 'upsert')).toEqual([]);
        expect(queriesFor('visibility_metric_snapshots', 'upsert').map(({ payload }) => payload)).toEqual(
            ['client-a', 'client-b', 'client-c'].map((clientId) =>
                expect.objectContaining({
                    client_id: clientId,
                    source: 'cron',
                    source_job_run_id: null,
                    metadata: { reason: 'daily_snapshot', data_status: 'available', data_sources: {} },
                }),
            ),
        );
    });

    it('returns an empty daily batch and propagates a failed client listing', async () => {
        await expect(captureDailySnapshotsForAllClients()).resolves.toEqual({ captured: 0, total: 0 });
        expect(io.workspace).not.toHaveBeenCalled();
        io.activeClients.mockRejectedValue(new Error('client listing failed'));
        await expect(captureDailySnapshotsForAllClients()).rejects.toThrow('client listing failed');
    });
});

describe('continuous import boundary', () => {
    it('imports health, trend and capture entry points without loading any execution engine', () => {
        // Factory invocations record real import evaluation, independently of calls.
        // RED on the baseline monolith; GREEN only after imports target split modules.
        expect(io.engineImports).toEqual([]);
    });
});
