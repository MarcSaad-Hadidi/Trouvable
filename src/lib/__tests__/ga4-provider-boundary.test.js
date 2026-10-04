import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const io = vi.hoisted(() => ({ traffic: vi.fn(), pages: vi.fn() }));
vi.mock('@/lib/db/ga4', () => ({ getTrafficDailyRows: io.traffic, getTopPagesRows: io.pages }));

let loads;
let oauth;
let credentials;
let report;
let analytics;

beforeEach(() => {
    vi.resetModules();
    io.traffic.mockReset().mockResolvedValue([]);
    io.pages.mockReset().mockResolvedValue([]);
    loads = 0;
    credentials = vi.fn();
    oauth = vi.fn();
    report = vi.fn().mockResolvedValue({ data: { rows: [] } });
    analytics = vi.fn(() => ({ properties: { runReport: report } }));
    vi.stubEnv('CONNECTOR_SAMPLE_MODE', '0');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'fixture-client');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'fixture-secret');
    vi.doMock('googleapis', () => {
        loads += 1;
        class OAuth2 {
            constructor(...args) {
                oauth(...args);
                this.setCredentials = credentials;
            }
        }
        return { google: { auth: { OAuth2 }, analyticsdata: analytics } };
    });
});

afterEach(() => vi.unstubAllEnvs());

