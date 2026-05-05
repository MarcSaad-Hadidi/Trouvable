import 'server-only';

import * as db from '@/lib/db';
import { getRecentGscRows } from '@/lib/db/gsc';
import { getClientConnectorRows } from '@/lib/connectors/repository';
import { getAdminSupabase } from '@/lib/supabase-admin';

const CURRENT_WINDOW_DAYS = 28;
const COMPARISON_WINDOW_DAYS = 56;

const TOKEN_STOPWORDS = new Set([
    'avec',
    'dans',
    'pour',
    'sans',
    'plus',
    'entre',
    'vous',
    'votre',
    'vos',
    'sur',
    'les',
    'des',
    'une',
    'du',
    'de',
    'the',
    'and',
    'for',
    'www',
    'com',
    'https',
    'http',
    'page',
    'pages',
    'service',
    'services',
    'site',
    'home',
    'blog',
    'actualites',
    'actualite',
]);

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

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toNumber(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
}

function timeSince(value) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return null;

    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function tokenize(value) {
    return normalizeText(value)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !TOKEN_STOPWORDS.has(token));
}

function sharedTokens(left, right) {
    const leftTokens = Array.from(new Set(tokenize(left)));
    const rightTokenSet = new Set(tokenize(right));
    return leftTokens.filter((token) => rightTokenSet.has(token));
}

