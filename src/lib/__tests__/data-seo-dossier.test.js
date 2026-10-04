import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ visibility: {} }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/operator-intelligence/base', () => ({
    getOperatorWorkspaceShell: async () => ({
        client: { id: 'a', client_name: 'Fixture', business_details: {}, contact_info: {} },
        workspace: { seoScore: 0, completedRunCount: 0 },
    }),
}));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: async () => ({ active: [] }) }));
vi.mock('@/lib/operator-intelligence/activity', () => ({ getRecentSafeActivity: async () => ({ items: [] }) }));
vi.mock('@/lib/connectors/index', () => ({
    getConnectorOverviewForClient: async () => ({
        connections: [],
        providers: { ga4: { hasRealData: true }, gsc: { hasRealData: true } },
    }),
}));
vi.mock('@/lib/continuous/recurring-jobs', () => ({
    getRecurringJobHealthSlice: async () => ({ jobs: [], runs: [], summary: {} }),
}));
vi.mock('@/lib/operator-intelligence/social', () => ({ getSocialSlice: async () => ({ summary: {} }) }));
vi.mock('@/lib/operator-intelligence/visibility', () => ({ getVisibilitySlice: async () => io.visibility }));
import { getDossierOverviewSlice, getDossierConnectorsSlice } from '../operator-intelligence/dossier';

beforeEach(() => {
    io.visibility = {
        kpis: { sessions: null, daysWithTraffic: null, totalClicks: 0, totalImpressions: 0, gscQueryCount: 1 },
        dataSources: { ga4Traffic: 'unavailable', gscQueries: 'available' },
    };
});

describe('dossier SEO availability consumer', () => {
    it('uses unavailable copy for failed traffic while retaining independently observed GSC zero', async () => {
        const overview = await getDossierOverviewSlice('a');
        expect(overview.summaryCards.find((card) => card.id === 'seo_summary').detail).toBe(
            '0 clic(s) GSC · n.d. session(s) GA4',
        );
        const connectors = await getDossierConnectorsSlice('a');
        const traffic = connectors.items
            .find((item) => item.id === 'ga4')
            .metrics.find((metric) => metric.id === 'sessions_28d');
        const clicks = connectors.items
            .find((item) => item.id === 'gsc')
            .metrics.find((metric) => metric.id === 'clicks_28d');
        expect(traffic).toMatchObject({ value: 'n.d.', reliability: 'unavailable' });
        expect(traffic.detail).toContain('temporairement indisponibles');
        expect(clicks).toMatchObject({ value: 0, reliability: 'measured' });
        expect(JSON.stringify(connectors)).not.toContain('null impression');
    });

    it('keeps observed zero GA4 eligible for measured connector display', async () => {
        io.visibility.kpis.sessions = 0;
        io.visibility.kpis.daysWithTraffic = 1;
        io.visibility.dataSources.ga4Traffic = 'available';
        const connectors = await getDossierConnectorsSlice('a');
        expect(
            connectors.items.find((item) => item.id === 'ga4').metrics.find((metric) => metric.id === 'sessions_28d'),
        ).toMatchObject({ value: 0, detail: '1 jour(s) alimentés', reliability: 'measured' });
    });
});
