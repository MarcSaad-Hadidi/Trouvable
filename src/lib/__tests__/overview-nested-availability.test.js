import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ ws: vi.fn(), opportunities: vi.fn(), activity: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/operator-intelligence/snapshot', () => ({ getGeoWorkspaceSnapshot: io.ws }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: io.opportunities }));
vi.mock('@/lib/operator-intelligence/activity', () => ({ getRecentSafeActivity: io.activity }));
vi.mock('@/lib/db/audits', () => ({ getRecentAudits: async () => [] }));
vi.mock('@/lib/db/query-runs', () => ({ getRecentQueryRuns: async () => [] }));
import { getOverviewSlice } from '../operator-intelligence/overview.js';

beforeEach(() => {
    io.ws.mockResolvedValue({
        snapshot: { status: 'available', sources: { runs: 'empty' }, errors: [], guardrails: [] },
        auditMetrics: { seoScore: { value: 72 }, geoScore: { value: 0 } },
        runMetrics: {
            totalQueryRuns: { value: 0 },
            visibilityProxyPercent: { value: null },
            avgParseConfidence: { value: null },
            parseFailureRate: { value: null },
        },
        mentionMetrics: {
            citationCoveragePercent: { value: null },
            confirmedCompetitorMentions: { value: 0 },
            genericMentions: { value: 0 },
            sourceMentions: { value: 0 },
            externalSourceMentions: { value: 0 },
        },
        promptMetrics: { total: { value: 0 }, mentionRatePercent: { value: null } },
        completedRuns: [],
        modelPerformance: [],
        latestAudit: null,
        lastRunAt: null,
    });
    io.opportunities.mockResolvedValue({ active: [], stale: [] });
    io.activity.mockResolvedValue({
        status: 'available',
        dataSources: { actions: 'empty', audits: 'empty' },
        errors: [],
        items: [],
    });
});
describe('overview nested source truth', () => {
    it('retains fulfilled partial activity and its unavailable source', async () => {
        io.activity.mockResolvedValue({
            status: 'partial',
            dataSources: { actions: 'available', audits: 'unavailable' },
            errors: [{ source: 'audits', message: 'Données temporairement indisponibles.' }],
            items: [{ id: 'action-a' }],
        });
        const overview = await getOverviewSlice('client-a');
        expect(overview.status).toBe('partial');
        expect(overview.dataSources).toMatchObject({ activity: 'partial', 'activity.audits': 'unavailable' });
        expect(overview.recentActivity).toEqual([{ id: 'action-a' }]);
        expect(overview.kpis.seoScore).toBe(72);
        expect(overview.errors.some((error) => error.source === 'activity.audits')).toBe(true);
    });
    it('honors nested opportunity availability while retaining independent known totals', async () => {
        io.opportunities.mockResolvedValue({
            active: [{ id: 'opp-a', status: 'open' }],
            stale: [],
            status: 'partial',
            dataSources: { opportunities: 'available', merges: 'unavailable' },
            errors: [{ source: 'merges', message: 'Données temporairement indisponibles.' }],
        });
        const overview = await getOverviewSlice('client-a');
        expect(overview.status).toBe('partial');
        expect(overview.dataSources['opportunities.merges']).toBe('unavailable');
        expect(overview.kpis.openOpportunitiesCount).toBe(1);
    });
});