describe('GA4 provider contracts with simulated IO', () => {
    it.each([
        ['disabled', 'disabled', 'disabled'],
        ['sample_mode', 'sample_mode', 'sample'],
        ['not_connected', 'not_connected', 'stub'],
    ])('keeps %s reads empty without any database or API call', async (status, expectedStatus, mode) => {
        const { getGa4SnapshotFromDb } = await import('@/lib/connectors/providers/ga4');
        const result = await getGa4SnapshotFromDb({ connection: { status }, clientId: 'client-a' });
        expect(result).toMatchObject({
            provider: 'ga4',
            status: expectedStatus,
            mode,
            hasRealData: false,
            trafficTrend: [],
            landingPages: [],
            attributionSummary: [],
        });
        expect(io.traffic).not.toHaveBeenCalled();
        expect(io.pages).not.toHaveBeenCalled();
        expect(oauth).not.toHaveBeenCalled();
        expect(report).not.toHaveBeenCalled();
    });

    it('preserves a missing connection and the explicit sample override', async () => {
        const { getGa4SnapshotFromDb } = await import('@/lib/connectors/providers/ga4');
        expect(await getGa4SnapshotFromDb({ clientId: 'a' })).toMatchObject({ status: 'not_connected', mode: 'stub' });
        vi.stubEnv('CONNECTOR_SAMPLE_MODE', '1');
        expect(await getGa4SnapshotFromDb({ connection: { status: 'configured' }, clientId: 'b' })).toMatchObject({
            status: 'sample_mode',
            mode: 'sample',
        });
        expect(io.traffic).not.toHaveBeenCalled();
    });

    it('distinguishes a successful empty read from an error', async () => {
        const { getGa4SnapshotFromDb } = await import('@/lib/connectors/providers/ga4');
        const connection = { status: 'configured', last_synced_at: '2020-01-01T00:00:00Z' };
        expect(await getGa4SnapshotFromDb({ connection, clientId: 'a' })).toMatchObject({
            status: 'configured',
            mode: 'configured',
            hasRealData: false,
            lastSyncedAt: connection.last_synced_at,
        });
        io.traffic.mockRejectedValueOnce(new Error('fixture traffic unavailable'));
        expect(await getGa4SnapshotFromDb({ connection, clientId: 'b' })).toMatchObject({
            status: 'error',
            mode: 'error',
            hasRealData: false,
            message: 'fixture traffic unavailable',
            trafficTrend: [],
            landingPages: [],
        });
        expect(report).not.toHaveBeenCalled();
    });

    it('keeps historical zero/null rows and scopes both readers to each client', async () => {
        io.traffic.mockImplementation(async (clientId) => [
            { date: '2020-01-01', sessions: 0, users: clientId === 'a' ? 0 : 2, new_users: null, page_views: 0 },
        ]);
        io.pages.mockImplementation(async (clientId) => [
            { landing_page: '/' + clientId, sessions: 0, users: null, period_end: '2020-01-31' },
        ]);
        const { getGa4SnapshotFromDb } = await import('@/lib/connectors/providers/ga4');
        const [a, b] = await Promise.all(
            ['a', 'b'].map((clientId) => getGa4SnapshotFromDb({ connection: { status: 'healthy' }, clientId })),
        );
        expect(a).toMatchObject({
            hasRealData: true,
            mode: 'real',
            trafficTrend: [{ date: '2020-01-01', sessions: 0, users: 0, new_users: null, page_views: 0 }],
            landingPages: [{ page: '/a', sessions: 0, users: null, period_end: '2020-01-31' }],
        });
        expect(b.trafficTrend[0].users).toBe(2);
        expect(b.landingPages[0].page).toBe('/b');
        for (const id of ['a', 'b']) {
            expect(io.traffic).toHaveBeenCalledWith(id, { days: 28 });
            expect(io.pages).toHaveBeenCalledWith(id, { limit: 20 });
        }
        expect(report).not.toHaveBeenCalled();
    });

    it('keeps a partial configured snapshot when only landing pages exist', async () => {
        io.pages.mockResolvedValue([{ landing_page: '/only', sessions: 0, users: 0 }]);
        const { getGa4SnapshotFromDb } = await import('@/lib/connectors/providers/ga4');
        expect(await getGa4SnapshotFromDb({ connection: { status: 'configured' }, clientId: 'a' })).toMatchObject({
            hasRealData: true,
            mode: 'real',
            trafficTrend: [],
            landingPages: [{ page: '/only', sessions: 0, users: 0 }],
        });
    });

    it('preserves authentication, request dates and zero conversion for traffic fetches', async () => {
        report.mockResolvedValue({
            data: {
                rows: [
                    {
                        dimensionValues: [{ value: '20200102' }],
                        metricValues: [{ value: '0' }, { value: '2' }, { value: '' }, { value: '3' }],
                    },
                ],
            },
        });
        const { fetchGa4TrafficDaily } = await import('@/lib/connectors/providers/ga4');
        expect(
            await fetchGa4TrafficDaily({
                propertyId: '123',
                startDate: '2020-01-01',
                endDate: '2020-01-31',
                googleRefreshToken: 'fixture-refresh',
            }),
        ).toEqual([{ date: '2020-01-02', sessions: 0, users: 2, new_users: 0, page_views: 3 }]);
        expect(oauth).toHaveBeenCalledWith('fixture-client', 'fixture-secret');
        expect(credentials).toHaveBeenCalledWith({ refresh_token: 'fixture-refresh' });
        expect(analytics).toHaveBeenCalledWith({ version: 'v1beta', auth: expect.any(Object) });
        expect(report).toHaveBeenCalledWith({
            property: 'properties/123',
            requestBody: {
                dateRanges: [{ startDate: '2020-01-01', endDate: '2020-01-31' }],
                dimensions: [{ name: 'date' }],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'newUsers' },
                    { name: 'screenPageViews' },
                ],
            },
        });
    });

    it('preserves landing-page requests, limit clamping and missing page values', async () => {
        report.mockResolvedValue({
            data: { rows: [{ dimensionValues: [], metricValues: [{ value: '0' }, { value: '1' }] }] },
        });
        const { fetchGa4TopPages } = await import('@/lib/connectors/providers/ga4');
        expect(
            await fetchGa4TopPages({
                propertyId: '456',
                startDate: '2020-01-01',
                endDate: '2020-01-31',
                limit: 999,
                googleRefreshToken: 'fixture-refresh',
            }),
        ).toEqual([{ landing_page: null, sessions: 0, users: 1 }]);
        expect(report.mock.calls[0][0]).toMatchObject({
            property: 'properties/456',
            requestBody: {
                limit: 100,
                dimensions: [{ name: 'landingPage' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            },
        });
    });

    it('rejects invalid boundary inputs and propagates provider failures', async () => {
        const { fetchGa4TrafficDaily, fetchGa4TopPages } = await import('@/lib/connectors/providers/ga4');
        await expect(fetchGa4TrafficDaily({})).rejects.toThrow('requires propertyId');
        await expect(fetchGa4TopPages({ propertyId: '123' })).rejects.toThrow('googleRefreshToken');
        await expect(
            fetchGa4TrafficDaily({ propertyId: '123', googleRefreshToken: 'fixture', startDate: 'invalid' }),
        ).rejects.toThrow('Invalid GA4 date window');
        expect(report).not.toHaveBeenCalled();
        report.mockRejectedValueOnce(new Error('fixture provider rejected'));
        await expect(
            fetchGa4TopPages({
                propertyId: '123',
                googleRefreshToken: 'fixture',
                startDate: '2020-01-01',
                endDate: '2020-01-31',
            }),
        ).rejects.toThrow('fixture provider rejected');
    });
});

describe('GA4 database read import boundary', () => {
    it('does not load the execution SDK when importing and reading stored data', async () => {
        const { getGa4SnapshotFromDb } = await import('@/lib/connectors/providers/ga4');
        await getGa4SnapshotFromDb({ connection: { status: 'configured' }, clientId: 'a' });
        expect(loads).toBe(0);
        expect(report).not.toHaveBeenCalled();
    });
});
