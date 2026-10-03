import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ responses: {}, snapshot: vi.fn(), lastRuns: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/query-runs', () => ({ getLastRunPerTrackedQuery: mocks.lastRuns }));
vi.mock('@/lib/operator-intelligence/snapshot', () => ({ getGeoWorkspaceSnapshot: mocks.snapshot }));
vi.mock('@/lib/operator-intelligence/geo-readiness', () => ({ getReadinessSlice: async () => ({ available: false }) }));
vi.mock('@/lib/client-profile', () => ({
    normalizeClientProfileShape: value => value,
    getBusinessShortDescription: () => '', getPublicContactEmail: () => '',
    getProfileCompletenessSummary: () => ({ gaps: [] }),
}));
vi.mock('@/lib/agent/actionability', () => ({ buildActionabilityReport: () => ({ available: false }) }));
vi.mock('@/lib/agent/protocols', () => ({ buildProtocolsReport: () => ({ available: false }) }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({
    from(table) {
        const query = {
            select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; }, in() { return query; }, single() { return query; },
            then(resolve, reject) {
                const result = mocks.responses[table] || { data: [], error: null };
                return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject);
            },
        };
        return query;
    },
}) }));
import { getPortalDashboardData } from '../../features/portal/server/data.js';
import { buildGeoKpiSnapshot, deriveAuditMetrics, deriveMentionMetrics, derivePromptMetrics, deriveRunMetrics } from '../operator-intelligence/kpi-core.js';

describe('portal partial data', () => {
    beforeEach(() => {
        mocks.lastRuns.mockReset().mockResolvedValue(new Map());
        mocks.responses = { client_geo_profiles: { data: { id: 'client-a', client_name: 'Fixture', business_details: {}, contact_info: {} }, error: null } };
        const snapshot = buildGeoKpiSnapshot({ audit: deriveAuditMetrics(null), runs: deriveRunMetrics([], { totalQueryRuns: 0, brandRecommendations: 0 }), mentions: deriveMentionMetrics([], []), prompts: derivePromptMetrics([], new Map()), counts: {} });
        Object.assign(snapshot, { status: 'available', sources: {}, errors: [] });
        mocks.snapshot.mockReset().mockResolvedValue({ snapshot, latestAudit: null, trackedQueries: [], lastRunMap: new Map(), modelPerformance: [] });
    });
    it('preserves successful empty and true zero without client/provider calls', async () => {
        const data = await getPortalDashboardData('client-a');
        expect(data.status).toBe('available');
        expect(data.openOpportunitiesCount).toBe(0);
        expect(data.visibility.total_query_runs).toBe(0);
        expect(data.visibility.seo_score).toBeNull();
    });
    it('retains zero audit scores and rejects invalid historical numbers', async () => {
        mocks.responses.client_site_audits = { data: [{ id: 'audit-a', scan_status: 'success', seo_score: 0, geo_score: '' }], error: null };
        mocks.responses.visibility_metric_snapshots = { data: [{ snapshot_date: '2026-10-01', seo_score: '' }, { snapshot_date: '2026-10-02', seo_score: 0 }], error: null };
        const data = await getPortalDashboardData('client-a');
        expect(data.visibility.seo_score).toBe(0);
        expect(data.visibility.geo_score).toBeNull();
        expect(data.trendSummary.sparklines.seo_score).toEqual([null, 0]);
    });
    it.each(['opportunities', 'actions', 'visibility_metric_snapshots', 'client_site_audits'])('retains independent sections and sanitizes %s SQL errors', async table => {
        mocks.responses[table] = { data: [{ private: 'must be discarded' }], error: { message: 'SQL secret client-a' } };
        const data = await getPortalDashboardData('client-a');
        expect(data.status).toBe('partial');
        expect(data.client.client_name).toBe('Fixture');
        expect(data.visibility.total_query_runs).toBe(0);
        expect(JSON.stringify(data)).not.toContain('SQL secret');
        expect(JSON.stringify(data)).not.toContain('must be discarded');
        if (table === 'opportunities') expect(data.openOpportunitiesCount).toBeNull();
    });
    it('handles transport rejection as unavailable history', async () => {
        mocks.responses.visibility_metric_snapshots = new Error('transport secret');
        const data = await getPortalDashboardData('client-a');
        expect(data.sources.history).toBe('unavailable');
        expect(JSON.stringify(data)).not.toContain('transport secret');
    });
    it('preserves the latest non-completed prompt run instead of a previous successful run', async () => {
        const ws = await mocks.snapshot();
        ws.trackedQueries = [{ id: 'q1', query_text: 'Fixture' }];
        ws.lastRunMap = new Map([['q1', { target_found: true, created_at: '2026-10-01' }]]);
        mocks.lastRuns.mockResolvedValue(new Map([['q1', { target_found: false, status: 'failed', created_at: '2026-10-02' }]]));
        const data = await getPortalDashboardData('client-a');
        expect(data.topTrackedPrompts[0]).toMatchObject({ target_found: false, last_run_at: '2026-10-02' });
    });
    it('does not fabricate visibility zero when the workspace fails', async () => {
        mocks.snapshot.mockRejectedValue(new Error('SQL secret'));
        const data = await getPortalDashboardData('client-a');
        expect(data.visibility.total_query_runs).toBeNull();
        expect(data.agent.subscores.visibility).toBeNull();
        expect(data.sources.workspace).toBe('unavailable');
    });
});
