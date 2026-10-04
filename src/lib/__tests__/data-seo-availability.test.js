import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
    traffic: vi.fn(),
    topPages: vi.fn(),
    connectors: vi.fn(),
    storedGsc: vi.fn(),
    liveGsc: vi.fn(),
    client: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/ga4', () => ({ getTrafficDailyRows: io.traffic, getTopPagesRows: io.topPages }));
vi.mock('@/lib/db/gsc', () => ({ getRecentGscRows: io.storedGsc }));
vi.mock('@/lib/db/clients', () => ({ getClientSearchIdentity: io.client }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: io.connectors }));
vi.mock('@/lib/connectors/providers/gsc', () => ({
    hasGscServiceAccountCredentials: () => false,
    queryGscSearchAnalyticsRaw: io.liveGsc,
}));
import { getSeoOverviewSlice } from '../operator-intelligence/seo-overview';
import { getVisibilitySlice } from '../operator-intelligence/visibility';

const queryRows = [{ dimensions: { date: '2026-10-01', query: 'réparation' }, clicks: 0, impressions: 0, position: 0 }];
const pageRows = [
    { dimensions: { date: '2026-10-02', page: 'https://example.test/page' }, clicks: 2, impressions: 40, position: 4 },
];
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.traffic.mockReset().mockResolvedValue([{ date: '2026-10-03', sessions: 0, users: 0 }]);
    io.topPages.mockReset().mockResolvedValue([]);
    io.connectors
        .mockReset()
        .mockResolvedValue([
            {
                provider: 'gsc',
                status: 'connected',
                last_synced_at: '2026-10-03',
                config: { google_refresh_token: 'fixture-token' },
            },
        ]);
    io.storedGsc
        .mockReset()
        .mockResolvedValue([{ date: '2026-10-01', query: 'réparation', clicks: 0, impressions: 0 }]);
    io.client.mockReset().mockResolvedValue({ clientName: 'Atelier', websiteUrl: 'https://example.test' });
    io.liveGsc.mockReset().mockImplementation(async ({ dimensions }) => ({
        rows: dimensions.includes('query') ? queryRows : dimensions.includes('page') ? pageRows : [],
        meta: { dimensions, complete: true },
    }));
});
afterEach(() => vi.useRealTimers());

