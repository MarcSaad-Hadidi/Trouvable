import 'server-only';

import { readGeoScore, readSeoScore } from '@/lib/audit/scores-facade';
import { getTrafficDailyRows, getTopPagesRows } from '@/lib/db/ga4';
import { getRecentGscRows } from '@/lib/db/gsc';
import { getClientConnectorRows } from '@/lib/connectors/repository';

// ──────────────────────────────────────────────────────────────
// SEO Overview slice — landing-page KPIs, connector health,
// top organic visibility, technical health preview, local readiness.
// ──────────────────────────────────────────────────────────────

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

function sumField(rows, field) {
    return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

/**
 * SEO Overview data for the SEO landing page.
 *
 * Includes:
 * - connector statuses (GA4, GSC)
 * - primary SEO KPIs (sessions, clicks, impressions, top queries)
 * - audit-based seo_score (technical_seo only)
 * - local_readiness preview (geo_score)
 * - data freshness
 */
export async function getSeoOverviewSlice(clientId, { audit } = {}) {
    const [connectorRows, trafficRows, topPages, gscRows] = await Promise.all([
        getClientConnectorRows(clientId).catch(() => []),
        getTrafficDailyRows(clientId, { days: 28 }).catch(() => []),
        getTopPagesRows(clientId, { limit: 5 }).catch(() => []),
        getRecentGscRows(clientId, { days: 28, limit: 50 }).catch(() => []),
    ]);

    const ga4 = resolveConnectorStatus(connectorRows, 'ga4');
    const gsc = resolveConnectorStatus(connectorRows, 'gsc');

    const kpis = {
        sessions: sumField(trafficRows, 'sessions'),
        users: sumField(trafficRows, 'users'),
        totalClicks: sumField(gscRows, 'clicks'),
        totalImpressions: sumField(gscRows, 'impressions'),
        daysWithTraffic: trafficRows.length,
        gscQueryCount: new Set(gscRows.map((r) => r.query)).size,
    };

    // Top 5 GSC queries by clicks for the preview
    const queryMap = new Map();
    for (const row of gscRows) {
        const key = row.query;
        if (!queryMap.has(key)) queryMap.set(key, { query: key, clicks: 0, impressions: 0 });
        const agg = queryMap.get(key);
        agg.clicks += Number(row.clicks) || 0;
        agg.impressions += Number(row.impressions) || 0;
    }
    const topQueries = Array.from(queryMap.values())
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

    const seoReading = readSeoScore(audit);
    const geoReading = readGeoScore(audit);
    const auditScores = {
        seoScore: seoReading.value,
        seoScoreLabel: 'SEO technique',
        seoScoreProvenance: seoReading.provenanceLabel,
        geoScore: geoReading.value,
        geoScoreLabel: 'Aptitude locale',
        deterministic_score: audit?.seo_breakdown?.overall?.deterministic_score ?? null,
        issueCount: Array.isArray(audit?.issues) ? audit.issues.length : 0,
    };

    return {
        connectors: { ga4, gsc },
        kpis,
        topQueries,
        topPages: topPages.slice(0, 5),
        auditScores,
        dataFreshness: {
            latestTrafficDate: trafficRows.length > 0 ? trafficRows[0]?.date : null,
            latestGscDate: gscRows.length > 0 ? gscRows[0]?.date : null,
            lastAuditAt: audit?.created_at || null,
        },
    };
}
