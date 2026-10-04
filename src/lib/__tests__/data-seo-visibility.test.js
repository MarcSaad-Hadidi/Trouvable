import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
    query: vi.fn(),
    traffic: [],
    client: { data: { client_name: 'Atelier Boréal', website_url: 'https://example.test' }, error: null },
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/ga4', () => ({ getTrafficDailyRows: async () => io.traffic, getTopPagesRows: async () => [] }));
vi.mock('@/lib/connectors/repository', () => ({
    getClientConnectorRows: async () => [
        { provider: 'gsc', status: 'connected', config: { google_refresh_token: 'fixture-token' } },
    ],
}));
vi.mock('@/lib/connectors/providers/gsc', () => ({
    hasGscServiceAccountCredentials: () => false,
    queryGscSearchAnalyticsRaw: io.query,
}));
vi.mock('@/lib/supabase-admin', () => ({
    getAdminSupabase: () => ({
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => io.client }) }) }),
    }),
}));

import { getVisibilitySlice } from '../operator-intelligence/visibility';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.traffic = [];
    io.query.mockReset().mockImplementation(async ({ dimensions }) => {
        let rows = [];
        if (dimensions.includes('query'))
            rows = [
                { dimensions: { date: '2026-10-01', query: 'réparation' }, clicks: 2, impressions: 10, position: 4 },
                { dimensions: { date: '2026-10-01', query: 'réparation' }, clicks: 0, impressions: 30, position: 8 },
                {
                    dimensions: { date: '2026-10-02', query: 'sans impressions' },
                    clicks: 0,
                    impressions: 0,
                    position: 4,
                },
                {
                    dimensions: { date: '2026-10-02', query: 'sans impressions' },
                    clicks: 0,
                    impressions: 0,
                    position: 8,
                },
                { dimensions: { date: '2026-08-01', query: 'ancien' }, clicks: 99, impressions: 999, position: 1 },
            ];
        if (dimensions.includes('page'))
            rows = [
                {
                    dimensions: { date: '2026-10-01', page: 'https://example.test/PAGE/?x=1' },
                    clicks: 2,
                    impressions: 10,
                    position: 4,
                },
                {
                    dimensions: { date: '2026-10-02', page: 'https://example.test/page' },
                    clicks: 0,
                    impressions: 30,
                    position: 8,
                },
            ];
        return { rows, meta: { complete: true, dimensions } };
    });
});
afterEach(() => vi.useRealTimers());

describe('raw GSC visibility projections', () => {
    it('groups raw dimensions without applying persisted URL normalization', async () => {
        const data = await getVisibilitySlice('client-a');
        expect(data.topPages).toEqual([
            { page: 'https://example.test/PAGE/?x=1', clicks: 2, impressions: 10, ctr: 0.2, position: 4 },
            { page: 'https://example.test/page', clicks: 0, impressions: 30, ctr: 0, position: 8 },
        ]);
        expect(data.topQueries.find((row) => row.query === 'réparation')).toMatchObject({
            clicks: 2,
            impressions: 40,
            ctr: 0.05,
            position: 7,
        });
        expect(data.topQueries.find((row) => row.query === 'sans impressions')).toMatchObject({
            clicks: 0,
            impressions: 0,
            ctr: null,
            position: 6,
        });
        expect(data.topQueries.some((row) => row.query === 'ancien')).toBe(false);
    });

    it('groups nested dates and retains GA4 dates and current-window freshness', async () => {
        io.traffic = [{ date: '2026-10-03', sessions: 0, users: 0 }];
        const data = await getVisibilitySlice('client-a');
        expect(data.trends.gsc).toEqual([
            { date: '2026-10-01', clicks: 2, impressions: 40, ctr: 0.05, position: 7 },
            { date: '2026-10-02', clicks: 0, impressions: 0, ctr: null, position: 6 },
        ]);
        expect(data.trends.ga4).toEqual(io.traffic);
        expect(data.freshness.gsc.lastObservedDate).toBe('2026-10-02');
        expect(data.freshness.ga4.lastObservedDate).toBe('2026-10-03');
        expect(data.kpis).toMatchObject({ totalClicks: 2, totalImpressions: 40, sessions: 0, users: 0 });
        expect(io.query).toHaveBeenCalledTimes(3);
    });
});
