import 'server-only';

import { getTrafficDailyRows, getTopPagesRows } from '@/lib/db/ga4';
import { getClientConnectorRows } from '@/lib/connectors/repository';
import { queryGscSearchAnalyticsRaw } from '@/lib/connectors/providers/gsc';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { resolveGscProperty as resolveGscPropertyShared } from '@/lib/seo/gsc-property';

const RANGE_TO_DAYS = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '12m': 365,
};

const GSC_ROW_LIMIT = 25000;
const GSC_MAX_ROWS = 200000;

const SEARCH_TYPES = new Set(['web', 'image', 'video', 'news', 'discover', 'googleNews']);

const BRAND_STOPWORDS = new Set([
    'inc',
    'corp',
    'co',
    'compagnie',
    'company',
    'groupe',
    'group',
    'les',
    'des',
    'pour',
    'avec',
    'sur',
    'dans',
    'and',
    'the',
    'sas',
    'sarl',
    'sa',
    'ltd',
    'llc',
    'studio',
    'agence',
]);

const INTENT_LABELS = ['Transactionnel', 'Informationnel', 'Navigationnel', 'Commercial'];

function toNumber(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
}

function sumField(rows, field) {
    return (rows || []).reduce((acc, row) => acc + toNumber(row?.[field]), 0);
}

function normalizeRange(value) {
    const raw = String(value || '').trim();
    return Object.prototype.hasOwnProperty.call(RANGE_TO_DAYS, raw) ? raw : '30d';
}

function normalizeSegment(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'brand') return 'brand';
    if (raw === 'nonbrand') return 'nonbrand';
    return 'all';
}

function normalizeSearchType(value) {
    const raw = String(value || 'web').trim();
    return SEARCH_TYPES.has(raw) ? raw : 'web';
}

function normalizeCountry(value) {
    const raw = String(value || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(raw) ? raw : null;
}

function normalizeDevice(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'DESKTOP' || raw === 'MOBILE' || raw === 'TABLET') return raw;
    return null;
}

function normalizeBoolean(value) {
    return value === true || value === 'true' || value === '1' || value === 1;
}

function normalizeDebugRawMode(value) {
    if (value === 'full') return 'full';
    if (normalizeBoolean(value)) return 'sample';
    return 'off';
}

function formatDateYmd(date) {
    return date.toISOString().slice(0, 10);
}

function shiftDateYmd(ymd, offsetDays) {
    const [year, month, day] = String(ymd || '').split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return formatDateYmd(date);
}

function resolveWindow(range) {
    const currentDays = RANGE_TO_DAYS[normalizeRange(range)];
    const endDate = formatDateYmd(new Date());
    const currentStartDate = shiftDateYmd(endDate, -(currentDays - 1));
    const previousEndDate = shiftDateYmd(currentStartDate, -1);
    const previousStartDate = shiftDateYmd(previousEndDate, -(currentDays - 1));

    return {
        range: normalizeRange(range),
        currentDays,
        startDate: previousStartDate,
        endDate,
        currentStartDate,
        previousStartDate,
        previousEndDate,
    };
}

function rowDate(row) {
    return String(row?.dimensions?.date || row?.date || '').trim();
}

function filterRowsBetween(rows, startDate, endDate) {
    return (rows || []).filter((row) => {
        const date = rowDate(row);
        if (!date) return false;
        return date >= startDate && date <= endDate;
    });
}

function getLatestObservedDate(rows) {
    return (rows || [])
        .map((row) => rowDate(row))
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left))[0] || null;
}