describe('SEO source availability', () => {
    it.each([getSeoOverviewSlice, getVisibilitySlice])(
        'retains independent GSC when GA4 traffic fails in %s',
        async (load) => {
            io.traffic.mockRejectedValue(new Error('private SQL traffic'));
            const data = await load('client-a');
            expect(data.kpis.sessions).toBeNull();
            expect(data.kpis.users).toBeNull();
            expect(data.kpis.daysWithTraffic).toBeNull();
            expect(data.kpis.totalClicks).toBe(0);
            expect(data.status).toBe('partial');
            expect(data.dataSources.ga4Traffic).toBe('unavailable');
            expect(JSON.stringify(data)).not.toContain('private SQL');
        },
    );

    it.each([getSeoOverviewSlice, getVisibilitySlice])(
        'keeps a connector read error distinct from not connected in %s',
        async (load) => {
            io.connectors.mockRejectedValue(new Error('private connector SQL'));
            const data = await load('client-a');
            expect(data.connectors.ga4.status).toBe('unavailable');
            expect(data.connectors.gsc.status).toBe('unavailable');
            expect(data.dataSources.connectors).toBe('unavailable');
            expect(data.kpis.sessions).toBe(0);
            expect(data.status).toBe('partial');
            expect(data.emptyState?.title || '').not.toContain('non connectée');
            expect(io.liveGsc).not.toHaveBeenCalled();
        },
    );

    it('keeps successful empty sources distinct from errors and observed zero', async () => {
        const observed = await getVisibilitySlice('client-a');
        expect(observed.summary).toMatchObject({ clicks: 0, impressions: 0, organicSessions: 0, organicUsers: 0 });
        expect(observed.ga4Support.sessions).toBe(0);
        io.traffic.mockResolvedValue([]);
        io.storedGsc.mockResolvedValue([]);
        const empty = await getSeoOverviewSlice('client-a');
        expect(empty.status).toBe('available');
        expect(empty.dataSources).toMatchObject({ ga4Traffic: 'empty', gscRows: 'empty' });
        expect(empty.errors).toEqual([]);
        expect(empty.kpis).toMatchObject({
            sessions: null,
            users: null,
            totalClicks: null,
            totalImpressions: null,
            daysWithTraffic: 0,
            gscQueryCount: 0,
        });
    });

    it('retains an audit, zero GA4 and GA4 date when stored GSC fails', async () => {
        io.storedGsc.mockRejectedValue(new Error('private GSC SQL'));
        const data = await getSeoOverviewSlice('client-a', {
            audit: { seo_score: 0, geo_score: 0, created_at: '2026-09-30' },
        });
        expect(data.kpis).toMatchObject({
            sessions: 0,
            totalClicks: null,
            totalImpressions: null,
            gscQueryCount: null,
        });
        expect(data.auditScores.seoScore).toBe(0);
        expect(data.dataFreshness).toMatchObject({
            latestTrafficDate: '2026-10-03',
            latestGscDate: null,
            lastAuditAt: '2026-09-30',
        });
        expect(data.dataSources.gscRows).toBe('unavailable');
    });

    it('retains GA4 and fulfilled GSC page rows when the independent query request fails', async () => {
        io.liveGsc.mockImplementation(async ({ dimensions }) => {
            if (dimensions.includes('query')) throw new Error('private token provider failure');
            return { rows: dimensions.includes('page') ? pageRows : [], meta: { dimensions, complete: true } };
        });
        const data = await getVisibilitySlice('client-a');
        expect(data.status).toBe('partial');
        expect(data.dataSources).toMatchObject({
            ga4Traffic: 'available',
            gscQueries: 'unavailable',
            gscPages: 'available',
        });
        expect(data.kpis).toMatchObject({
            sessions: 0,
            totalClicks: null,
            totalImpressions: null,
            gscQueryCount: null,
            gscPageCount: 1,
        });
        expect(data.topPages[0]).toMatchObject({ clicks: 2, impressions: 40 });
        expect(data.gscSource.rowCounts).toMatchObject({ queryRowsTotal: null, pageRowsCurrent: 1 });
        expect(data.gscSource.complete.query).toBeNull();
        expect(data.freshness.ga4.lastObservedDate).toBe('2026-10-03');
        expect(JSON.stringify(data)).not.toContain('private token');
    });

    it('identifies incomplete provider data without discarding its observed rows', async () => {
        io.liveGsc.mockImplementation(async ({ dimensions }) => ({
            rows: dimensions.includes('query') ? queryRows : [],
            meta: { dimensions, complete: false },
        }));
        const data = await getVisibilitySlice('client-a');
        expect(data.status).toBe('partial');
        expect(data.dataSources.gscQueries).toBe('partial');
        expect(data.topQueries).toHaveLength(1);
        expect(data.gscSource.complete.query).toBe(false);
    });

    it('preserves genuine not-connected metadata without pretending the source failed', async () => {
        io.connectors.mockResolvedValue([]);
        io.traffic.mockResolvedValue([]);
        const data = await getVisibilitySlice('client-a');
        expect(data.connectors.gsc.status).toBe('not_connected');
        expect(data.dataSources.connectors).toBe('empty');
        expect(data.dataSources.gscQueries).toBe('not_connected');
        expect(data.status).toBe('available');
        expect(data.errors).toEqual([]);
        expect(data.emptyState.title).toContain('non connectée');
        expect(io.liveGsc).not.toHaveBeenCalled();
    });

    it('keeps independent GA4 top pages when traffic fails and the latest observed dates regardless of row order', async () => {
        io.topPages.mockResolvedValue([{ landing_page: '/observed', sessions: 2 }]);
        io.traffic.mockRejectedValue(new Error('private traffic failure'));
        const visibility = await getVisibilitySlice('client-a');
        expect(visibility.landingPages).toEqual([{ landing_page: '/observed', sessions: 2 }]);
        expect(visibility.dataSources.ga4TopPages).toBe('available');
        io.traffic.mockResolvedValue([
            { date: '2026-09-29', sessions: 1 },
            { date: '2026-10-03', sessions: 2 },
        ]);
        io.storedGsc.mockResolvedValue([
            { date: '2026-09-30', clicks: 5 },
            { date: '2026-10-02', clicks: 0 },
        ]);
        const overview = await getSeoOverviewSlice('client-a');
        expect(overview.dataFreshness).toMatchObject({ latestTrafficDate: '2026-10-03', latestGscDate: '2026-10-02' });
    });

    it('does not fabricate measured counts or comparisons from an unavailable provider', async () => {
        io.liveGsc.mockRejectedValue(new Error('private provider failure'));
        const failed = await getVisibilitySlice('client-a');
        expect(failed.kpis).toMatchObject({
            totalClicks: null,
            totalImpressions: null,
            gscQueryCount: null,
            gscPageCount: null,
        });
        expect(failed.summary.queryCount).toBeNull();
        expect(failed.comparison).toBeNull();
        expect(failed.trackedKeywordCount).toBeNull();
        expect(failed.freshness.gsc.reliability).toBe('unavailable');
        expect(failed.errors).toHaveLength(3);
        expect(JSON.stringify(failed)).not.toContain('private provider');
        io.liveGsc.mockImplementation(async ({ dimensions }) => ({ rows: [], meta: { dimensions, complete: true } }));
        const empty = await getVisibilitySlice('client-a');
        expect(empty.dataSources.gscQueries).toBe('empty');
        expect(empty.errors).toEqual([]);
        expect(empty.kpis).toMatchObject({
            totalClicks: null,
            totalImpressions: null,
            gscQueryCount: 0,
            gscPageCount: 0,
        });
        expect(empty.comparison).toBeNull();
    });

    it('keeps known missing credentials distinct from a failed provider request', async () => {
        io.connectors.mockResolvedValue([{ provider: 'gsc', status: 'connected', config: {} }]);
        const data = await getVisibilitySlice('client-a');
        expect(data.dataSources.gscQueries).toBe('not_observed');
        expect(data.status).toBe('available');
        expect(data.errors).toEqual([]);
        expect(data.kpis.totalClicks).toBeNull();
        expect(io.liveGsc).not.toHaveBeenCalled();
    });

    it('retains a complete device distribution when a separate GSC query request fails', async () => {
        io.liveGsc.mockImplementation(async ({ dimensions }) => {
            if (dimensions.includes('query')) throw new Error('private query failure');
            return {
                rows: dimensions.includes('device')
                    ? [
                          { dimensions: { device: 'DESKTOP' }, impressions: 60 },
                          { dimensions: { device: 'MOBILE' }, impressions: 40 },
                      ]
                    : pageRows,
                meta: { dimensions, complete: true },
            };
        });
        const data = await getVisibilitySlice('client-a');
        expect(data.dataSources).toMatchObject({ gscQueries: 'unavailable', gscDevices: 'available' });
        expect(data.deviceSplit).toMatchObject({ status: 'available', totalSearches: 100, detail: null });
        expect(data.deviceSplit.categories.map((row) => row.value)).toEqual([60, 40]);
    });
});
