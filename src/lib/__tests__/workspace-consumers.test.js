import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    snapshot: vi.fn(),
    opportunities: vi.fn(),
    activity: vi.fn(),
    audits: vi.fn(),
    runs: vi.fn(),
    sessions: vi.fn(),
    benchmarkRuns: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/operator-intelligence/snapshot', () => ({ getGeoWorkspaceSnapshot: mocks.snapshot }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: mocks.opportunities }));
vi.mock('@/lib/operator-intelligence/activity', () => ({ getRecentSafeActivity: mocks.activity }));
vi.mock('@/lib/db/audits', () => ({ getRecentAudits: mocks.audits }));
vi.mock('@/lib/db/query-runs', () => ({
    getRecentQueryRuns: mocks.runs,
    getBenchmarkRunsBySession: mocks.benchmarkRuns,
}));
vi.mock('@/lib/db/benchmarks', () => ({ getBenchmarkSessionsForClient: mocks.sessions }));
vi.mock('@/lib/queries/engine-variants', () => ({ listBenchmarkVariants: () => [] }));
import { getOverviewSlice } from '../operator-intelligence/overview.js';
import { getModelsSlice } from '../operator-intelligence/models.js';
import {
    buildGeoKpiSnapshot,
    deriveAuditMetrics,
    deriveMentionMetrics,
    derivePromptMetrics,
    deriveRunMetrics,
} from '../operator-intelligence/kpi-core.js';

function workspace() {
    const auditMetrics = deriveAuditMetrics({ seo_score: 72, geo_score: 0 });
    const runMetrics = deriveRunMetrics([], { totalQueryRuns: 0, brandRecommendations: 0 });
    const mentionMetrics = deriveMentionMetrics([], []);
    const promptMetrics = derivePromptMetrics([], new Map());
    const snapshot = buildGeoKpiSnapshot({
        audit: auditMetrics,
        runs: runMetrics,
        mentions: mentionMetrics,
        prompts: promptMetrics,
        counts: {},
    });
    Object.assign(snapshot, { status: 'available', sources: { runs: 'empty', mentions: 'empty' }, errors: [] });
    return {
        auditMetrics,
        runMetrics,
        mentionMetrics,
        promptMetrics,
        snapshot,
        modelPerformance: [],
        completedRuns: [],
        latestAudit: { seo_score: 72, geo_score: 0 },
    };
}

describe('snapshot consumer partial results', () => {
    beforeEach(() => {
        mocks.snapshot.mockReset().mockResolvedValue(workspace());
        mocks.opportunities.mockReset().mockResolvedValue({ active: [], stale: [] });
        mocks.activity.mockReset().mockResolvedValue({ items: [] });
        mocks.audits.mockReset().mockResolvedValue([]);
        mocks.runs.mockReset().mockResolvedValue([]);
        mocks.sessions.mockReset().mockResolvedValue([]);
        mocks.benchmarkRuns.mockReset().mockResolvedValue([]);
    });
    it('keeps successful zero counts', async () => {
        const overview = await getOverviewSlice('client-a');
        expect(overview.kpis).toMatchObject({
            seoScore: 72,
            geoScore: 0,
            completedRunsTotal: 0,
            openOpportunitiesCount: 0,
        });
        expect(overview.status).toBe('available');
    });
    it.each(['opportunities', 'activity', 'audits', 'runs'])(
        'retains audit metrics when independent %s loading fails',
        async (source) => {
            mocks[source].mockRejectedValue(new Error('SQL private'));
            const overview = await getOverviewSlice('client-a');
            expect(overview.status).toBe('partial');
            expect(overview.kpis.seoScore).toBe(72);
            expect(JSON.stringify(overview)).not.toContain('SQL private');
            if (source === 'opportunities') expect(overview.kpis.openOpportunitiesCount).toBeNull();
        },
    );
    it('does not crash overview list projections when mention metrics are unavailable', async () => {
        const ws = workspace();
        ws.snapshot.status = 'partial';
        ws.snapshot.sources.mentions = 'unavailable';
        ws.modelPerformance = null;
        ws.mentionMetrics.topSources = null;
        ws.mentionMetrics.topCompetitors = null;
        mocks.snapshot.mockResolvedValue(ws);
        const overview = await getOverviewSlice('client-a');
        expect(overview.sources.topHosts).toEqual([]);
        expect(overview.visibility.topProvidersModels).toEqual([]);
        expect(overview.dataSources.mentions).toBe('unavailable');
    });
    it('keeps model metrics when benchmark sessions fail', async () => {
        mocks.sessions.mockRejectedValue(new Error('SQL private'));
        const models = await getModelsSlice('client-a');
        expect(models.summary.totalRuns).toBe(0);
        expect(models.status).toBe('partial');
        expect(models.dataSources.benchmarks).toBe('unavailable');
        expect(JSON.stringify(models)).not.toContain('SQL private');
    });
    it('marks a benchmark with unavailable runs instead of a successful empty session', async () => {
        mocks.sessions.mockResolvedValue([{ id: 'session-a' }]);
        mocks.benchmarkRuns.mockRejectedValue(new Error('SQL private'));
        const models = await getModelsSlice('client-a');
        expect(models.benchmark.sessions[0].dataStatus).toBe('unavailable');
        expect(models.status).toBe('partial');
    });
});