function getObservedAgeDays(dateString) {
    if (!dateString) return null;

    const timestamp = new Date(`${dateString}T00:00:00Z`).getTime();
    if (Number.isNaN(timestamp)) return null;

    return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function resolveConnectorStatus(rows, provider) {
    const row = (rows || []).find((r) => r.provider === provider) || null;
    if (!row || row.status === 'not_connected') {
        return { status: 'not_connected', lastSyncedAt: null, lastError: null };
    }
    return {
        status: row.status,
        lastSyncedAt: row.last_synced_at || null,
        lastError: row.last_error || null,
    };
}

function buildFreshness(sourceLabel, connector, rows, { unavailableDetail = null } = {}) {
    const lastObservedDate = getLatestObservedDate(rows);
    const ageDays = getObservedAgeDays(lastObservedDate);

    if (!lastObservedDate) {
        return {
            label: sourceLabel,
            status: connector.status === 'not_connected' ? 'unavailable' : 'warning',
            lastObservedDate: null,
            lastSyncedAt: connector.lastSyncedAt,
            detail: unavailableDetail || (connector.status === 'not_connected'
                ? 'Source non connectée pour ce mandat.'
                : 'Source connectée sans données observées sur la fenêtre active.'),
            reliability: connector.status === 'not_connected' ? 'unavailable' : 'warning',
        };
    }

    const status = ageDays === null ? 'warning' : ageDays <= 3 ? 'ok' : ageDays <= 7 ? 'warning' : 'critical';

    return {
        label: sourceLabel,
        status,
        lastObservedDate,
        lastSyncedAt: connector.lastSyncedAt,
        detail: ageDays === null
            ? 'Date observée non exploitable proprement.'
            : ageDays <= 3
                ? 'Données fraîches sur la fenêtre SEO active.'
                : ageDays <= 7
                    ? 'Données utilisables, mais à surveiller.'
                    : 'Données anciennes pour un pilotage quotidien.',
        reliability: 'measured',
    };
}

function weightedPosition(impressions, weightedPositionSum, fallbackPositionSum, fallbackCount) {
    if (impressions > 0) return weightedPositionSum / impressions;
    if (fallbackCount > 0) return fallbackPositionSum / fallbackCount;
    return null;
}

function aggregateRowsByDimension(rows, dimension) {
    const aggregated = new Map();

    for (const row of rows || []) {
        const key = String(row?.dimensions?.[dimension] || '').trim();
        if (!key) continue;

        if (!aggregated.has(key)) {
            aggregated.set(key, {
                key,
                clicks: 0,
                impressions: 0,
                weightedPositionSum: 0,
                fallbackPositionSum: 0,
                fallbackCount: 0,
            });
        }

        const bucket = aggregated.get(key);
        const clicks = toNumber(row.clicks);
        const impressions = toNumber(row.impressions);
        const position = toNumber(row.position);

        bucket.clicks += clicks;
        bucket.impressions += impressions;
        bucket.weightedPositionSum += impressions > 0 ? position * impressions : 0;
        if (position > 0) {
            bucket.fallbackPositionSum += position;
            bucket.fallbackCount += 1;
        }
    }

    return Array.from(aggregated.values())
        .map((bucket) => ({
            [dimension]: bucket.key,
            clicks: bucket.clicks,
            impressions: bucket.impressions,
            ctr: bucket.impressions > 0 ? bucket.clicks / bucket.impressions : null,
            position: weightedPosition(
                bucket.impressions,
                bucket.weightedPositionSum,
                bucket.fallbackPositionSum,
                bucket.fallbackCount,
            ),
        }))
        .sort((left, right) => {
            const clicksDelta = right.clicks - left.clicks;
            if (clicksDelta !== 0) return clicksDelta;
            return right.impressions - left.impressions;
        });
}

function aggregateDailySearchRows(rows) {
    const aggregated = new Map();

    for (const row of rows || []) {
        const date = rowDate(row);
        if (!date) continue;

        if (!aggregated.has(date)) {
            aggregated.set(date, {
                date,
                clicks: 0,
                impressions: 0,
                weightedPositionSum: 0,
                fallbackPositionSum: 0,
                fallbackCount: 0,
            });
        }

        const bucket = aggregated.get(date);
        const clicks = toNumber(row.clicks);
        const impressions = toNumber(row.impressions);
        const position = toNumber(row.position);

        bucket.clicks += clicks;
        bucket.impressions += impressions;
        bucket.weightedPositionSum += impressions > 0 ? position * impressions : 0;
        if (position > 0) {
            bucket.fallbackPositionSum += position;
            bucket.fallbackCount += 1;
        }
    }

    return Array.from(aggregated.values())
        .map((bucket) => ({
            date: bucket.date,
            clicks: bucket.clicks,
            impressions: bucket.impressions,
            ctr: bucket.impressions > 0 ? bucket.clicks / bucket.impressions : null,
            position: weightedPosition(
                bucket.impressions,
                bucket.weightedPositionSum,
                bucket.fallbackPositionSum,
                bucket.fallbackCount,
            ),
        }))
        .sort((left, right) => left.date.localeCompare(right.date));
}

function buildComparison(currentRows, previousRows) {
    const currentClicks = sumField(currentRows, 'clicks');
    const currentImpressions = sumField(currentRows, 'impressions');
    const previousClicks = sumField(previousRows, 'clicks');
    const previousImpressions = sumField(previousRows, 'impressions');

    const currentCtr = currentImpressions > 0 ? currentClicks / currentImpressions : null;
    const previousCtr = previousImpressions > 0 ? previousClicks / previousImpressions : null;

    const currentPositionRows = aggregateDailySearchRows(currentRows);
    const previousPositionRows = aggregateDailySearchRows(previousRows);
    const currentPosition = currentPositionRows.length > 0
        ? currentPositionRows.reduce((sum, row) => sum + toNumber(row.position), 0) / currentPositionRows.length
        : null;
    const previousPosition = previousPositionRows.length > 0
        ? previousPositionRows.reduce((sum, row) => sum + toNumber(row.position), 0) / previousPositionRows.length
        : null;

    const deltaPercent = (currentValue, previousValue) => {
        if (!Number.isFinite(previousValue) || previousValue === 0) return null;
        return ((currentValue - previousValue) / previousValue) * 100;
    };

    return {
        clicksDeltaPercent: deltaPercent(currentClicks, previousClicks),
        impressionsDeltaPercent: deltaPercent(currentImpressions, previousImpressions),
        ctrDeltaPercent: currentCtr === null || previousCtr === null || previousCtr === 0
            ? null
            : ((currentCtr - previousCtr) / previousCtr) * 100,
        positionDelta: currentPosition === null || previousPosition === null
            ? null
            : currentPosition - previousPosition,
    };
}

function normalizeToken(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function extractBrandTokens(clientName) {
    return normalizeToken(clientName)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !BRAND_STOPWORDS.has(token));
}

function buildBrandSplit(clientName, queryRows) {
    const tokens = extractBrandTokens(clientName);

    if (tokens.length === 0) {
        return {
            status: 'unavailable',
            reason: 'Nom de marque trop générique pour segmenter proprement les requêtes.',
            reliability: 'unavailable',
        };
    }

    const brand = { clicks: 0, impressions: 0, queryCount: 0 };
    const nonBrand = { clicks: 0, impressions: 0, queryCount: 0 };

    for (const row of queryRows || []) {
        const query = normalizeToken(row.query);
        const isBrand = tokens.some((token) => query.includes(token));
        const bucket = isBrand ? brand : nonBrand;

        bucket.clicks += toNumber(row.clicks);
        bucket.impressions += toNumber(row.impressions);
        bucket.queryCount += 1;
    }

    if (brand.queryCount === 0) {
        return {
            status: 'unavailable',
            reason: 'Aucune requête de marque détectée de manière fiable dans les données actuelles.',
            reliability: 'unavailable',
            tokens,
        };
    }

    const totalClicks = brand.clicks + nonBrand.clicks;
    const totalImpressions = brand.impressions + nonBrand.impressions;

    return {
        status: 'available',
        tokens,
        brand,
        nonBrand,
        clickShare: totalClicks > 0 ? brand.clicks / totalClicks : null,
        impressionShare: totalImpressions > 0 ? brand.impressions / totalImpressions : null,
        reliability: 'calculated',
    };
}

function inferIntent(query, brandTokens = []) {
    const normalized = normalizeToken(query);

    if (!normalized) return 'Informationnel';
    if (brandTokens.some((token) => normalized.includes(token))) return 'Navigationnel';
    if (/(guide|comment|analyse|definition|c'est quoi|pourquoi|tutoriel|checklist|audit)/.test(normalized)) return 'Informationnel';
    if (/(prix|tarif|devis|contact|demo|essai|plateforme|logiciel|outil|solution)/.test(normalized)) return 'Transactionnel';
    if (/(comparatif|comparaison|meilleur|agence|consultant|service)/.test(normalized)) return 'Commercial';
    return 'Informationnel';
}

function buildQuerySparklineMap(rows) {
    const buckets = new Map();

    for (const row of rows || []) {
        const query = String(row?.dimensions?.query || '').trim();
        const date = rowDate(row);
        if (!query || !date) continue;

        if (!buckets.has(query)) buckets.set(query, new Map());
        const queryBucket = buckets.get(query);
        const entry = queryBucket.get(date) || { date, impressions: 0, clicks: 0 };
        entry.impressions += toNumber(row.impressions);
        entry.clicks += toNumber(row.clicks);
        queryBucket.set(date, entry);
    }

    return new Map(
        Array.from(buckets.entries()).map(([query, dateMap]) => ([
            query,
            Array.from(dateMap.values())
                .sort((left, right) => left.date.localeCompare(right.date))
                .map((entry) => ({
                    date: entry.date,
                    value: entry.impressions > 0 ? entry.impressions : entry.clicks,
                })),
        ])),
    );
}

function buildTopQueryRows(currentRows, previousRows, brandTokens) {
    const currentAgg = aggregateRowsByDimension(currentRows, 'query');
    const previousAgg = aggregateRowsByDimension(previousRows, 'query');
    const previousMap = new Map(previousAgg.map((row) => [row.query, row]));
    const sparklineMap = buildQuerySparklineMap(currentRows);

    return currentAgg.map((row) => {
        const previous = previousMap.get(row.query) || null;
        const previousPosition = previous?.position ?? null;
        const currentPosition = row.position ?? null;
        const positionDelta = previousPosition === null || currentPosition === null
            ? null
            : previousPosition - currentPosition;

        return {
            ...row,
            intent: inferIntent(row.query, brandTokens),
            positionDelta,
            sparkline: sparklineMap.get(row.query) || [],
        };
    });
}

function buildIntentBreakdown(queryRows) {
    const counts = new Map(INTENT_LABELS.map((label) => [label, 0]));
    const total = Math.max(queryRows.length, 1);

    for (const row of queryRows || []) {
        const intent = INTENT_LABELS.includes(row.intent) ? row.intent : 'Informationnel';
        counts.set(intent, (counts.get(intent) || 0) + 1);
    }

    return INTENT_LABELS.map((label) => ({
        name: label,
        count: counts.get(label) || 0,
        percent: Math.round(((counts.get(label) || 0) / total) * 100),
    }));
}

function buildMovers(queryRows) {
    const comparableRows = (queryRows || []).filter((row) => Number.isFinite(Number(row.positionDelta)) && Number(row.positionDelta) !== 0);
    const winners = comparableRows
        .filter((row) => Number(row.positionDelta) > 0)
        .sort((left, right) => Number(right.positionDelta) - Number(left.positionDelta))
        .slice(0, 3);
    const losers = comparableRows
        .filter((row) => Number(row.positionDelta) < 0)
        .sort((left, right) => Number(left.positionDelta) - Number(right.positionDelta))
        .slice(0, 3);

    return { winners, losers };
}

function buildUnavailableDeviceSplit(detail) {
    return {
        status: 'unavailable',
        reason: 'Aucune donnée appareil exploitable pour la fenêtre et les filtres demandés.',
        detail,
        reliability: 'unavailable',
        totalSearches: null,
        categories: [],
    };
}

function buildDeviceSplit(rows, unavailableDetail = null) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return buildUnavailableDeviceSplit(unavailableDetail || 'La source GSC ne retourne aucune ligne appareil sur cette fenêtre.');
    }

    let desktopImpressions = 0;
    let mobileImpressions = 0;
    let excludedImpressions = 0;

    for (const row of rows) {
        const device = String(row?.dimensions?.device || '').trim().toUpperCase();
        const impressions = toNumber(row?.impressions);
        if (device === 'DESKTOP') {
            desktopImpressions += impressions;
        } else if (device === 'MOBILE') {
            mobileImpressions += impressions;
        } else {
            excludedImpressions += impressions;
        }
    }

    const mappedTotal = desktopImpressions + mobileImpressions;
    if (mappedTotal <= 0) {
        return buildUnavailableDeviceSplit(
            unavailableDetail
            || (excludedImpressions > 0
                ? 'Les impressions disponibles sont uniquement tablette/autres, sans ligne ordinateur/telephone exploitable.'
                : 'Les lignes appareil existent, mais sans impressions exploitables.'),
        );
    }

    const categories = [
        { name: 'Ordinateur', color: '#818cf8', count: desktopImpressions },
        { name: 'Telephone', color: '#34d399', count: mobileImpressions },
    ]
        .filter((item) => item.count > 0)
        .map((item) => ({
            ...item,
            value: mappedTotal > 0 ? Number(((item.count / mappedTotal) * 100).toFixed(1)) : 0,
        }));

    const detailParts = [];
    if (excludedImpressions > 0) {
        detailParts.push(`${Math.round(excludedImpressions)} impressions tablette/autres exclues du donut ordinateur/telephone.`);
    }
    if (unavailableDetail) {
        detailParts.push(unavailableDetail);
    }

    return {
        status: categories.length > 0 ? 'available' : 'unavailable',
        reliability: categories.length > 0 ? 'measured' : 'unavailable',
        totalSearches: Math.round(mappedTotal),
        categories,
        detail: detailParts.length > 0 ? detailParts.join(' ') : null,
        excludedImpressions: Math.round(excludedImpressions),
        ...(categories.length > 0 ? {} : buildUnavailableDeviceSplit(unavailableDetail)),
    };

    /*

    const labels = [
        { key: 'DESKTOP', name: 'Ordinateur', color: '#818cf8' },
        { key: 'MOBILE', name: 'Téléphone', color: '#34d399' },
        { key: 'TABLET', name: 'Tablette', color: '#f59e0b' },
        { key: 'OTHER', name: 'Autres', color: '#f87171' },
    ];

    const categories = labels
        .map((item) => {
            const count = byDevice.get(item.key) || 0;
            return {
                name: item.name,
                color: item.color,
                count,
                value: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
            };
        })
        .filter((item) => item.count > 0);

    return {
        status: categories.length > 0 ? 'available' : 'unavailable',
        reliability: categories.length > 0 ? 'measured' : 'unavailable',
        totalSearches: Math.round(total),
        categories,
        ...(categories.length > 0 ? {} : buildUnavailableDeviceSplit(unavailableDetail)),
    };
    */
}

function isBrandQuery(query, tokens = []) {
    const normalized = normalizeToken(query);
    return tokens.some((token) => normalized.includes(token));
}

function applySegmentFilter(queries, segment, brandTokens) {
    if (segment === 'brand') {
        return (queries || []).filter((row) => isBrandQuery(row.query, brandTokens));
    }
    if (segment === 'nonbrand') {
        return (queries || []).filter((row) => !isBrandQuery(row.query, brandTokens));
    }
    return queries || [];
}

/* Re-export the shared property resolver under the original local name so
   the rest of this file stays unchanged. The shared module in
   `lib/seo/gsc-property.js` is the single source of truth used by both
   the read-side here and the write-side sync in `gsc-sync.js`. */
const resolveGscProperty = resolveGscPropertyShared;

function buildGscUnavailableReason({ gscStatus, siteUrl, refreshToken, fetchError }) {
    if (gscStatus?.status === 'disabled') return 'Le connecteur Search Console est désactivé pour ce mandat.';
    if (gscStatus?.status === 'sample_mode') return 'Le connecteur Search Console est en mode échantillon, sans données brutes exploitables.';
    if (fetchError) return fetchError.message;
    if (!siteUrl) return 'Aucune propriété GSC exploitable n’est configurée pour ce mandat.';
    if (!refreshToken) return 'Le refresh token Google manque pour interroger la Search Console en direct.';
    if (gscStatus.status === 'not_connected') return 'Le connecteur Search Console n’est pas connecté.';
    return 'Données Search Console indisponibles pour cette demande.';
}

function buildRawSample(rows, limit = 20) {
    return (rows || []).slice(0, limit).map((row) => ({
        keys: row.keys || [],
        dimensions: row.dimensions || {},
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
    }));
}

async function getClientProfile(clientId) {
    const { data } = await getAdminSupabase()
        .from('client_geo_profiles')
        .select('client_name, website_url')
        .eq('id', clientId)
        .maybeSingle();

    return {
        clientName: String(data?.client_name || '').trim(),
        websiteUrl: String(data?.website_url || '').trim(),
    };
}

async function fetchLiveGscData({ siteUrl, refreshToken, window, filters }) {
    const [queryResponse, pageResponse, deviceResponse] = await Promise.all([
        queryGscSearchAnalyticsRaw({
            siteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
            dimensions: ['date', 'query'],
            searchType: filters.searchType,
            country: filters.country,
            device: filters.device,
            rowLimit: GSC_ROW_LIMIT,
            maxRows: GSC_MAX_ROWS,
            googleRefreshToken: refreshToken,
        }),
        queryGscSearchAnalyticsRaw({
            siteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
            dimensions: ['date', 'page'],
            searchType: filters.searchType,
            country: filters.country,
            device: filters.device,
            rowLimit: GSC_ROW_LIMIT,
            maxRows: GSC_MAX_ROWS,
            googleRefreshToken: refreshToken,
        }),
        queryGscSearchAnalyticsRaw({
            siteUrl,
            startDate: window.currentStartDate,
            endDate: window.endDate,
            dimensions: ['device'],
            searchType: filters.searchType,
            country: filters.country,
            device: filters.device,
            rowLimit: GSC_ROW_LIMIT,
            maxRows: GSC_MAX_ROWS,
            googleRefreshToken: refreshToken,
        }),
    ]);

    return {
        query: queryResponse,
        page: pageResponse,
        device: deviceResponse,
    };
}

export async function getVisibilitySlice(clientId, options = {}) {
    const range = normalizeRange(options.range);
    const segment = normalizeSegment(options.segment);
    const filters = {
        searchType: normalizeSearchType(options.searchType),
        country: normalizeCountry(options.country),
        device: normalizeDevice(options.device),
    };
    const debugRawMode = normalizeDebugRawMode(options.debugRaw);
    const window = resolveWindow(range);
    const ga4Days = Math.max(56, window.currentDays * 2);

    const [clientProfile, connectorRows, trafficRows, ga4TopPages] = await Promise.all([
        getClientProfile(clientId).catch(() => ({ clientName: '', websiteUrl: '' })),
        getClientConnectorRows(clientId).catch(() => []),
        getTrafficDailyRows(clientId, { days: ga4Days }).catch(() => []),
        getTopPagesRows(clientId, { limit: 20 }).catch(() => []),
    ]);

    const ga4Status = resolveConnectorStatus(connectorRows, 'ga4');
    const gscStatus = resolveConnectorStatus(connectorRows, 'gsc');
    const gscConnectorRow = (connectorRows || []).find((row) => row.provider === 'gsc') || null;
    const gscRefreshToken = gscConnectorRow?.config?.google_refresh_token || null;
    const gscProperty = resolveGscProperty({
        connector: gscConnectorRow,
        websiteUrl: clientProfile.websiteUrl,
    });

    const currentTrafficRows = filterRowsBetween(trafficRows, window.currentStartDate, window.endDate);
    const previousTrafficRows = filterRowsBetween(trafficRows, window.previousStartDate, window.previousEndDate);

    let gscRaw = null;
    let gscFetchError = null;

    if (
        gscProperty
        && gscRefreshToken
        && gscStatus.status !== 'not_connected'
        && gscStatus.status !== 'disabled'
        && gscStatus.status !== 'sample_mode'
    ) {
        try {
            gscRaw = await fetchLiveGscData({
                siteUrl: gscProperty,
                refreshToken: gscRefreshToken,
                window,
                filters,
            });
        } catch (error) {
            gscFetchError = error;
        }
    }

    const gscUnavailableReason = buildGscUnavailableReason({
        gscStatus,
        siteUrl: gscProperty,
        refreshToken: gscRefreshToken,
        fetchError: gscFetchError,
    });

    const queryRowsAll = gscRaw?.query?.rows || [];
    const pageRowsAll = gscRaw?.page?.rows || [];
    const deviceRows = gscRaw?.device?.rows || [];

    const currentGscQueryRows = filterRowsBetween(queryRowsAll, window.currentStartDate, window.endDate);
    const previousGscQueryRows = filterRowsBetween(queryRowsAll, window.previousStartDate, window.previousEndDate);
    const currentGscPageRows = filterRowsBetween(pageRowsAll, window.currentStartDate, window.endDate);

    const bothDisconnected =
        ga4Status.status === 'not_connected' && gscStatus.status === 'not_connected';

    if (bothDisconnected && currentTrafficRows.length === 0 && currentGscQueryRows.length === 0) {
        return {
            connectors: { ga4: ga4Status, gsc: gscStatus },
            freshness: {
                ga4: buildFreshness('GA4', ga4Status, currentTrafficRows),
                gsc: buildFreshness('Search Console', gscStatus, currentGscQueryRows, {
                    unavailableDetail: gscUnavailableReason,
                }),
            },
            summary: null,
            comparison: null,
            trends: { gsc: [], ga4: [] },
            topPages: [],
            topQueries: [],
            ga4LandingPages: [],
            deviceSplit: buildUnavailableDeviceSplit(gscUnavailableReason),
            brandSplit: {
                status: 'unavailable',
                reason: 'Aucune segmentation marque/hors marque sans données Search Console exploitables.',
                reliability: 'unavailable',
            },
            gscSource: {
                mode: 'unavailable',
                reason: gscUnavailableReason,
                property: gscProperty,
                period: {
                    range,
                    currentStartDate: window.currentStartDate,
                    currentEndDate: window.endDate,
                    previousStartDate: window.previousStartDate,
                    previousEndDate: window.previousEndDate,
                },
                filters: { ...filters, segment },
            },
            emptyState: {
                title: 'Visibilité SEO non connectée',
                description:
                    'Les connecteurs GA4 et Search Console ne sont pas configurés pour ce client. Configurez-les avant d’ouvrir une lecture SEO mesurée.',
            },
        };
    }

    const brandTokens = extractBrandTokens(clientProfile.clientName);
    const aggregatedQueries = aggregateRowsByDimension(currentGscQueryRows, 'query');
    const aggregatedPages = aggregateRowsByDimension(currentGscPageRows, 'page');
    const enrichedQueriesAll = buildTopQueryRows(currentGscQueryRows, previousGscQueryRows, brandTokens);
    const enrichedQueries = applySegmentFilter(enrichedQueriesAll, segment, brandTokens);

    const clickTotal = sumField(currentGscQueryRows, 'clicks');
    const impressionTotal = sumField(currentGscQueryRows, 'impressions');
    const weightedPositionSum = (currentGscQueryRows || [])
        .reduce((sum, row) => sum + (toNumber(row.position) * Math.max(toNumber(row.impressions), 0)), 0);
    const fallbackPositionSum = (currentGscQueryRows || [])
        .reduce((sum, row) => sum + toNumber(row.position), 0);
    const fallbackPositionCount = (currentGscQueryRows || [])
        .filter((row) => toNumber(row.position) > 0).length;

    const sessionsTotal = sumField(currentTrafficRows, 'sessions');
    const usersTotal = sumField(currentTrafficRows, 'users');
    const previousSessionsTotal = sumField(previousTrafficRows, 'sessions');
    const ga4SessionsDeltaPercent = previousSessionsTotal > 0
        ? ((sessionsTotal - previousSessionsTotal) / previousSessionsTotal) * 100
        : null;

    const deviceSplit = gscRaw
        ? buildDeviceSplit(deviceRows, gscUnavailableReason)
        : buildUnavailableDeviceSplit(gscUnavailableReason);

    if (debugRawMode !== 'off' && gscRaw) {
        const payload = {
            clientId,
            property: gscProperty,
            period: {
                range,
                startDate: window.startDate,
                endDate: window.endDate,
                currentStartDate: window.currentStartDate,
                previousStartDate: window.previousStartDate,
                previousEndDate: window.previousEndDate,
            },
            filters: { ...filters, segment },
            queryMeta: gscRaw.query.meta,
            pageMeta: gscRaw.page.meta,
            deviceMeta: gscRaw.device.meta,
            querySample: buildRawSample(queryRowsAll, 30),
            pageSample: buildRawSample(pageRowsAll, 30),
            deviceSample: buildRawSample(deviceRows, 30),
        };

        if (debugRawMode === 'full') {
            payload.queryRows = queryRowsAll;
            payload.pageRows = pageRowsAll;
            payload.deviceRows = deviceRows;
        }

        console.warn('[Visibility/GSC] Raw response', JSON.stringify(payload));
    }

    const gscSource = {
        mode: gscRaw ? 'live' : 'unavailable',
        reason: gscRaw ? null : gscUnavailableReason,
        property: gscProperty,
        period: {
            range,
            startDate: window.startDate,
            endDate: window.endDate,
            currentStartDate: window.currentStartDate,
            previousStartDate: window.previousStartDate,
            previousEndDate: window.previousEndDate,
        },
        filters: {
            ...filters,
            segment,
        },
        dimensions: gscRaw ? {
            query: gscRaw.query.meta.dimensions,
            page: gscRaw.page.meta.dimensions,
            device: gscRaw.device.meta.dimensions,
        } : null,
        rowCounts: gscRaw ? {
            queryRowsTotal: queryRowsAll.length,
            queryRowsCurrent: currentGscQueryRows.length,
            queryRowsPrevious: previousGscQueryRows.length,
            pageRowsCurrent: currentGscPageRows.length,
            deviceRows: deviceRows.length,
        } : null,
        complete: gscRaw ? {
            query: gscRaw.query.meta.complete,
            page: gscRaw.page.meta.complete,
            device: gscRaw.device.meta.complete,
        } : null,
    };

    return {
        connectors: { ga4: ga4Status, gsc: gscStatus },
        freshness: {
            ga4: buildFreshness('GA4', ga4Status, currentTrafficRows),
            gsc: buildFreshness('Search Console', gscStatus, currentGscQueryRows, {
                unavailableDetail: gscUnavailableReason,
            }),
        },
        gscSource,
        kpis: {
            totalClicks: clickTotal || 0,
            totalImpressions: impressionTotal || 0,
            gscQueryCount: aggregatedQueries.length,
            gscPageCount: aggregatedPages.length,
            sessions: sessionsTotal || 0,
            users: usersTotal || 0,
            daysWithTraffic: currentTrafficRows.length,
        },
        summary: {
            clicks: clickTotal || null,
            impressions: impressionTotal || null,
            ctr: impressionTotal > 0 ? clickTotal / impressionTotal : null,
            position: weightedPosition(impressionTotal, weightedPositionSum, fallbackPositionSum, fallbackPositionCount),
            queryCount: aggregatedQueries.length,
            pageCount: aggregatedPages.length,
            organicSessions: sessionsTotal || null,
            organicUsers: usersTotal || null,
        },
        comparison: buildComparison(currentGscQueryRows, previousGscQueryRows),
        trends: {
            gsc: aggregateDailySearchRows(currentGscQueryRows),
            ga4: currentTrafficRows,
        },
        trackedKeywordCount: enrichedQueries.length,
        topPages: aggregatedPages.slice(0, 12),
        landingPages: ga4TopPages.slice(0, 12),
        ga4LandingPages: ga4TopPages.slice(0, 12),
        deviceSplit,
        ga4Support: {
            sessions: sessionsTotal || null,
            users: usersTotal || null,
            sessionsDeltaPercent: ga4SessionsDeltaPercent,
            reliability: currentTrafficRows.length > 0 ? 'measured' : 'unavailable',
        },
        brandSplit: buildBrandSplit(clientProfile.clientName, aggregatedQueries),
        topQueries: enrichedQueries.slice(0, 40),
        intentBreakdown: buildIntentBreakdown(enrichedQueries),
        movers: buildMovers(enrichedQueries),
        debug: debugRawMode !== 'off' && gscRaw
            ? {
                rawQuerySample: buildRawSample(queryRowsAll, 30),
                rawPageSample: buildRawSample(pageRowsAll, 30),
                rawDeviceSample: buildRawSample(deviceRows, 30),
            }
            : null,
        emptyState: null,
    };
}
