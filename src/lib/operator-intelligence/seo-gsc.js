import { compactString } from './geo-foundation-shared';

// GSC persisted page rows use additive counts; invalid historical cells contribute zero.
function toNumber(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
}

export function getSinceDate(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function filterRowsSince(rows, sinceDate) {
    return (rows || []).filter((row) => String(row?.date || '') >= sinceDate);
}

export function weightedPosition(impressions, weightedPositionSum, fallbackPositionSum, fallbackCount) {
    if (impressions > 0) return weightedPositionSum / impressions;
    if (fallbackCount > 0) return fallbackPositionSum / fallbackCount;
    return null;
}

export function normalizePathname(pathname) {
    if (!pathname) return null;
    const normalized = pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    if (!normalized || normalized === '') return '/';
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function normalizeUrl(value) {
    if (!value) return null;

    try {
        const parsed = new URL(value);
        const pathname = normalizePathname(parsed.pathname || '/');
        return `${parsed.origin}${pathname}`.toLowerCase();
    } catch {
        return compactString(value)?.toLowerCase() || null;
    }
}

export function aggregatePageRows(rows) {
    const aggregated = new Map();

    for (const row of rows || []) {
        const key = normalizeUrl(row?.page);
        if (!key) continue;

        if (!aggregated.has(key)) {
            aggregated.set(key, {
                url: compactString(row?.page) || key,
                clicks: 0,
                impressions: 0,
                weightedPositionSum: 0,
                fallbackPositionSum: 0,
                fallbackCount: 0,
            });
        }

        const bucket = aggregated.get(key);
        const clicks = toNumber(row?.clicks);
        const impressions = toNumber(row?.impressions);
        const position = toNumber(row?.position);

        bucket.clicks += clicks;
        bucket.impressions += impressions;
        bucket.weightedPositionSum += impressions > 0 ? position * impressions : 0;

        if (position > 0) {
            bucket.fallbackPositionSum += position;
            bucket.fallbackCount += 1;
        }
    }

    return new Map(
        Array.from(aggregated.entries()).map(([key, bucket]) => ([
            key,
            {
                url: bucket.url,
                clicks: bucket.clicks,
                impressions: bucket.impressions,
                ctr: bucket.impressions > 0 ? bucket.clicks / bucket.impressions : null,
                position: weightedPosition(
                    bucket.impressions,
                    bucket.weightedPositionSum,
                    bucket.fallbackPositionSum,
                    bucket.fallbackCount,
                ),
            },
        ])),
    );
}

export function getLatestObservedDate(rows) {
    return (rows || [])
        .map((row) => String(row?.date || '').trim())
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left))[0] || null;
}

export function getObservedAgeDays(dateString) {
    if (!dateString) return null;

    const timestamp = new Date(`${dateString}T00:00:00Z`).getTime();
    if (Number.isNaN(timestamp)) return null;

    return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

export function resolveConnectorStatus(rows, provider) {
    const row = (rows || []).find((item) => item.provider === provider) || null;
    if (!row || row.status === 'not_connected') {
        return { status: 'not_connected', lastSyncedAt: null, lastError: null };
    }

    return {
        status: row.status,
        lastSyncedAt: row.last_synced_at || null,
        lastError: row.last_error || null,
    };
}