function overlapScore(left, right) {
    const leftTokens = new Set(tokenize(left));
    const rightTokens = new Set(tokenize(right));

    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let overlap = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) overlap += 1;
    }

    return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function normalizePathname(pathname) {
    if (!pathname) return null;
    const normalized = pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    if (!normalized) return '/';
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function getPathname(value) {
    if (!value) return null;

    try {
        return normalizePathname(new URL(value).pathname || '/');
    } catch {
        return null;
    }
}

function normalizeUrl(value) {
    if (!value) return null;

    try {
        const parsed = new URL(value);
        const pathname = normalizePathname(parsed.pathname || '/');
        return `${parsed.origin}${pathname}`.toLowerCase();
    } catch {
        return compactString(value)?.toLowerCase() || null;
    }
}

function getPrimarySegment(value) {
    const pathname = getPathname(value);
    if (!pathname || pathname === '/') return null;
    return pathname.split('/').filter(Boolean)[0] || null;
}

function getSinceDate(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function filterRowsSince(rows, sinceDate) {
    return (rows || []).filter((row) => String(row?.date || '') >= sinceDate);
}

function getLatestObservedDate(rows) {
    return (rows || [])
        .map((row) => String(row?.date || '').trim())
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

function buildGscFreshness(connectorRows, rows) {
    const gscStatus = resolveConnectorStatus(connectorRows, 'gsc');
    const lastObservedDate = getLatestObservedDate(rows);
    const ageDays = getObservedAgeDays(lastObservedDate);

    if (!lastObservedDate) {
        return {
            status: gscStatus.status === 'not_connected' ? 'unavailable' : 'warning',
            reliability: gscStatus.status === 'not_connected' ? 'unavailable' : 'measured',
            label: 'Search Console',
            lastObservedDate: null,
            lastSyncedAt: gscStatus.lastSyncedAt,
            detail: gscStatus.status === 'not_connected'
                ? 'Search Console non connectée pour ce mandat.'
                : 'Search Console connectée sans données exploitables sur la fenêtre observée.',
        };
    }

    return {
        status: ageDays === null ? 'warning' : ageDays <= 3 ? 'ok' : ageDays <= 7 ? 'warning' : 'critical',
        reliability: 'measured',
        label: 'Search Console',
        lastObservedDate,
        lastSyncedAt: gscStatus.lastSyncedAt,
        detail: ageDays === null
            ? 'Date observée non exploitable proprement.'
            : ageDays <= 3
                ? 'Données fraîches sur la fenêtre de recouvrement active.'
                : ageDays <= 7
                    ? 'Données encore utilisables, mais à surveiller.'
                    : 'Données trop anciennes pour appuyer un arbitrage opérateur serein.',
    };
}

function buildAuditFreshness(audit) {
    return {
        status: audit?.created_at ? 'ok' : 'unavailable',
        reliability: audit?.created_at ? 'measured' : 'unavailable',
        label: 'Audit structurel',
        value: timeSince(audit?.created_at) || 'Indisponible',
        detail: audit?.created_at
            ? 'Fraîcheur des `page_summaries` et des signaux éditoriaux.'
            : 'Aucun audit récent pour confirmer titles, H1, types de pages ou richesse éditoriale.',
    };
}

function prettifySegment(segment) {
    return String(segment || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pageTypeLabel(pageType) {
    if (pageType === 'homepage') return 'Page pivot';
    if (pageType === 'services') return 'Page service';
    if (pageType === 'faq') return 'Page réponse';
    if (pageType === 'about') return 'Support confiance';
    if (pageType === 'contact') return 'Support contact';
    if (pageType === 'location') return 'Page locale';
    return 'Page auditée';
}

function pagePriority(page) {
    const pageType = page?.page_type || page?.pageType;
    if (pageType === 'homepage') return 0;
    if (pageType === 'services') return 1;
    if (pageType === 'faq') return 2;
    if (pageType === 'location') return 3;
    if (pageType === 'about') return 4;
    if (pageType === 'contact') return 5;
    return 6;
}

function comparePages(left, right) {
    const priorityDelta = pagePriority(left) - pagePriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return String(left?.url || '').localeCompare(String(right?.url || ''), 'fr-CA');
}

function getPageStrengthScore(page) {
    return toNumber(page?.word_count)
        + toNumber(page?.faq_pairs_count) * 24
        + toNumber(page?.citability?.block_count) * 16
        + toNumber(page?.citability?.page_score)
        + toNumber(page?.service_signal_count) * 8
        + Math.min(toNumber(page?.local_signal_count) * 4, 20);
}

function getPageLabel(page) {
    const url = compactString(page?.url);
    const pathname = getPathname(url);
    if (!pathname) return page?.page_type ? pageTypeLabel(page.page_type) : 'Page observée';
    return pathname;
}

function buildPageDescriptor(page, fallbackMetrics = null) {
    return {
        key: normalizeUrl(page?.url) || page?.key || null,
        label: getPageLabel(page),
        url: compactString(page?.url),
        pageTypeLabel: pageTypeLabel(page?.page_type),
        page_type: page?.page_type || page?.pageType || null,
        pageType: page?.page_type || null,
        roleDetail: page?.page_type
            ? `${pageTypeLabel(page.page_type)}${page?.title ? ` · ${page.title}` : ''}`
            : 'Page connue uniquement par son URL ou par la mesure Search Console.',
        title: compactString(page?.title),
        h1: compactString(page?.h1),
        strengthScore: getPageStrengthScore(page),
        fallbackMetrics,
    };
}

function pickRicherText(left, right) {
    const leftValue = compactString(left);
    const rightValue = compactString(right);

    if (!leftValue) return rightValue;
    if (!rightValue) return leftValue;

    return rightValue.length > leftValue.length ? rightValue : leftValue;
}

function mergePageSummaries(existingPage, incomingPage) {
    const preferredPage = getPageStrengthScore(incomingPage) > getPageStrengthScore(existingPage)
        ? incomingPage
        : existingPage;

    return {
        ...existingPage,
        ...incomingPage,
        ...preferredPage,
        url: compactString(existingPage?.url) || compactString(incomingPage?.url) || compactString(preferredPage?.url),
        page_type: compactString(existingPage?.page_type) || compactString(incomingPage?.page_type) || compactString(preferredPage?.page_type),
        title: pickRicherText(existingPage?.title, incomingPage?.title),
        description: pickRicherText(existingPage?.description, incomingPage?.description),
        h1: pickRicherText(existingPage?.h1, incomingPage?.h1),
        word_count: Math.max(toNumber(existingPage?.word_count), toNumber(incomingPage?.word_count)),
        faq_pairs_count: Math.max(toNumber(existingPage?.faq_pairs_count), toNumber(incomingPage?.faq_pairs_count)),
        service_signal_count: Math.max(toNumber(existingPage?.service_signal_count), toNumber(incomingPage?.service_signal_count)),
        local_signal_count: Math.max(toNumber(existingPage?.local_signal_count), toNumber(incomingPage?.local_signal_count)),
        citability: {
            ...(existingPage?.citability || {}),
            ...(incomingPage?.citability || {}),
            block_count: Math.max(
                toNumber(existingPage?.citability?.block_count),
                toNumber(incomingPage?.citability?.block_count),
            ),
            page_score: Math.max(
                toNumber(existingPage?.citability?.page_score),
                toNumber(incomingPage?.citability?.page_score),
            ),
        },
    };
}

function dedupePagesByUrl(pages) {
    const pagesByUrl = new Map();
    const pagesWithoutUrl = [];

    for (const page of pages || []) {
        const key = normalizeUrl(page?.url);

        if (!key) {
            pagesWithoutUrl.push(page);
            continue;
        }

        if (!pagesByUrl.has(key)) {
            pagesByUrl.set(key, page);
            continue;
        }

        pagesByUrl.set(key, mergePageSummaries(pagesByUrl.get(key), page));
    }

    return [...pagesByUrl.values(), ...pagesWithoutUrl];
}

function weightedPosition(impressions, weightedPositionSum, fallbackPositionSum, fallbackCount) {
    if (impressions > 0) return weightedPositionSum / impressions;
    if (fallbackCount > 0) return fallbackPositionSum / fallbackCount;
    return null;
}

function aggregatePageRows(rows) {
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

function buildPagePerformance(rows) {
    const currentSince = getSinceDate(CURRENT_WINDOW_DAYS);
    const currentRows = filterRowsSince(rows, currentSince);
    const previousRows = (rows || []).filter((row) => String(row?.date || '') < currentSince);
    const currentMap = aggregatePageRows(currentRows);
    const previousMap = aggregatePageRows(previousRows);
    const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);
    const performance = new Map();

    for (const key of keys) {
        performance.set(key, {
            current: currentMap.get(key) || { url: key, clicks: 0, impressions: 0, ctr: null, position: null },
            previous: previousMap.get(key) || { url: key, clicks: 0, impressions: 0, ctr: null, position: null },
        });
    }

    return performance;
}

async function getClientName(clientId) {
    const { data } = await getAdminSupabase()
        .from('client_geo_profiles')
        .select('client_name')
        .eq('id', clientId)
        .maybeSingle();

    return String(data?.client_name || '').trim();
}

function extractBrandTokens(clientName) {
    return normalizeText(clientName)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !BRAND_STOPWORDS.has(token));
}

function isBrandLikeQuery(query, brandTokens) {
    if (!brandTokens.length) return false;
    const normalized = normalizeText(query);
    return brandTokens.some((token) => normalized.includes(token));
}

function makePairKey(leftKey, rightKey) {
    return [leftKey, rightKey].sort().join('::');
}

function initMetricBucket(url) {
    return {
        url,
        clicks: 0,
        impressions: 0,
        weightedPositionSum: 0,
        fallbackPositionSum: 0,
        fallbackCount: 0,
        sharedQueryCount: 0,
        nonBrandSharedQueryCount: 0,
    };
}

function addRowMetrics(bucket, rowMetrics, isBrandLike) {
    const clicks = toNumber(rowMetrics?.clicks);
    const impressions = toNumber(rowMetrics?.impressions);
    const position = toNumber(rowMetrics?.position);

    bucket.clicks += clicks;
    bucket.impressions += impressions;
    bucket.weightedPositionSum += impressions > 0 ? position * impressions : 0;

    if (position > 0) {
        bucket.fallbackPositionSum += position;
        bucket.fallbackCount += 1;
    }

    bucket.sharedQueryCount += 1;
    if (!isBrandLike) bucket.nonBrandSharedQueryCount += 1;
}

function finalizeMetricBucket(bucket) {
    return {
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
        sharedQueryCount: bucket.sharedQueryCount,
        nonBrandSharedQueryCount: bucket.nonBrandSharedQueryCount,
    };
}

function buildMeasuredPairSignals(rows, pageIndex, brandTokens) {
    const queryMap = new Map();

    for (const row of rows || []) {
        const query = compactString(row?.query);
        const pageKey = normalizeUrl(row?.page);

        if (!query || !pageKey) continue;

        if (!queryMap.has(query)) {
            queryMap.set(query, {
                query,
                pages: new Map(),
                totalClicks: 0,
                totalImpressions: 0,
                isBrandLike: isBrandLikeQuery(query, brandTokens),
            });
        }

        const bucket = queryMap.get(query);
        if (!bucket.pages.has(pageKey)) {
            bucket.pages.set(pageKey, initMetricBucket(compactString(row?.page) || pageKey));
        }

        addRowMetrics(bucket.pages.get(pageKey), row, bucket.isBrandLike);
        bucket.totalClicks += toNumber(row?.clicks);
        bucket.totalImpressions += toNumber(row?.impressions);
    }

    const pairMap = new Map();

    for (const queryBucket of queryMap.values()) {
        if (queryBucket.pages.size < 2) continue;

        const pages = Array.from(queryBucket.pages.entries()).map(([pageKey, metrics]) => ({
            pageKey,
            metrics: finalizeMetricBucket(metrics),
        }));

        for (let index = 0; index < pages.length; index += 1) {
            for (let offset = index + 1; offset < pages.length; offset += 1) {
                const left = pages[index];
                const right = pages[offset];
                const pairKey = makePairKey(left.pageKey, right.pageKey);

                if (!pairMap.has(pairKey)) {
                    pairMap.set(pairKey, {
                        pairKey,
                        pageKeys: [left.pageKey, right.pageKey].sort(),
                        pageMetrics: new Map(),
                        sharedQueryCount: 0,
                        nonBrandSharedQueryCount: 0,
                        sharedClicks: 0,
                        sharedImpressions: 0,
                        querySamples: [],
                    });
                }

                const pair = pairMap.get(pairKey);
                pair.sharedQueryCount += 1;
                if (!queryBucket.isBrandLike) pair.nonBrandSharedQueryCount += 1;
                pair.sharedClicks += left.metrics.clicks + right.metrics.clicks;
                pair.sharedImpressions += left.metrics.impressions + right.metrics.impressions;
                pair.querySamples.push({
                    query: queryBucket.query,
                    impressions: left.metrics.impressions + right.metrics.impressions,
                    clicks: left.metrics.clicks + right.metrics.clicks,
                    isBrandLike: queryBucket.isBrandLike,
                });

                for (const page of [left, right]) {
                    if (!pair.pageMetrics.has(page.pageKey)) {
                        pair.pageMetrics.set(page.pageKey, initMetricBucket(page.metrics.url));
                    }

                    addRowMetrics(pair.pageMetrics.get(page.pageKey), page.metrics, queryBucket.isBrandLike);
                }
            }
        }
    }

    return Array.from(pairMap.values()).map((pair) => {
        const pages = pair.pageKeys.map((pageKey) => {
            const auditPage = pageIndex.get(pageKey) || { url: pair.pageMetrics.get(pageKey)?.url || pageKey };
            return buildPageDescriptor(auditPage, finalizeMetricBucket(pair.pageMetrics.get(pageKey)));
        }).sort((left, right) => String(left.label).localeCompare(String(right.label), 'fr-CA'));

        const confidenceLabel = pair.nonBrandSharedQueryCount >= 2 && pair.sharedImpressions >= 60
            ? 'Confiance élevée'
            : pair.sharedImpressions >= 20
                ? 'Confiance moyenne'
                : 'Signal à confirmer';
        const confidenceTone = pair.nonBrandSharedQueryCount >= 2 && pair.sharedImpressions >= 60
            ? 'high'
            : pair.sharedImpressions >= 20
                ? 'medium'
                : 'low';

        return {
            id: `measured_${pair.pairKey}`,
            pairKey: pair.pairKey,
            pages,
            measured: {
                reliability: 'measured',
                sharedQueryCount: pair.sharedQueryCount,
                nonBrandSharedQueryCount: pair.nonBrandSharedQueryCount,
                sharedClicks: pair.sharedClicks,
                sharedImpressions: pair.sharedImpressions,
                pageMetrics: new Map(
                    Array.from(pair.pageMetrics.entries()).map(([pageKey, bucket]) => ([pageKey, finalizeMetricBucket(bucket)])),
                ),
                querySamples: pair.querySamples
                    .sort((left, right) => right.impressions - left.impressions)
                    .slice(0, 4),
            },
            confidenceLabel,
            confidenceTone,
            score: pair.sharedImpressions + pair.sharedQueryCount * 25 + pair.nonBrandSharedQueryCount * 30,
        };
    });
}

function inspectPairSignals(left, right) {
    const headlineLeft = `${left?.title || ''} ${left?.h1 || ''}`;
    const headlineRight = `${right?.title || ''} ${right?.h1 || ''}`;
    const headlineTokens = sharedTokens(headlineLeft, headlineRight).slice(0, 5);
    const pathTokens = sharedTokens(getPathname(left?.url), getPathname(right?.url)).slice(0, 4);
    const sameSegment = getPrimarySegment(left?.url) && getPrimarySegment(left?.url) === getPrimarySegment(right?.url);
    const samePageType = compactString(left?.page_type) && left?.page_type === right?.page_type;
    const bothServiceHeavy = toNumber(left?.service_signal_count) > 0 && toNumber(right?.service_signal_count) > 0;
    const lowLocalDifferentiation = toNumber(left?.local_signal_count) === 0 && toNumber(right?.local_signal_count) === 0;
    const headlineOverlap = overlapScore(headlineLeft, headlineRight);
    const pathOverlap = overlapScore(getPathname(left?.url), getPathname(right?.url));

    let score = headlineOverlap;
    if (sameSegment) score += 0.18;
    if (samePageType) score += 0.10;
    if (pathTokens.length > 0) score += 0.08;
    if (bothServiceHeavy) score += 0.06;
    if (lowLocalDifferentiation) score += 0.04;
    score = Math.min(score, 1);

    return {
        headlineOverlap,
        pathOverlap,
        headlineTokens,
        pathTokens,
        sameSegment,
        samePageType,
        bothServiceHeavy,
        lowLocalDifferentiation,
        score,
    };
}

function buildCalculatedPairSignals(pages) {
    const signals = [];

    for (let index = 0; index < pages.length; index += 1) {
        const left = pages[index];
        if (['about', 'contact'].includes(left?.page_type)) continue;

        for (let offset = index + 1; offset < pages.length; offset += 1) {
            const right = pages[offset];
            if (['about', 'contact'].includes(right?.page_type)) continue;

            const pairSignals = inspectPairSignals(left, right);
            const strongLexical = pairSignals.headlineTokens.length >= 2 && pairSignals.headlineOverlap >= 0.42;
            const strongFamilySignal = pairSignals.sameSegment && (pairSignals.samePageType || pairSignals.pathTokens.length > 0);
            const veryStrongOverlap = pairSignals.headlineOverlap >= 0.58;

            if (!(veryStrongOverlap || (strongLexical && strongFamilySignal) || (pairSignals.samePageType && pairSignals.sameSegment && pairSignals.headlineOverlap >= 0.32))) {
                continue;
            }

            const pairKey = makePairKey(normalizeUrl(left?.url), normalizeUrl(right?.url));
            signals.push({
                id: `calculated_${pairKey}`,
                pairKey,
                pages: [buildPageDescriptor(left), buildPageDescriptor(right)].sort((first, second) => String(first.label).localeCompare(String(second.label), 'fr-CA')),
                calculated: {
                    reliability: 'calculated',
                    score: pairSignals.score,
                    headlineOverlap: pairSignals.headlineOverlap,
                    pathOverlap: pairSignals.pathOverlap,
                    sameSegment: pairSignals.sameSegment,
                    segmentLabel: pairSignals.sameSegment ? prettifySegment(getPrimarySegment(left?.url)) : null,
                    samePageType: pairSignals.samePageType,
                    headlineTokens: pairSignals.headlineTokens,
                    pathTokens: pairSignals.pathTokens,
                    bothServiceHeavy: pairSignals.bothServiceHeavy,
                    lowLocalDifferentiation: pairSignals.lowLocalDifferentiation,
                },
                confidenceLabel: pairSignals.score >= 0.72 ? 'Confiance moyenne' : 'Signal à confirmer',
                confidenceTone: pairSignals.score >= 0.72 ? 'medium' : 'low',
                score: Math.round(pairSignals.score * 100),
            });
        }
    }

    return signals;
}

function buildCalculatedEvidence(calculatedSignal) {
    if (!calculatedSignal?.calculated) {
        return {
            reliability: 'unavailable',
            text: 'Aucune confirmation structurelle fiable sans `page_summaries` auditées.',
            detail: 'Le repo ne stocke pas aujourd’hui de clustering d’intention ou de mapping service/ville par page.',
            signals: [],
            score: 0,
        };
    }

    const parts = [];
    const signals = [];

    if (calculatedSignal.calculated.headlineTokens.length > 0) {
        parts.push(`titles/H1 proches autour de ${calculatedSignal.calculated.headlineTokens.join(', ')}`);
        signals.push(`Tokens partagés: ${calculatedSignal.calculated.headlineTokens.join(', ')}`);
    }
    if (calculatedSignal.calculated.sameSegment && calculatedSignal.calculated.segmentLabel) {
        parts.push(`même famille /${normalizeText(calculatedSignal.calculated.segmentLabel).replace(/\s+/g, '-')}`);
        signals.push(`Même segment d’URL: ${calculatedSignal.calculated.segmentLabel}`);
    }
    if (calculatedSignal.calculated.samePageType) {
        signals.push('Même type de page observé dans l’audit');
    }
    if (calculatedSignal.calculated.bothServiceHeavy) {
        signals.push('Deux pages déjà fortement orientées service');
    }
    if (calculatedSignal.calculated.lowLocalDifferentiation) {
        signals.push('Peu de différenciation locale visible dans les signaux par page');
    }

    return {
        reliability: 'calculated',
        text: parts.length > 0
            ? `Recouvrement potentiel calculé: ${parts.join(' · ')}.`
            : 'Recouvrement potentiel calculé à partir des titres, H1, segments d’URL et rôles de page.',
        detail: `Score structurel ${Math.round(calculatedSignal.calculated.score * 100)} / 100.`,
        signals,
        score: calculatedSignal.calculated.score,
    };
}

function buildMeasuredEvidence(measuredSignal) {
    if (!measuredSignal?.measured) {
        return {
            reliability: 'unavailable',
            text: 'Aucune requête partagée mesurée sur la fenêtre Search Console courante.',
            detail: 'Le repo ne peut pas prouver ici un conflit d’intention via GSC.',
            querySamples: [],
            sharedClicks: 0,
            sharedImpressions: 0,
            sharedQueryCount: 0,
            nonBrandSharedQueryCount: 0,
            pageMetrics: new Map(),
        };
    }

    const isMostlyBrand = measuredSignal.measured.sharedQueryCount > 0
        && measuredSignal.measured.nonBrandSharedQueryCount === 0;

    return {
        reliability: 'measured',
        text: isMostlyBrand
            ? `${measuredSignal.measured.sharedQueryCount} requête(s) partagée(s), surtout de marque.`
            : `${measuredSignal.measured.sharedQueryCount} requête(s) partagée(s) observée(s) dans Search Console.`,
        detail: `${measuredSignal.measured.sharedImpressions.toLocaleString('fr-FR')} impressions et ${measuredSignal.measured.sharedClicks.toLocaleString('fr-FR')} clics cumulés sur la fenêtre courante.`,
        querySamples: measuredSignal.measured.querySamples,
        sharedClicks: measuredSignal.measured.sharedClicks,
        sharedImpressions: measuredSignal.measured.sharedImpressions,
        sharedQueryCount: measuredSignal.measured.sharedQueryCount,
        nonBrandSharedQueryCount: measuredSignal.measured.nonBrandSharedQueryCount,
        pageMetrics: measuredSignal.measured.pageMetrics,
    };
}

function rankPageForWinner(page, measuredMetrics, overallMetrics) {
    const measuredClicks = toNumber(measuredMetrics?.clicks);
    const measuredImpressions = toNumber(measuredMetrics?.impressions);
    const overallClicks = toNumber(overallMetrics?.current?.clicks);
    const overallImpressions = toNumber(overallMetrics?.current?.impressions);
    const position = measuredMetrics?.position ?? overallMetrics?.current?.position ?? 99;

    return (
        measuredClicks * 1000
        + measuredImpressions * 10
        + overallClicks * 100
        + overallImpressions
        - pagePriority(page) * 12
        + getPageStrengthScore(page)
        - position
    );
}

function chooseWinner(pages, measuredEvidence, pagePerformance) {
    if (!pages.length) {
        return {
            page: null,
            reliability: 'unavailable',
            why: 'Aucune page ne peut être comparée proprement dans ce groupe.',
            weakerNote: 'Signal indisponible',
        };
    }

    const rankedPages = pages
        .map((page) => {
            const key = page.key || normalizeUrl(page.url);
            return {
                page,
                measuredMetrics: key ? measuredEvidence.pageMetrics.get(key) : null,
                overallMetrics: key ? pagePerformance.get(key) : null,
            };
        })
        .sort((left, right) => rankPageForWinner(right.page, right.measuredMetrics, right.overallMetrics) - rankPageForWinner(left.page, left.measuredMetrics, left.overallMetrics));

    const winner = rankedPages[0];
    const trailingPages = rankedPages.slice(1);

    if (!winner) {
        return {
            page: null,
            reliability: 'unavailable',
            why: 'Aucune page ne ressort proprement comme gagnante.',
            weakerNote: 'Signal indisponible',
        };
    }

    const measuredClicks = toNumber(winner.measuredMetrics?.clicks);
    const measuredImpressions = toNumber(winner.measuredMetrics?.impressions);
    const overallClicks = toNumber(winner.overallMetrics?.current?.clicks);
    const overallImpressions = toNumber(winner.overallMetrics?.current?.impressions);

    if (measuredImpressions > 0 || measuredClicks > 0) {
        return {
            page: winner.page,
            reliability: 'measured',
            why: `${winner.page.label} capte le plus de signal sur les requêtes partagées (${measuredClicks.toLocaleString('fr-FR')} clics, ${measuredImpressions.toLocaleString('fr-FR')} impressions).`,
            weakerNote: trailingPages.length > 0
                ? `Les autres pages de ce groupe restent derrière sur le recouvrement mesuré.`
                : 'Aucune autre page n’entre en concurrence directe dans ce groupe.',
        };
    }

    if (overallImpressions > 0 || overallClicks > 0) {
        return {
            page: winner.page,
            reliability: 'measured',
            why: `${winner.page.label} reste la page la plus visible sur la fenêtre GSC disponible, même hors requêtes partagées strictes.`,
            weakerNote: trailingPages.length > 0
                ? 'Les autres pages de ce groupe portent moins de traction organique globale.'
                : 'Aucune autre page n’entre en concurrence directe dans ce groupe.',
        };
    }

    return {
        page: winner.page,
        reliability: winner.page.pageType ? 'calculated' : 'unavailable',
        why: winner.page.pageType
            ? `${winner.page.label} paraît la meilleure candidate par rôle éditorial, densité de contenu et richesse observée dans l’audit.`
            : 'Aucune page ne ressort via la mesure; le repo ne permet ici qu’un arbitrage faible.',
        weakerNote: trailingPages.length > 0
            ? 'Les autres pages sont moins structurées ou moins riches dans les signaux audit disponibles.'
            : 'Aucune autre page n’entre en concurrence directe dans ce groupe.',
    };
}

function buildActionRecommendation(group, winner) {
    const measured = group.measured;
    const calculated = group.calculated;
    const uniqueTypes = new Set(group.pages.map((page) => page.pageType).filter(Boolean));
    const sameRole = uniqueTypes.size === 1 && uniqueTypes.size > 0;
    const mixedRoles = uniqueTypes.size > 1;
    const dominantMeasured = measured.sharedImpressions >= 60 && measured.nonBrandSharedQueryCount >= 2;
    const structuralDuplication = calculated.score >= 0.65 && (calculated.signals.some((signal) => signal.includes('Même segment')) || calculated.signals.some((signal) => signal.includes('Même type')));
    const isMostlyBrand = measured.sharedQueryCount > 0 && measured.nonBrandSharedQueryCount === 0;

    if (measured.reliability === 'measured' && dominantMeasured && sameRole && structuralDuplication) {
        return {
            label: 'Fusionner',
            reliability: 'calculated',
            why: 'Les deux pages servent probablement la même intention: requêtes partagées nettes, rôle similaire et cadrage éditorial proche.',
            guardrail: 'Vérifier avant fusion qu’aucune page ne porte un angle service ou un contexte local réellement distinct.',
        };
    }

    if (measured.reliability === 'measured' && !isMostlyBrand && winner?.page) {
        return {
            label: 'Repositionner',
            reliability: 'calculated',
            why: `Garder ${winner.page.label} sur l’intention principale et recadrer l’autre page sur un angle plus spécifique ou plus local.`,
            guardrail: 'Ne pas réécrire en aveugle: confirmer d’abord quelles requêtes partagées sont vraiment business-critical.',
        };
    }

    if (mixedRoles) {
        return {
            label: 'Conserver séparé',
            reliability: 'calculated',
            why: 'Les pages remplissent des rôles différents. Le recouvrement actuel ne suffit pas à justifier une fusion.',
            guardrail: 'Clarifier toutefois le title, le H1 et la promesse de chaque page pour éviter une dérive progressive.',
        };
    }

    if (calculated.reliability === 'calculated') {
        return {
            label: 'Différencier',
            reliability: 'calculated',
            why: 'Le repo observe surtout un recouvrement potentiel de cadrage. La bonne action immédiate est de différencier angle, titre, H1 ou preuve locale avant d’aller plus loin.',
            guardrail: 'Tant qu’aucune requête partagée hors marque n’est mesurée, parler de cannibalisation stricte resterait excessif.',
        };
    }

    return {
        label: 'Conserver séparé',
        reliability: 'calculated',
        why: 'Aucune preuve assez nette ne justifie aujourd’hui une fusion ou un repositionnement fort.',
        guardrail: 'Surveiller d’abord la qualité des données GSC et relancer un audit propre avant arbitrage.',
    };
}

function buildGroupTypeLabel(measured, calculated) {
    if (measured.reliability === 'measured' && measured.nonBrandSharedQueryCount > 0 && calculated.reliability === 'calculated') {
        return 'Chevauchement probable';
    }
    if (measured.reliability === 'measured' && measured.nonBrandSharedQueryCount === 0) {
        return 'Recouvrement de marque à confirmer';
    }
    if (measured.reliability === 'measured') {
        return 'Requêtes partagées mesurées';
    }
    if (calculated.reliability === 'calculated' && calculated.signals.some((signal) => signal.includes('Même segment'))) {
        return 'Même famille de pages';
    }
    if (calculated.reliability === 'calculated') {
        return 'Recouvrement potentiel';
    }
    return 'Signal indisponible';
}

function buildGroupTitle(index, measured, calculated, pages) {
    const topMeasuredQuery = measured.querySamples.find((query) => !query.isBrandLike) || measured.querySamples[0];
    if (topMeasuredQuery?.query) {
        return `Groupe ${index + 1} · Autour de « ${topMeasuredQuery.query.slice(0, 42)}${topMeasuredQuery.query.length > 42 ? '…' : ''} »`;
    }

    const segmentSignal = calculated.signals.find((signal) => signal.includes('Même segment'));
    if (segmentSignal) {
        return `Groupe ${index + 1} · ${segmentSignal.replace('Même segment d’URL: ', 'Famille ')}`;
    }

    const tokenSignal = calculated.signals.find((signal) => signal.includes('Tokens partagés:'));
    if (tokenSignal) {
        return `Groupe ${index + 1} · ${tokenSignal.replace('Tokens partagés: ', '')}`;
    }

    return `Groupe ${index + 1} · ${pages.map((page) => page.label).join(' vs ')}`;
}

function buildUnavailableEvidence(measuredSignal, calculatedSignal, auditExists) {
    if (!auditExists) {
        return {
            reliability: 'unavailable',
            text: 'Aucun audit exploitable pour confirmer titles, H1, type de page ou richesse éditoriale.',
        };
    }

    if (!measuredSignal?.measured) {
        return {
            reliability: 'unavailable',
            text: 'Aucune requête partagée mesurée à ce stade. Le recouvrement reste donc un signal structurel à confirmer.',
        };
    }

    if (!calculatedSignal?.calculated) {
        return {
            reliability: 'unavailable',
            text: 'Le repo ne stocke ni date éditoriale page par page ni clustering d’intention assez fin pour trancher davantage.',
        };
    }

    return {
        reliability: 'unavailable',
        text: 'Aucune synthèse de fraîcheur éditoriale par page ni différenciation service/ville suffisamment granulaire n’est stockée aujourd’hui.',
    };
}

function buildOperatorSummary(groups, audit, gscFreshness) {
    const measuredCount = groups.filter((group) => group.measured.reliability === 'measured').length;
    const probableCount = groups.filter((group) => group.measured.reliability !== 'measured' && group.calculated.reliability === 'calculated').length;

    const parts = [];

    if (groups.length === 0) {
        parts.push('Aucun groupe de recouvrement suffisamment net ne ressort des données actuelles.');
    } else {
        parts.push(`${groups.length} groupe(s) de recouvrement ressortent sur cette lecture opérateur.`);
    }

    if (measuredCount > 0) {
        parts.push(`${measuredCount} groupe(s) sont appuyés par des requêtes GSC partagées.`);
    }

    if (probableCount > 0) {
        parts.push(`${probableCount} groupe(s) restent au stade de recouvrement potentiel ou probable calculé.`);
    }

    if (gscFreshness.reliability === 'unavailable') {
        parts.push('Sans Search Console exploitable, la page ne peut pas prouver une cannibalisation stricte par la mesure.');
    }

    if (!audit?.created_at) {
        parts.push('Sans audit structurel récent, la différenciation éditoriale ne peut pas être confirmée proprement.');
    }

    return {
        text: parts.join(' '),
        note: 'Ici, “cannibalisation” n’est employé fortement que lorsqu’un partage de requêtes mesurées existe. Sinon la vue parle de recouvrement potentiel, de chevauchement probable ou de signal à confirmer.',
        reliability: 'calculated',
    };
}

function buildReliabilityBreakdown(groups, gscFreshness, audit) {
    const measuredCount = groups.filter((group) => group.measured.reliability === 'measured').length;
    const calculatedCount = groups.filter((group) => group.calculated.reliability === 'calculated').length;

    return [
        {
            id: 'measured',
            title: 'Mesurée',
            reliability: 'measured',
            text: measuredCount > 0
                ? `${measuredCount} groupe(s) appuyés par des requêtes Search Console partagées.`
                : 'Aucun recouvrement mesuré par requêtes partagées sur la fenêtre active.',
        },
        {
            id: 'calculated',
            title: 'Calculée',
            reliability: 'calculated',
            text: calculatedCount > 0
                ? `${calculatedCount} groupe(s) soutenus par title, H1, segment d’URL ou rôle de page.`
                : 'Aucun recouvrement structurel assez net n’a été calculé dans les pages auditées.',
        },
        {
            id: 'ai',
            title: 'Analyse IA',
            reliability: 'unavailable',
            text: 'Aucune synthèse IA dédiée à la cannibalisation n’est persistée aujourd’hui dans le repo.',
        },
        {
            id: 'unavailable',
            title: 'Indisponible',
            reliability: 'unavailable',
            text: !audit?.created_at
                ? 'Audit structurel indisponible: impossible de confirmer titles, H1 et types de pages.'
                : gscFreshness.reliability === 'unavailable'
                    ? 'Search Console indisponible: impossible de prouver un partage de requêtes.'
                    : 'Pas de date éditoriale par page ni de clustering d’intention plus fin pour aller au-delà.',
        },
    ];
}

function buildActionHooks(clientId, groups, gscFreshness, contentOpportunityCount) {
    const baseHref = `/admin/clients/${clientId}`;

    const hooks = [
        {
            id: 'content-merge',
            title: 'Revoir le contenu consolidable',
            description: groups.length > 0
                ? 'Croiser ces recouvrements avec les opportunités de consolidation déjà visibles dans Contenu SEO.'
                : 'La surface Contenu SEO reste le bon endroit pour vérifier les signaux de fusion déjà visibles.',
            href: `${baseHref}/seo/content#merge`,
            cta: 'Ouvrir Contenu SEO',
            reliability: 'calculated',
        },
        {
            id: 'on-page',
            title: 'Comparer titles et H1',
            description: 'Utiliser la lecture on-page pour confirmer si le conflit vient du cadrage éditorial, et non seulement des URL.',
            href: `${baseHref}/seo/on-page`,
            cta: 'Ouvrir on-page',
            reliability: 'calculated',
        },
        {
            id: 'seo-opportunities',
            title: 'Préparer un arbitrage SEO',
            description: contentOpportunityCount > 0
                ? `${contentOpportunityCount} opportunité(s) contenu sont déjà ouvertes et peuvent servir de point d’entrée opérateur.`
                : 'La file Opportunités SEO sert de point de branchement pour transformer un recouvrement confirmé en tâche opérateur.',
            href: `${baseHref}/seo/opportunities`,
            cta: 'Ouvrir Opportunités SEO',
            reliability: 'calculated',
        },
    ];

    if (gscFreshness.reliability === 'unavailable') {
        hooks.push({
            id: 'connect-gsc',
            title: 'Connecter Search Console',
            description: 'Sans GSC proprement synchronisée, la page restera limitée au recouvrement structurel probable.',
            href: `${baseHref}/dossier/connectors`,
            cta: 'Voir les connecteurs',
            reliability: 'unavailable',
        });
    }

    return hooks.slice(0, 4);
}

function buildGlobalConfidence(groups) {
    if (groups.some((group) => group.confidenceTone === 'high')) return 'Élevée';
    if (groups.some((group) => group.confidenceTone === 'medium')) return 'Moyenne';
    return 'Signal à confirmer';
}

function mergeSignals(measuredSignals, calculatedSignals, pagePerformance, auditExists) {
    const signalMap = new Map();

    for (const signal of measuredSignals || []) {
        signalMap.set(signal.pairKey, { measuredSignal: signal, calculatedSignal: null });
    }

    for (const signal of calculatedSignals) {
        if (!signalMap.has(signal.pairKey)) {
            signalMap.set(signal.pairKey, { measuredSignal: null, calculatedSignal: signal });
            continue;
        }

        signalMap.get(signal.pairKey).calculatedSignal = signal;
    }

    return Array.from(signalMap.values())
        .map(({ measuredSignal, calculatedSignal }) => {
            const measured = buildMeasuredEvidence(measuredSignal);
            const calculated = buildCalculatedEvidence(calculatedSignal);
            const pages = (measuredSignal?.pages || calculatedSignal?.pages || []).slice().sort((left, right) => String(left.label).localeCompare(String(right.label), 'fr-CA'));
            const winner = chooseWinner(pages, measured, pagePerformance);
            const action = buildActionRecommendation({ measured, calculated, pages }, winner);
            const unavailable = buildUnavailableEvidence(measuredSignal, calculatedSignal, auditExists);
            const confidenceTone = measuredSignal?.confidenceTone
                || calculatedSignal?.confidenceTone
                || 'low';
            const confidenceLabel = measuredSignal?.confidenceLabel
                || calculatedSignal?.confidenceLabel
                || 'Signal à confirmer';
            const typeLabel = buildGroupTypeLabel(measured, calculated);

            let summary = 'Signal de recouvrement à confirmer.';
            if (measured.reliability === 'measured' && calculated.reliability === 'calculated') {
                summary = 'Les deux pages se partagent des requêtes mesurées et présentent aussi une proximité éditoriale ou structurelle.';
            } else if (measured.reliability === 'measured' && measured.nonBrandSharedQueryCount === 0) {
                summary = 'Le partage mesuré porte surtout sur des requêtes de marque. Signal utile, mais moins probant pour conclure à une cannibalisation hors marque.';
            } else if (measured.reliability === 'measured') {
                summary = 'Le partage de requêtes est mesuré dans Search Console. La concurrence est donc crédible, même si l’arbitrage éditorial reste à confirmer.';
            } else if (calculated.reliability === 'calculated') {
                summary = 'Le repo observe surtout un recouvrement potentiel de cadrage entre les pages, sans preuve GSC partagée sur la fenêtre courante.';
            }

            return {
                id: measuredSignal?.id || calculatedSignal?.id,
                pairKey: measuredSignal?.pairKey || calculatedSignal?.pairKey,
                pages,
                measured,
                calculated,
                ai: {
                    reliability: 'unavailable',
                    text: 'Aucune synthèse IA dédiée à cette paire de pages n’est persistée aujourd’hui. La recommandation ci-dessous reste déterministe.',
                },
                unavailable,
                confidenceTone,
                confidenceLabel,
                conflictTypeLabel: typeLabel,
                summary,
                winner,
                action,
                reliability: measured.reliability === 'measured' ? 'measured' : calculated.reliability === 'calculated' ? 'calculated' : 'unavailable',
                score: Math.max(measuredSignal?.score || 0, calculatedSignal?.score || 0),
            };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 8)
        .map((group, index) => ({
            ...group,
            title: buildGroupTitle(index, group.measured, group.calculated, group.pages),
        }));
}

export async function getSeoCannibalizationSlice(clientId) {
    const [audit, latestOpportunities, connectorRows, gscRows, clientName] = await Promise.all([
        db.getLatestAudit(clientId).catch(() => null),
        db.getLatestOpportunities(clientId).catch(() => ({ active: [], stale: [], latestAuditId: null })),
        getClientConnectorRows(clientId).catch(() => []),
        getRecentGscRows(clientId, { days: COMPARISON_WINDOW_DAYS, limit: 1600 }).catch(() => []),
        getClientName(clientId).catch(() => ''),
    ]);

    const pages = dedupePagesByUrl(toArray(audit?.extracted_data?.page_summaries))
        .slice()
        .sort(comparePages);
    const pageIndex = new Map(
        pages
            .map((page) => [normalizeUrl(page?.url), page])
            .filter(([key]) => Boolean(key)),
    );

    const currentGscRows = filterRowsSince(gscRows, getSinceDate(CURRENT_WINDOW_DAYS));
    const brandTokens = extractBrandTokens(clientName);
    const gscFreshness = buildGscFreshness(connectorRows, gscRows);
    const pagePerformance = buildPagePerformance(gscRows);
    const measuredSignals = buildMeasuredPairSignals(currentGscRows, pageIndex, brandTokens);
    const calculatedSignals = buildCalculatedPairSignals(pages);
    const groups = mergeSignals(measuredSignals, calculatedSignals, pagePerformance, Boolean(audit));
    const contentOpportunityCount = toArray(latestOpportunities?.active)
        .filter((item) => item?.status === 'open' && item?.category === 'content')
        .length;

    if (!audit && currentGscRows.length === 0) {
        return {
            emptyState: {
                title: 'Cannibalisation SEO indisponible',
                description: 'Ni audit structurel ni données Search Console exploitables ne sont disponibles. Connectez GSC ou relancez un audit avant d’ouvrir cette lecture.',
            },
        };
    }

    const auditFreshness = buildAuditFreshness(audit);
    const measuredGroupCount = groups.filter((group) => group.measured.reliability === 'measured').length;
    const winnerReadyCount = groups.filter((group) => group.winner?.page).length;
    const globalConfidence = buildGlobalConfidence(groups);
    const operatorSummary = buildOperatorSummary(groups, audit, gscFreshness);
    const reliabilityBreakdown = buildReliabilityBreakdown(groups, gscFreshness, audit);
    const actionHooks = buildActionHooks(clientId, groups, gscFreshness, contentOpportunityCount);

    return {
        available: true,
        auditMeta: {
            createdAt: audit?.created_at || null,
            sourceUrl: audit?.resolved_url || audit?.source_url || null,
            siteTypeLabel: audit?.site_classification?.label || audit?.seo_breakdown?.site_classification?.label || null,
        },
        summaryCards: [
            {
                id: 'group_count',
                label: 'Groupes détectés',
                value: groups.length,
                detail: 'Paires ou familles où un recouvrement ressort proprement',
                reliability: 'calculated',
                accent: groups.length > 0 ? 'sky' : 'slate',
            },
            {
                id: 'measured_count',
                label: 'Recouvrements mesurés',
                value: measuredGroupCount,
                detail: 'Groupes appuyés par des requêtes Search Console partagées',
                reliability: measuredGroupCount > 0 ? 'measured' : 'unavailable',
                accent: measuredGroupCount > 0 ? 'emerald' : 'amber',
            },
            {
                id: 'winner_ready',
                label: 'Page gagnante recommandable',
                value: winnerReadyCount,
                detail: 'Groupes où une page ressort proprement comme candidate principale',
                reliability: winnerReadyCount > 0 ? 'calculated' : 'unavailable',
                accent: winnerReadyCount > 0 ? 'emerald' : 'amber',
            },
            {
                id: 'global_confidence',
                label: 'Confiance globale',
                value: globalConfidence,
                detail: 'Lecture combinée de la mesure GSC, de la structure auditée et des limites actuelles',
                reliability: 'calculated',
                accent: globalConfidence === 'Élevée' ? 'emerald' : globalConfidence === 'Moyenne' ? 'amber' : 'slate',
            },
        ],
        operatorSummary,
        freshness: {
            audit: auditFreshness,
            gsc: gscFreshness,
            measured: {
                status: measuredGroupCount > 0 ? 'ok' : 'unavailable',
                reliability: measuredGroupCount > 0 ? 'measured' : 'unavailable',
                label: 'Recouvrement mesuré',
                value: measuredGroupCount > 0 ? `${measuredGroupCount} groupe(s)` : 'Indisponible',
                detail: measuredGroupCount > 0
                    ? 'Au moins un groupe est appuyé par des requêtes GSC partagées.'
                    : 'Aucune paire de pages ne se partage de requêtes mesurées sur la fenêtre courante.',
                lastObservedDate: gscFreshness.lastObservedDate || null,
                lastSyncedAt: gscFreshness.lastSyncedAt || null,
            },
        },
        reliabilityBreakdown,
        groups,
        winnerRecommendations: groups.map((group) => ({
            id: `winner_${group.id}`,
            title: group.title,
            confidenceLabel: group.confidenceLabel,
            reliability: group.winner.reliability,
            page: group.winner.page,
            why: group.winner.why,
            weakerNote: group.winner.weakerNote,
        })),
        actionRecommendations: groups.map((group) => ({
            id: `action_${group.id}`,
            title: group.title,
            confidenceLabel: group.confidenceLabel,
            reliability: group.action.reliability,
            label: group.action.label,
            why: group.action.why,
            guardrail: group.action.guardrail,
        })),
        actionHooks,
        emptyState: null,
    };
}
