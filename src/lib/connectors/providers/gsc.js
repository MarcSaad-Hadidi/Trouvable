import 'server-only';

import { getRecentGscRows } from '@/lib/db/gsc';

const SUPPORTED_DIMENSIONS = new Set(['date', 'query', 'page', 'country', 'device', 'searchAppearance']);
const SUPPORTED_SEARCH_TYPES = new Set(['web', 'image', 'video', 'news', 'discover', 'googleNews']);
const MAX_FETCH_ROWS = 500000;
let googleApiPromise = null;

async function getGoogleApi() {
    googleApiPromise ||= import('googleapis').then((mod) => mod.google);
    return googleApiPromise;
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function resolveDateWindow({ startDate, endDate } = {}) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - (27 * 24 * 60 * 60 * 1000));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid GSC date window. Expected YYYY-MM-DD compatible dates.');
    }

    if (start > end) {
        throw new Error('Invalid GSC date window. startDate must be <= endDate.');
    }

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
    };
}

function clampRowLimit(value, fallback = 25000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(Math.floor(parsed), 25000));
}

function clampMaxRows(value, fallback = 25000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(Math.floor(parsed), MAX_FETCH_ROWS));
}

function normalizeDimensions(dimensions = []) {
    const input = Array.isArray(dimensions) ? dimensions : [];
    const deduped = [];
    const seen = new Set();

    for (const item of input) {
        const key = String(item || '').trim();
        if (!key || !SUPPORTED_DIMENSIONS.has(key) || seen.has(key)) continue;
        seen.add(key);
        deduped.push(key);
    }

    return deduped;
}

function normalizeSearchType(value) {
    const input = String(value || 'web').trim();
    if (SUPPORTED_SEARCH_TYPES.has(input)) return input;
    return 'web';
}

function normalizeCountry(value) {
    const input = String(value || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(input) ? input : null;
}

function normalizeDevice(value) {
    const input = String(value || '').trim().toUpperCase();
    if (input === 'DESKTOP' || input === 'MOBILE' || input === 'TABLET') return input;
    return null;
}

function buildDimensionFilterGroups({ country, device }) {
    const filters = [];

    if (country) {
        filters.push({
            dimension: 'country',
            operator: 'equals',
            expression: country,
        });
    }

    if (device) {
        filters.push({
            dimension: 'device',
            operator: 'equals',
            expression: device,
        });
    }

    if (filters.length === 0) return undefined;
    return [{ groupType: 'and', filters }];
}

function normalizeRawRow(row, dimensions) {
    const keys = Array.isArray(row?.keys) ? row.keys : [];
    const byDimension = {};

    for (let index = 0; index < dimensions.length; index += 1) {
        byDimension[dimensions[index]] = keys[index] ?? null;
    }

    return {
        keys,
        dimensions: byDimension,
        clicks: Number(row?.clicks || 0),
        impressions: Number(row?.impressions || 0),
        ctr: Number(row?.ctr || 0),
        position: Number(row?.position || 0),
    };
}

export function hasGscServiceAccountCredentials(env = process.env) {
    return Boolean(String(env.GOOGLE_SC_CLIENT_EMAIL || '').trim() && String(env.GOOGLE_SC_PRIVATE_KEY || '').trim());
}

function normalizePrivateKey(value) {
    return String(value || '').replace(/\\n/g, '\n');
}

function isInvalidOAuthClientError(error) {
    const code = String(error?.response?.data?.error || error?.code || error?.message || '').toLowerCase();
    return code.includes('invalid_client');
}

function buildOAuthAuth(google, googleRefreshToken) {
    if (!googleRefreshToken) return null;

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: googleRefreshToken });
    return oauth2Client;
}

