import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ audit: vi.fn(), tracked: vi.fn(), responses: {} }));
vi.mock('server-only', () => ({}));

vi.mock('@/lib/db/audits', () => ({ getLatestAudit: mocks.audit }));
vi.mock('@/lib/db/tracked-queries', () => ({ getTrackedQueriesAll: mocks.tracked }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({
    from(table) {
        const filters = {};
        let options, columns;
        const query = {
            select(c, o) { columns = c; options = o; return query; },
            eq(k, v) { filters[k] = v; return query; },
            or() { return query; }, order() { return query; }, limit() { return query; },
            maybeSingle() { return query; }, in() { return query; },
            then(resolve, reject) {
                let key = table;
                if (table === 'tracked_queries') key = filters.is_active ? 'activeTrackedQueries' : 'totalTrackedQueries';
                if (table === 'query_runs') key = options?.head ? (filters.target_found ? 'brandRecommendations' : 'totalQueryRuns') : columns === 'created_at' ? 'lastRun' : columns === 'raw_analysis' ? 'diagnostics' : 'runs';
                const result = mocks.responses[key] ?? (options?.head ? { count: 0, error: null } : { data: columns === 'created_at' ? null : [], error: null });
                return Promise.resolve(result).then(resolve, reject);
            },
        };
        return query;
    },
}) }));
import { getGeoWorkspaceSnapshot } from '../operator-intelligence/snapshot.js';
import { flattenSnapshotToLegacy } from '../operator-intelligence/kpi-core.js';

describe('workspace source availability', () => {
    beforeEach(() => {
        mocks.responses = {};
        mocks.audit.mockReset().mockResolvedValue(null);
        mocks.tracked.mockReset().mockResolvedValue([]);
    });
    it('distinguishes successful empty sources and observed zero', async () => {
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.counts.totalQueryRuns).toBe(0);
        expect(ws.completedRuns).toEqual([]);
        expect(ws.snapshot.status).toBe('available');
        expect(ws.snapshot.sources.runs).toBe('empty');
        expect(ws.snapshot.sources.totalQueryRuns).toBe('available');
        expect(ws.runMetrics.visibilityProxyPercent.value).toBeNull();
    });
    it('retains a valid zero audit score', async () => {
        mocks.audit.mockResolvedValue({ seo_score: 0, geo_score: 0 });
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.auditMetrics.seoScore.value).toBe(0);
        expect(ws.snapshot.guardrails.map(w => w.code)).not.toContain('NO_AUDIT');
    });
    it('retains independent data when a source fails and exposes safe errors', async () => {
        mocks.responses.opportunities = { count: null, error: { message: 'SQL private client-a' } };
        mocks.audit.mockResolvedValue({ seo_score: 72 });
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.snapshot.status).toBe('partial');
        expect(ws.counts.openOpportunities).toBeNull();
        expect(ws.auditMetrics.seoScore.value).toBe(72);
        expect(JSON.stringify(ws)).not.toContain('SQL private');
        expect(flattenSnapshotToLegacy(ws.snapshot, ws.latestAudit).openOpportunities).toBeNull();
    });
    it('does not derive visibility when the recommendation count fails', async () => {
        mocks.responses.totalQueryRuns = { count: 5, error: null };
        mocks.responses.brandRecommendations = { count: null, error: { message: 'denied' } };
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.runMetrics.totalQueryRuns.value).toBe(5);
        expect(ws.runMetrics.visibilityProxyPercent.value).toBeNull();
        expect(ws.runMetrics.visibilityProxyPercent.status).toBe('unavailable');
    });
    it('does not fabricate citation zero when mention loading fails', async () => {
        mocks.responses.runs = { data: [{ id: 'run-a', provider: 'test', model: 'fixture', target_found: true }], error: null };
        mocks.responses.totalQueryRuns = { count: 1, error: null };
        mocks.responses.query_mentions = { data: null, error: { message: 'denied' } };
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.mentionMetrics.sourceMentions.value).toBeNull();
        expect(ws.mentionMetrics.citationCoveragePercent.value).toBeNull();
        expect(ws.modelPerformance[0]).toMatchObject({ targetRatePercent: 100, sources: null });
        expect(ws.snapshot.guardrails.map(w => w.code)).not.toContain('NO_SOURCES');
    });
    it('does not turn a failed tracked query load into an empty success', async () => {
        mocks.tracked.mockRejectedValue(new Error('SQL secret'));
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.promptMetrics.total.value).toBeNull();
        expect(ws.snapshot.sources.trackedQueries).toBe('unavailable');
        expect(ws.snapshot.guardrails.map(w => w.code)).not.toContain('NO_PROMPTS');
    });
    it('does not claim prompts are unrun when the run source failed', async () => {
        mocks.tracked.mockResolvedValue([{ id: 'q1', is_active: true }]);
        mocks.responses.runs = { data: null, error: { message: 'denied' } };
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.promptMetrics.total.value).toBe(1);
        expect(ws.promptMetrics.noRunYet).toBeNull();
        expect(ws.promptMetrics.mentionRatePercent.value).toBeNull();
    });
});


describe('workspace completeness across each source', () => {
    beforeEach(() => {
        mocks.responses = {};
        mocks.audit.mockReset().mockResolvedValue(null);
        mocks.tracked.mockReset().mockResolvedValue([]);
    });
    it.each(['opportunities', 'merge_suggestions', 'activeTrackedQueries', 'totalTrackedQueries', 'totalQueryRuns', 'brandRecommendations', 'runs', 'lastRun', 'diagnostics'])('checks Supabase error for %s', async source => {
        mocks.responses[source] = { count: 99, data: [{ id: 'unsafe' }], error: { message: 'SQL secret' } };
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.snapshot.status).toBe('partial');
        expect(JSON.stringify(ws)).not.toContain('unsafe');
        expect(JSON.stringify(ws)).not.toContain('SQL secret');
    });
    it('keeps unavailable counts distinct from missing historical audit', async () => {
        mocks.audit.mockRejectedValue(new Error('audit denied'));
        mocks.responses.totalQueryRuns = { count: null, error: { message: 'count denied' } };
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.runMetrics.totalQueryRuns.value).toBeNull();
        expect(ws.snapshot.sources.audit).toBe('unavailable');
        expect(ws.snapshot.guardrails.map(w => w.code)).not.toContain('NO_AUDIT');
        expect(ws.snapshot.guardrails.map(w => w.code)).not.toContain('NO_RUNS');
    });
    it('reports a wholly failed snapshot as unavailable', async () => {
        mocks.audit.mockRejectedValue(new Error('denied'));
        mocks.tracked.mockRejectedValue(new Error('denied'));
        for (const key of ['opportunities', 'merge_suggestions', 'activeTrackedQueries', 'totalTrackedQueries', 'totalQueryRuns', 'brandRecommendations', 'runs', 'lastRun', 'diagnostics']) mocks.responses[key] = { data: null, count: null, error: { message: 'denied' } };
        const ws = await getGeoWorkspaceSnapshot('client-a');
        expect(ws.snapshot.status).toBe('unavailable');
        expect(ws.counts.totalQueryRuns).toBeNull();
    });
});
