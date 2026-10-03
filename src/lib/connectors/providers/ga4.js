import 'server-only';

import { google } from 'googleapis';
import { getTrafficDailyRows, getTopPagesRows } from '@/lib/db/ga4';

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function resolveDateWindow({ startDate, endDate } = {}) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid GA4 date window. Expected YYYY-MM-DD compatible dates.');
    }

    if (start > end) {
        throw new Error('Invalid GA4 date window. startDate must be <= endDate.');
    }

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
    };
}

// GA4 returns dates as YYYYMMDD — convert to YYYY-MM-DD for storage.
function parseGa4Date(value) {
    if (!value || value.length !== 8) return value || null;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function metricInt(value) {
    return Number(value || 0);
}

/**
 * Fetch daily traffic totals from the GA4 Data API.
 * Returns an array of { date, sessions, users, new_users, page_views }.
 */
export async function fetchGa4TrafficDaily({ propertyId, startDate, endDate, googleRefreshToken }) {
    if (!propertyId || !String(propertyId).trim()) {
        throw new Error('fetchGa4TrafficDaily requires propertyId.');
    }

    if (!googleRefreshToken) {
        throw new Error('fetchGa4TrafficDaily requires a valid googleRefreshToken for this client.');
    }

    const window = resolveDateWindow({ startDate, endDate });

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: googleRefreshToken });

    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2Client });

    const response = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
            dimensions: [{ name: 'date' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'newUsers' },
                { name: 'screenPageViews' },
            ],
        },
    });

    const rows = response?.data?.rows || [];

    return rows.map((row) => {
        const rawDate = row.dimensionValues?.[0]?.value;
        const [sessions, users, newUsers, pageViews] = (row.metricValues || []).map(
            (m) => m.value,
        );
        return {
            date: parseGa4Date(rawDate),
            sessions: metricInt(sessions),
            users: metricInt(users),
            new_users: metricInt(newUsers),
            page_views: metricInt(pageViews),
        };
    });
}

/**
 * Fetch top landing pages from the GA4 Data API.
 * Returns an array of { landing_page, sessions, users }.
 */
export async function fetchGa4TopPages({ propertyId, startDate, endDate, limit = 20, googleRefreshToken }) {
    if (!propertyId || !String(propertyId).trim()) {
        throw new Error('fetchGa4TopPages requires propertyId.');
    }

    if (!googleRefreshToken) {
        throw new Error('fetchGa4TopPages requires a valid googleRefreshToken for this client.');
    }

    const window = resolveDateWindow({ startDate, endDate });

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: googleRefreshToken });

    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2Client });

    const response = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
            dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
            dimensions: [{ name: 'landingPage' }],
            metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: Math.max(1, Math.min(Number(limit), 100)),
        },
    });

    const rows = response?.data?.rows || [];

    return rows.map((row) => {
        const landingPage = row.dimensionValues?.[0]?.value || null;
        const [sessions, users] = (row.metricValues || []).map((m) => m.value);
        return {
            landing_page: landingPage,
            sessions: metricInt(sessions),
            users: metricInt(users),
        };
    });
}

/**
 * Build a connector snapshot by reading from ga4_traffic_daily and ga4_top_pages.
 * Returns hasRealData: true when rows are present, false when empty or not connected.
 */
export async function getGa4SnapshotFromDb({ connection, clientId }) {
    if (connection?.status === 'disabled') {
        return {
            provider: 'ga4',
            status: 'disabled',
            hasRealData: false,
            mode: 'disabled',
            message: 'GA4 connector is disabled for this client.',
            trafficTrend: [],
            landingPages: [],
            attributionSummary: [],
        };
    }

    if (connection?.status === 'sample_mode' || process.env.CONNECTOR_SAMPLE_MODE === '1') {
        return {
            provider: 'ga4',
            status: 'sample_mode',
            hasRealData: false,
            mode: 'sample',
            message: 'Sample mode only. No real GA4 data is collected; charts stay empty by design.',
            trafficTrend: [],
            landingPages: [],
            attributionSummary: [],
        };
    }

    if (!connection || connection.status === 'not_connected') {
        return {
            provider: 'ga4',
            status: 'not_connected',
            hasRealData: false,
            mode: 'stub',
            message: 'GA4 is not connected.',
            trafficTrend: [],
            landingPages: [],
            attributionSummary: [],
        };
    }

    try {
        const [trafficRows, pageRows] = await Promise.all([
            getTrafficDailyRows(clientId, { days: 28 }),
            getTopPagesRows(clientId, { limit: 20 }),
        ]);

        if (!trafficRows.length && !pageRows.length) {
            return {
                provider: 'ga4',
                status: connection.status,
                hasRealData: false,
                mode: 'configured',
                message: 'GA4 connector is configured. No data synced yet.',
                trafficTrend: [],
                landingPages: [],
                attributionSummary: [],
                lastSyncedAt: connection.last_synced_at || null,
            };
        }

        const trafficTrend = trafficRows.map((row) => ({
            date: row.date,
            sessions: row.sessions,
            users: row.users,
            new_users: row.new_users,
            page_views: row.page_views,
        }));

        const landingPages = pageRows.map((row) => ({
            page: row.landing_page,
            sessions: row.sessions,
            users: row.users,
            period_end: row.period_end,
        }));

        return {
            provider: 'ga4',
            status: connection.status,
            hasRealData: true,
            mode: 'real',
            message: `GA4 data: ${trafficRows.length} daily rows, ${pageRows.length} landing pages.`,
            trafficTrend,
            landingPages,
            attributionSummary: [],
            lastSyncedAt: connection.last_synced_at || null,
        };
    } catch (error) {
        return {
            provider: 'ga4',
            status: 'error',
            hasRealData: false,
            mode: 'error',
            message: error.message,
            trafficTrend: [],
            landingPages: [],
            attributionSummary: [],
        };
    }
}