function buildServiceAccountAuth(google) {
    if (!hasGscServiceAccountCredentials()) return null;

    return new google.auth.JWT({
        email: process.env.GOOGLE_SC_CLIENT_EMAIL,
        key: normalizePrivateKey(process.env.GOOGLE_SC_PRIVATE_KEY),
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
}

/**
 * Query Search Console Search Analytics and return raw rows with explicit dimension keys.
 * Supports date/query/page/country/device dimensions, search type, and country/device filters.
 */
export async function queryGscSearchAnalyticsRaw({
    siteUrl,
    startDate,
    endDate,
    dimensions = ['query', 'page'],
    searchType = 'web',
    country = null,
    device = null,
    rowLimit = 25000,
    maxRows = null,
    startRow = 0,
    dataState = undefined,
    googleRefreshToken,
}) {
    if (!siteUrl || !String(siteUrl).trim()) {
        throw new Error('queryGscSearchAnalyticsRaw requires siteUrl.');
    }

    const window = resolveDateWindow({ startDate, endDate });
    const normalizedDimensions = normalizeDimensions(dimensions);
    if (normalizedDimensions.length === 0) {
        throw new Error('queryGscSearchAnalyticsRaw requires at least one supported dimension.');
    }

    const normalizedSearchType = normalizeSearchType(searchType);
    const normalizedCountry = normalizeCountry(country);
    const normalizedDevice = normalizeDevice(device);
    const limitPerPage = clampRowLimit(rowLimit, 25000);
    const requestedMaxRows = (maxRows === null || maxRows === undefined)
        ? limitPerPage
        : clampMaxRows(maxRows, limitPerPage);
    const maxAllowedRows = Math.max(limitPerPage, requestedMaxRows);

    const google = await getGoogleApi();
    const authCandidates = [
        { source: 'oauth', auth: buildOAuthAuth(google, googleRefreshToken) },
        { source: 'service_account', auth: buildServiceAccountAuth(google) },
    ].filter((candidate) => candidate.auth);

    if (authCandidates.length === 0) {
        throw new Error('queryGscSearchAnalyticsRaw requires Google OAuth or Search Console service-account credentials.');
    }

    async function queryWithAuth(auth) {
        const webmasters = google.webmasters({ version: 'v3', auth });
        const rows = [];
        const offsetStart = Math.max(0, Number(startRow) || 0);
        let offset = offsetStart;
        let complete = true;

        while (rows.length < maxAllowedRows) {
            const remaining = maxAllowedRows - rows.length;
            const batchSize = Math.max(1, Math.min(limitPerPage, remaining));
            const requestBody = {
                startDate: window.startDate,
                endDate: window.endDate,
                dimensions: normalizedDimensions,
                aggregationType: 'auto',
                searchType: normalizedSearchType,
                rowLimit: batchSize,
                startRow: offset,
                dimensionFilterGroups: buildDimensionFilterGroups({
                    country: normalizedCountry,
                    device: normalizedDevice,
                }),
                ...(dataState ? { dataState } : {}),
            };

            const response = await webmasters.searchanalytics.query({
                siteUrl,
                requestBody,
            });

            const pageRows = response?.data?.rows || [];
            rows.push(...pageRows.map((row) => normalizeRawRow(row, normalizedDimensions)));

            if (pageRows.length < batchSize) break;
            offset += pageRows.length;

            if (rows.length >= maxAllowedRows) {
                complete = false;
                break;
            }
        }

        return { rows, offsetStart, complete };
    }

    let queried = null;
    let authSource = null;

    for (let index = 0; index < authCandidates.length; index += 1) {
        const candidate = authCandidates[index];
        try {
            queried = await queryWithAuth(candidate.auth);
            authSource = candidate.source;
            break;
        } catch (error) {
            const canFallback = candidate.source === 'oauth'
                && authCandidates[index + 1]?.source === 'service_account'
                && isInvalidOAuthClientError(error);
            if (!canFallback) throw error;
        }
    }

    return {
        rows: queried.rows,
        meta: {
            siteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
            dimensions: normalizedDimensions,
            searchType: normalizedSearchType,
            country: normalizedCountry,
            device: normalizedDevice,
            rowLimit: limitPerPage,
            maxRows: maxAllowedRows,
            returnedRows: queried.rows.length,
            startRow: queried.offsetStart,
            complete: queried.complete,
            authSource,
        },
    };
}

/**
 * Query Search Console Search Analytics with a minimal scope returning query+page rows.
 */
export async function fetchGscSearchAnalytics({
    siteUrl,
    startDate,
    endDate,
    rowLimit = 1000,
    googleRefreshToken
}) {
    const result = await queryGscSearchAnalyticsRaw({
        siteUrl,
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: clampRowLimit(rowLimit, 1000),
        maxRows: clampRowLimit(rowLimit, 1000),
        googleRefreshToken,
    });

    return result.rows.map((row) => {
        const query = row.dimensions?.query;
        const page = row.dimensions?.page;
        return {
            query: query || null,
            page: page || null,
            clicks: Number(row.clicks || 0),
            impressions: Number(row.impressions || 0),
            ctr: Number(row.ctr || 0),
            position: Number(row.position || 0),
        };
    });
}

/**
 * Build a connector snapshot by reading from the gsc_search_analytics DB table.
 * Returns hasRealData: true when rows are present, false when empty or not connected.
 */
export async function getGscSnapshotFromDb({ connection, clientId }) {
    if (connection?.status === 'disabled') {
        return {
            provider: 'gsc',
            status: 'disabled',
            hasRealData: false,
            mode: 'disabled',
            message: 'GSC connector is disabled for this client.',
            searchQueryTrend: [],
            landingPageTrend: [],
        };
    }

    if (connection?.status === 'sample_mode' || process.env.CONNECTOR_SAMPLE_MODE === '1') {
        return {
            provider: 'gsc',
            status: 'sample_mode',
            hasRealData: false,
            mode: 'sample',
            message: 'Sample mode only. No real GSC data is collected; tables stay empty by design.',
            searchQueryTrend: [],
            landingPageTrend: [],
        };
    }

    if (!connection || connection.status === 'not_connected') {
        return {
            provider: 'gsc',
            status: 'not_connected',
            hasRealData: false,
            mode: 'stub',
            message: 'GSC is not connected.',
            searchQueryTrend: [],
            landingPageTrend: [],
        };
    }

    try {
        const rows = await getRecentGscRows(clientId, { days: 28, limit: 500 });

        if (!rows || rows.length === 0) {
            return {
                provider: 'gsc',
                status: connection.status,
                hasRealData: false,
                mode: 'configured',
                message: 'GSC connector is configured. No data synced yet.',
                searchQueryTrend: [],
                landingPageTrend: [],
                lastSyncedAt: connection.last_synced_at || null,
            };
        }

        const byQuery = new Map();
        const byPage = new Map();

        for (const row of rows) {
            if (row.query) {
                if (!byQuery.has(row.query)) {
                    byQuery.set(row.query, { query: row.query, clicks: 0, impressions: 0, ctrSum: 0, positionSum: 0, count: 0 });
                }
                const q = byQuery.get(row.query);
                q.clicks += Number(row.clicks || 0);
                q.impressions += Number(row.impressions || 0);
                q.ctrSum += Number(row.ctr || 0);
                q.positionSum += Number(row.position || 0);
                q.count += 1;
            }
            if (row.page) {
                if (!byPage.has(row.page)) {
                    byPage.set(row.page, { page: row.page, clicks: 0, impressions: 0 });
                }
                const p = byPage.get(row.page);
                p.clicks += Number(row.clicks || 0);
                p.impressions += Number(row.impressions || 0);
            }
        }

        const searchQueryTrend = [...byQuery.values()]
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 20)
            .map(({ query, clicks, impressions, ctrSum, positionSum, count }) => ({
                query,
                clicks,
                impressions,
                ctr: count > 0 ? ctrSum / count : 0,
                average_position: count > 0 ? positionSum / count : 0,
            }));

        const landingPageTrend = [...byPage.values()]
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 20)
            .map(({ page, clicks, impressions }) => ({
                page,
                sessions: clicks,
                clicks,
                impressions,
            }));

        return {
            provider: 'gsc',
            status: connection.status,
            hasRealData: true,
            mode: 'real',
            message: `GSC data: ${rows.length} rows over the last 28 days.`,
            searchQueryTrend,
            landingPageTrend,
            lastSyncedAt: connection.last_synced_at || null,
        };
    } catch (error) {
        return {
            provider: 'gsc',
            status: 'error',
            hasRealData: false,
            mode: 'error',
            message: error.message,
            searchQueryTrend: [],
            landingPageTrend: [],
        };
    }
}
