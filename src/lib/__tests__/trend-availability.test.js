import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ snapshot: vi.fn(), metrics: vi.fn(), history: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/operator-intelligence/snapshot', () => ({ getGeoWorkspaceSnapshot: io.snapshot }));
vi.mock('@/lib/operator-intelligence/kpi-core', () => ({ flattenSnapshotToLegacy: io.metrics }));
vi.mock('@/lib/db/snapshots', () => ({
    listVisibilityMetricSnapshots: io.history,
    upsertVisibilityMetricSnapshot: vi.fn(),
}));
vi.mock('@/lib/db/jobs', async (importOriginal) => ({
    ...(await importOriginal()),
    listRecurringJobsForClient: async () => [],
    listRecentRecurringJobRunsForClient: async () => [],
    upsertRecurringJobs: async () => {},
}));
vi.mock('@/lib/connectors', () => ({
    getConnectorOverviewForClient: async () => ({ connections: [], providers: {}, summary: {} }),
}));
vi.mock('@/lib/supabase-admin', () => ({
    getAdminSupabase: () => {
        throw new Error('Unexpected unmocked DB operation');
    },
}));
vi.mock('@/lib/audit/run-audit', () => ({ runFullAudit: vi.fn() }));
vi.mock('@/lib/queries/run-tracked-queries', () => ({ runTrackedQueriesForClient: vi.fn() }));
vi.mock('@/lib/seo/gsc-sync', () => ({ runGscSyncForClient: vi.fn() }));
vi.mock('@/lib/seo/ga4-sync', () => ({ runGa4SyncForClient: vi.fn() }));
vi.mock('@/lib/agent-reach/pipeline', () => ({ runCommunityPipeline: vi.fn() }));
vi.mock('@/lib/ops/alerts', () => ({ sendSlackAlert: vi.fn() }));
import { getTrendSlice } from '../continuous/trends.js';

describe('continuous trend current source availability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        io.snapshot.mockResolvedValue({
            snapshot: {
                status: 'partial',
                sources: { brandRecommendations: 'unavailable' },
                errors: [{ source: 'brandRecommendations', message: 'Données temporairement indisponibles.' }],
            },
            latestAudit: null,
            modelPerformance: [],
        });
        io.metrics.mockReturnValue({ competitorMentions: 20, brandRecommendationRuns: null, trackedPromptStats: {} });
        io.history.mockResolvedValue([
            { snapshot_date: '2026-01-01', seo_score: 60 },
            { snapshot_date: '2026-01-02', seo_score: 70 },
        ]);
    });
    it('retains measured history and marks the current snapshot partial without inventing competitor pressure', async () => {
        const trend = await getTrendSlice('client-a');
        expect(trend.metrics.find((metric) => metric.key === 'seo_score')).toMatchObject({ latest: 70, previous: 60 });
        expect(trend.actionCenter.some((action) => action.id === 'competitor_pressure')).toBe(false);
        expect(trend.status).toBe('partial');
        expect(trend.dataSources.brandRecommendations).toBe('unavailable');
    });
    it('keeps genuine zero brand runs eligible for competitor pressure', async () => {
        io.metrics.mockReturnValue({ competitorMentions: 20, brandRecommendationRuns: 0, trackedPromptStats: {} });
        const trend = await getTrendSlice('client-a');
        expect(trend.actionCenter.some((action) => action.id === 'competitor_pressure')).toBe(true);
    });
});
