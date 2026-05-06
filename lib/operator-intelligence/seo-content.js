import 'server-only';

import * as db from '@/lib/db';
import { getRecentGscRows } from '@/lib/db/gsc';
import { getClientConnectorRows } from '@/lib/connectors/repository';

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
                : 'Search Console connectée sans pages SEO observables sur la fenêtre disponible.',
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
                ? 'Données fraîches sur la fenêtre SEO active.'
                : ageDays <= 7
                    ? 'Données utilisables, mais à surveiller.'
                    : 'Données trop anciennes pour qualifier un pilotage contenu fiable.',
    };
}

function normalizePathname(pathname) {
    if (!pathname) return null;
    const normalized = pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    if (!normalized || normalized === '') return '/';
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

function getPageLabel(page) {
    const url = compactString(page?.url);
    const pathname = getPathname(url);
    if (!pathname) return page?.page_type || 'Page auditée';
    return pathname;
}

function getPrimarySegment(value) {
    const pathname = getPathname(value);
    if (!pathname || pathname === '/') return null;
    return pathname.split('/').filter(Boolean)[0] || null;
}

function prettifySegment(segment) {
    return String(segment || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pagePriority(page) {
    if (page?.page_type === 'homepage') return 0;
    if (page?.page_type === 'services') return 1;
    if (page?.page_type === 'faq') return 2;
    if (page?.page_type === 'about') return 3;
    if (page?.page_type === 'contact') return 4;
    if (page?.page_type === 'location') return 5;
    return 6;
}

function comparePages(left, right) {
    const priorityDelta = pagePriority(left) - pagePriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return String(left?.url || '').localeCompare(String(right?.url || ''), 'fr-CA');
}

function weightedPosition(impressions, weightedPositionSum, fallbackPositionSum, fallbackCount) {
    if (impressions > 0) return weightedPositionSum / impressions;
    if (fallbackCount > 0) return fallbackPositionSum / fallbackCount;
    return null;
}

function deltaPercent(currentValue, previousValue) {
    if (previousValue === null || previousValue === undefined || previousValue === 0) return null;
    return ((currentValue - previousValue) / previousValue) * 100;
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
        const current = currentMap.get(key) || { url: key, clicks: 0, impressions: 0, ctr: null, position: null };
        const previous = previousMap.get(key) || { url: key, clicks: 0, impressions: 0, ctr: null, position: null };

        performance.set(key, {
            current,
            previous,
            deltas: {
                clicksDeltaPercent: deltaPercent(current.clicks, previous.clicks),
                impressionsDeltaPercent: deltaPercent(current.impressions, previous.impressions),
                ctrDeltaPercent: current.ctr === null || previous.ctr === null || previous.ctr === 0
                    ? null
                    : ((current.ctr - previous.ctr) / previous.ctr) * 100,
                positionDelta: current.position === null || previous.position === null
                    ? null
                    : current.position - previous.position,
            },
        });
    }

    return performance;
}

function formatPercentDelta(value) {
    if (value === null || Number.isNaN(Number(value))) return null;
    const numeric = Number(value);
    const prefix = numeric > 0 ? '+' : '';
    return `${prefix}${numeric.toFixed(1)}%`;
}

function formatPositionDelta(value) {
    if (value === null || Number.isNaN(Number(value))) return null;
    const numeric = Number(value);
    const prefix = numeric > 0 ? '+' : '';
    return `${prefix}${numeric.toFixed(1)}`;
}

function formatPageEvidence(page, performance) {
    const parts = [
        `${toNumber(page?.word_count)} mots visibles`,
        `${toNumber(page?.faq_pairs_count)} FAQ`,
        `${toNumber(page?.citability?.block_count)} bloc(s) citable(s)`,
    ];

    if (performance?.current?.impressions > 0) {
        parts.push(`${performance.current.impressions.toLocaleString('fr-FR')} impressions Search Console (28 j)`);
    }

    return parts.join(' · ');
}

function pickRicherText(left, right) {
    const leftValue = compactString(left);
    const rightValue = compactString(right);

    if (!leftValue) return rightValue;
    if (!rightValue) return leftValue;

    return rightValue.length > leftValue.length ? rightValue : leftValue;
}

function getPageRichnessScore(page) {
    return toNumber(page?.word_count)
        + toNumber(page?.faq_pairs_count) * 20
        + toNumber(page?.citability?.block_count) * 10
        + toNumber(page?.service_signal_count) * 5;
}

function mergePageSummaries(existingPage, incomingPage) {
    const preferredPage = getPageRichnessScore(incomingPage) > getPageRichnessScore(existingPage)
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

function buildCoverage(pages, audit) {
    const directAnswerCount = pages.filter((page) => toNumber(page?.faq_pairs_count) > 0 || toNumber(page?.citability?.block_count) > 0).length;
    const citabilityPageCount = pages.filter((page) => toNumber(page?.citability?.block_count) > 0).length;
    const servicePageCount = pages.filter((page) => page?.page_type === 'services').length;
    const trustSupportCount = pages.filter((page) => ['about', 'contact'].includes(page?.page_type)).length;

    return {
        directAnswerCount,
        citabilityPageCount,
        servicePageCount,
        trustSupportCount,
        roleSummary: [
            { id: 'pivot', label: 'Pages pivot', value: pages.filter((page) => page?.page_type === 'homepage').length },
            { id: 'service', label: 'Pages service', value: servicePageCount },
            { id: 'reponse', label: 'Pages réponse', value: pages.filter((page) => page?.page_type === 'faq' || toNumber(page?.faq_pairs_count) > 0).length },
            { id: 'confiance', label: 'Supports confiance', value: trustSupportCount },
        ],
        summary: `${directAnswerCount}/${pages.length} page(s) exposent déjà FAQ ou blocs réutilisables.`,
        evidence: `${toNumber(audit?.extracted_data?.page_stats?.total_word_count)} mots visibles audités · ${citabilityPageCount} page(s) avec citabilité mesurée.`,
    };
}

function buildProvisionalClusters(pages) {
    const bySegment = new Map();

    for (const page of pages || []) {
        const segment = getPrimarySegment(page?.url);
        if (!segment) continue;

        if (!bySegment.has(segment)) bySegment.set(segment, []);
        bySegment.get(segment).push(page);
    }

    const segmentClusters = Array.from(bySegment.entries())
        .filter(([, members]) => members.length >= 2)
        .map(([segment, members]) => {
            const sortedMembers = members.slice().sort(comparePages);
            const exactHubPath = `/${segment}`;
            const hubPage = sortedMembers.find((page) => getPathname(page?.url) === exactHubPath) || sortedMembers[0];
            const supportPages = sortedMembers.filter((page) => normalizeUrl(page?.url) !== normalizeUrl(hubPage?.url));

            return {
                id: `segment_${segment}`,
                label: prettifySegment(segment),
                detectionLabel: 'Groupement provisoire',
                detectionDetail: 'Structure d’URL observée',
                evidence: `${sortedMembers.length} page(s) partagent le segment /${segment}.`,
                reliability: 'calculated',
                hasExplicitHub: getPathname(hubPage?.url) === exactHubPath,
                hubPage: hubPage
                    ? {
                        label: getPageLabel(hubPage),
                        url: compactString(hubPage?.url),
                    }
                    : null,
                supportPages: supportPages.map((page) => ({
                    label: getPageLabel(page),
                    url: compactString(page?.url),
                })),
            };
        })
        .sort((left, right) => right.supportPages.length - left.supportPages.length);

    if (segmentClusters.length > 0) return segmentClusters.slice(0, 6);

    const fallbackTypes = ['services', 'faq', 'location'];
    return fallbackTypes
        .map((pageType) => {
            const members = pages.filter((page) => page?.page_type === pageType);
            if (members.length < 2) return null;

            return {
                id: `type_${pageType}`,
                label: pageType === 'services' ? 'Pages service' : pageType === 'faq' ? 'Pages réponse' : 'Pages locales observées',
                detectionLabel: 'Groupement provisoire',
                detectionDetail: 'Type de page détecté',
                evidence: `${members.length} page(s) de type ${pageType} dans le dernier audit.`,
                reliability: 'calculated',
                hasExplicitHub: false,
                hubPage: null,
                supportPages: members.slice(0, 4).map((page) => ({
                    label: getPageLabel(page),
                    url: compactString(page?.url),
                })),
            };
        })
        .filter(Boolean);
}

function buildClusterMembership(clusters) {
    const membership = new Map();

    for (const cluster of clusters || []) {
        if (cluster?.hubPage?.url) {
            membership.set(normalizeUrl(cluster.hubPage.url), { cluster, role: 'hub' });
        }

        for (const page of cluster?.supportPages || []) {
            if (!page?.url) continue;
            membership.set(normalizeUrl(page.url), { cluster, role: 'support' });
        }
    }

    return membership;
}

function inferPageRole(page, membership) {
    const pageKey = normalizeUrl(page?.url);
    const clusterInfo = pageKey ? membership.get(pageKey) : null;

    if (clusterInfo?.role === 'hub') {
        return {
            role: 'Hub',
            detail: `Point d’entrée éditorial principal pour ${clusterInfo.cluster.label}.`,
        };
    }

    if (clusterInfo?.role === 'support') {
        return {
            role: 'Support',
            detail: `Page satellite rattachée au groupement ${clusterInfo.cluster.label}.`,
        };
    }

    if (page?.page_type === 'homepage') {
        return {
            role: 'Page pivot',
            detail: 'Point d’entrée principal du site observé.',
        };
    }

    if (page?.page_type === 'services') {
        return {
            role: 'Page service',
            detail: 'Page qui porte une offre ou un périmètre de service identifié.',
        };
    }

    if (page?.page_type === 'faq' || toNumber(page?.faq_pairs_count) > 0) {
        return {
            role: 'Page réponse',
            detail: 'Support de questions/réponses ou de réponses directes.',
        };
    }

    if (page?.page_type === 'about' || page?.page_type === 'contact') {
        return {
            role: 'Support confiance',
            detail: 'Renfort identité, preuve ou conversion.',
        };
    }

    if (toNumber(page?.citability?.block_count) > 0) {
        return {
            role: 'Support éditorial',
            detail: 'Page avec blocs déjà réutilisables dans la lecture contenu.',
        };
    }

    return {
        role: 'À qualifier',
        detail: 'Rôle éditorial non inférable proprement depuis les signaux actuels.',
    };
}

function buildPageRoles(pages, clusters) {
    const membership = buildClusterMembership(clusters);

    return pages
        .slice()
        .sort(comparePages)
        .map((page) => {
            const role = inferPageRole(page, membership);
            return {
                id: normalizeUrl(page?.url) || `${page?.page_type || 'page'}_${getPageLabel(page)}`,
                label: getPageLabel(page),
                url: compactString(page?.url),
                role: role.role,
                detail: role.detail,
                evidence: formatPageEvidence(page),
                reliability: 'calculated',
            };
        })
        .slice(0, 10);
}

function buildContentDecay(pages, pagePerformance, gscFreshness) {
    if (gscFreshness.reliability === 'unavailable') {
        return {
            status: 'unavailable',
            reliability: 'unavailable',
            description: 'Aucune série Search Console exploitable n’est disponible pour mesurer un décrochage de pages.',
            items: [],
        };
    }

    const items = pages
        .map((page) => {
            const performance = pagePerformance.get(normalizeUrl(page?.url));
            const previousImpressions = toNumber(performance?.previous?.impressions);
            const currentImpressions = toNumber(performance?.current?.impressions);
            const clickDelta = performance?.deltas?.clicksDeltaPercent ?? null;
            const impressionDelta = performance?.deltas?.impressionsDeltaPercent ?? null;
            const positionDelta = performance?.deltas?.positionDelta ?? null;
            const signals = [];

            if (previousImpressions >= 20 && clickDelta !== null && clickDelta <= -20) {
                signals.push(`${formatPercentDelta(clickDelta)} de clics`);
            }

            if (previousImpressions >= 40 && impressionDelta !== null && impressionDelta <= -20) {
                signals.push(`${formatPercentDelta(impressionDelta)} d’impressions`);
            }

            if (previousImpressions >= 20 && positionDelta !== null && positionDelta >= 2) {
                signals.push(`${formatPositionDelta(positionDelta)} positions`);
            }

            if (signals.length === 0) return null;

            const severityScore = signals.length * 10 + Math.max(previousImpressions, currentImpressions);

            return {
                id: `decay_${normalizeUrl(page?.url) || getPageLabel(page)}`,
                title: `Décrochage détecté sur ${getPageLabel(page)}`,
                label: getPageLabel(page),
                url: compactString(page?.url),
                source: 'Search Console 56 jours + dernier audit',
                why: signals.join(' · '),
                evidence: `Période actuelle: ${currentImpressions.toLocaleString('fr-FR')} impressions / ${toNumber(performance?.current?.clicks).toLocaleString('fr-FR')} clics. Période précédente: ${previousImpressions.toLocaleString('fr-FR')} impressions / ${toNumber(performance?.previous?.clicks).toLocaleString('fr-FR')} clics.`,
                impact: 'Confirmer si la page doit être retravaillée avant que le recul ne s’installe.',
                reliability: 'calculated',
                severityScore,
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.severityScore - left.severityScore)
        .slice(0, 6);

    return {
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: items.length > 0
            ? 'Décrochages mesurés en comparant les 28 derniers jours au bloc précédent.'
            : 'Aucun décrochage majeur ne ressort sur la fenêtre Search Console disponible.',
        items,
    };
}

function buildRefreshOpportunities(pages, pagePerformance) {
    const importantTypes = new Set(['homepage', 'services', 'faq']);

    const items = pages
        .map((page) => {
            const reasons = [];
            const titleLength = String(page?.title || '').trim().length;
            const descriptionLength = String(page?.description || '').trim().length;
            const h1Overlap = overlapScore(page?.title, page?.h1);
            const hasDirectAnswer = toNumber(page?.faq_pairs_count) > 0 || toNumber(page?.citability?.block_count) > 0;
            const performance = pagePerformance.get(normalizeUrl(page?.url));
            const currentImpressions = toNumber(performance?.current?.impressions);

            if (titleLength === 0 || titleLength < 35) reasons.push('title absent ou trop court');
            if (descriptionLength === 0 || descriptionLength < 70) reasons.push('meta description absente ou trop courte');
            if (!compactString(page?.h1)) reasons.push('H1 absent');
            else if (compactString(page?.title) && h1Overlap < 0.35) reasons.push('H1 peu aligné avec le title');
            if (importantTypes.has(page?.page_type) && !hasDirectAnswer) reasons.push('aucune réponse directe exploitable');
            if (toNumber(page?.word_count) < 180 || (toNumber(page?.word_count) < 260 && toNumber(page?.service_signal_count) === 0)) {
                reasons.push('contenu encore trop léger ou trop générique');
            }
            if (toNumber(page?.citability?.block_count) > 0 && toNumber(page?.citability?.page_score) < 40) {
                reasons.push('blocs citables trop faibles');
            }

            if (reasons.length === 0) return null;

            const priorityScore = reasons.length * 10
                + currentImpressions
                + (page?.page_type === 'homepage' ? 20 : 0)
                + (page?.page_type === 'services' ? 10 : 0);

            let impact = 'Rendre la page plus claire, plus utile et plus exploitable côté SEO contenu.';
            if (reasons.some((reason) => reason.includes('réponse directe') || reason.includes('citables'))) {
                impact = 'Renforcer la capacité de la page à répondre clairement et à être réutilisée.';
            } else if (reasons.some((reason) => reason.includes('title') || reason.includes('H1') || reason.includes('meta'))) {
                impact = 'Clarifier l’intention servie et le cadrage éditorial de la page.';
            }

            return {
                id: `refresh_${normalizeUrl(page?.url) || getPageLabel(page)}`,
                title: `Retravailler ${getPageLabel(page)}`,
                label: getPageLabel(page),
                url: compactString(page?.url),
                source: currentImpressions > 0 ? 'Dernier audit + Search Console' : 'Dernier audit',
                why: reasons.join(' · '),
                evidence: formatPageEvidence(page, performance),
                impact,
                reliability: 'calculated',
                priorityScore,
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.priorityScore - left.priorityScore)
        .slice(0, 6);

    return {
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: items.length > 0
            ? 'Pages à retravailler à partir des faiblesses on-page réellement observées.'
            : 'Aucune page ne cumule de faiblesse éditoriale dominante sur les signaux actuels.',
        items,
    };
}

function buildMissingPages(audit, pages, clusters) {
    const extracted = audit?.extracted_data || {};
    const pageStats = extracted.page_stats || {};
    const servicesPreview = toArray(extracted?.service_signals?.services).map((value) => compactString(value)).filter(Boolean).slice(0, 4);
    const items = [];

    if (toNumber(pageStats.service_pages) === 0) {
        items.push({
            id: 'missing_service_pages',
            title: 'Créer des pages service dédiées',
            source: 'Signaux service observés dans l’audit',
            why: 'Aucune page service n’a été détectée alors que des services ressortent du contenu.',
            evidence: servicesPreview.length > 0
                ? `Services observés: ${servicesPreview.join(' · ')}.`
                : 'Aucune page de type service n’a été observée dans le crawl.',
            impact: 'Mieux cadrer l’offre et ses intentions de recherche sans surcharger la page pivot.',
            reliability: 'calculated',
        });
    }

    if (toArray(extracted?.faq_pairs).length === 0) {
        items.push({
            id: 'missing_faq_page',
            title: 'Créer une page ou section FAQ',
            source: 'FAQ absente du dernier audit',
            why: 'Aucune paire FAQ / QA ni schéma FAQ observés.',
            evidence: 'Le mandat ne montre pas encore de support de réponses directes structuré.',
            impact: 'Renforcer la couverture des questions acheteurs et la réponse directe.',
            reliability: 'calculated',
        });
    }

    if (toNumber(pageStats.about_pages) === 0) {
        items.push({
            id: 'missing_about_page',
            title: 'Créer une page À propos / preuves',
            source: 'Pages support confiance',
            why: 'Aucune page de type À propos n’a été observée.',
            evidence: 'Le mandat manque d’un support éditorial dédié à l’identité et aux preuves.',
            impact: 'Renforcer l’explicitation de l’expertise et des signaux de confiance.',
            reliability: 'calculated',
        });
    }

    if (toNumber(pageStats.contact_pages) === 0) {
        items.push({
            id: 'missing_contact_page',
            title: 'Créer une page Contact structurée',
            source: 'Pages support confiance',
            why: 'Aucune page Contact n’a été observée dans le crawl.',
            evidence: 'La lecture contenu ne détecte pas de support contact proprement dédié.',
            impact: 'Clarifier la conversion et la complétude éditoriale des surfaces clés.',
            reliability: 'calculated',
        });
    }

    for (const cluster of clusters || []) {
        if (cluster.hasExplicitHub) continue;

        items.push({
            id: `missing_hub_${cluster.id}`,
            title: `Créer une page hub pour ${cluster.label}`,
            source: 'Structure d’URL observée',
            why: 'Plusieurs pages support sont visibles sans page d’entrée éditoriale dédiée.',
            evidence: cluster.evidence,
            impact: 'Donner un point d’entrée plus clair au groupement et mieux répartir les pages support.',
            reliability: 'calculated',
        });
    }

    return {
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: items.length > 0
            ? 'Manques structurels déduits du dernier audit et de la structure réellement observée.'
            : 'Aucun manque structurel dominant ne ressort sur les types de pages déjà observés.',
        items: items.slice(0, 6),
    };
}

function buildMergeOpportunities(pages, clusters) {
    const membership = buildClusterMembership(clusters);
    const mergeCandidates = [];

    for (let index = 0; index < pages.length; index += 1) {
        const left = pages[index];
        const leftPath = normalizeUrl(left?.url);
        const leftClusterInfo = leftPath ? membership.get(leftPath) : null;
        if (['homepage', 'about', 'contact'].includes(left?.page_type)) continue;

        for (let offset = index + 1; offset < pages.length; offset += 1) {
            const right = pages[offset];
            const rightPath = normalizeUrl(right?.url);
            const rightClusterInfo = rightPath ? membership.get(rightPath) : null;
            if (['homepage', 'about', 'contact'].includes(right?.page_type)) continue;

            if (leftClusterInfo?.cluster?.id && leftClusterInfo.cluster.id === rightClusterInfo?.cluster?.id) {
                if (leftClusterInfo.role === 'hub' || rightClusterInfo.role === 'hub') continue;
            }

            const overlap = overlapScore(
                `${left?.title || ''} ${left?.h1 || ''}`,
                `${right?.title || ''} ${right?.h1 || ''}`,
            );
            const shared = sharedTokens(
                `${left?.title || ''} ${left?.h1 || ''}`,
                `${right?.title || ''} ${right?.h1 || ''}`,
            ).slice(0, 4);
            const sameSegment = getPrimarySegment(left?.url) && getPrimarySegment(left?.url) === getPrimarySegment(right?.url);

            if (shared.length < 2) continue;
            if (!(overlap >= 0.65 || (sameSegment && overlap >= 0.45))) continue;

            mergeCandidates.push({
                id: `merge_${leftPath}_${rightPath}`,
                title: `Évaluer un merge entre ${getPageLabel(left)} et ${getPageLabel(right)}`,
                source: sameSegment ? `Même segment /${getPrimarySegment(left?.url)}` : 'Titres/H1 proches',
                why: `Recouvrement lexical détecté (${Math.round(overlap * 100)}%).`,
                evidence: `Tokens communs: ${shared.join(', ')}.`,
                impact: 'Réduire le recouvrement thématique si les deux pages servent réellement la même intention.',
                reliability: 'calculated',
                score: overlap,
                pages: [
                    { label: getPageLabel(left), url: compactString(left?.url) },
                    { label: getPageLabel(right), url: compactString(right?.url) },
                ],
            });
        }
    }

    return {
        status: mergeCandidates.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: mergeCandidates.length > 0
            ? 'Rapprochements proposés uniquement quand le recouvrement lexical est réellement observable.'
            : 'Aucun recouvrement thématique net n’est assez propre pour suggérer une consolidation.',
        items: mergeCandidates
            .sort((left, right) => right.score - left.score)
            .slice(0, 5),
    };
}

function buildTopOpportunities({ contentOpportunityCount, contentDecay, refreshOpportunities, missingPages, mergeOpportunities }) {
    const items = [];

    if (contentOpportunityCount > 0) {
        items.push({
            id: 'queue_content',
            title: `${contentOpportunityCount} opportunité(s) contenu déjà en file`,
            description: 'La file d’actions existante contient déjà des sujets contenu ouverts à arbitrer ou traiter.',
            reliability: 'calculated',
            href: '#hooks',
        });
    }

    contentDecay.items.slice(0, 1).forEach((item) => {
        items.push({
            id: `top_${item.id}`,
            title: item.title,
            description: item.why,
            reliability: item.reliability,
            href: '#decay',
        });
    });

    refreshOpportunities.items.slice(0, 2).forEach((item) => {
        items.push({
            id: `top_${item.id}`,
            title: item.title,
            description: item.why,
            reliability: item.reliability,
            href: '#refresh',
        });
    });

    missingPages.items.slice(0, 2).forEach((item) => {
        items.push({
            id: `top_${item.id}`,
            title: item.title,
            description: item.why,
            reliability: item.reliability,
            href: '#missing',
        });
    });

    mergeOpportunities.items.slice(0, 1).forEach((item) => {
        items.push({
            id: `top_${item.id}`,
            title: item.title,
            description: item.why,
            reliability: item.reliability,
            href: '#merge',
        });
    });

    return items.slice(0, 5);
}

function getPromptableHealthHookCount(audit) {
    return toArray(audit?.issues).filter((issue) => {
        const title = `${issue?.title || ''} ${issue?.description || ''}`.toLowerCase();
        return title.includes('faq') || title.includes('llms.txt') || title.includes('crawler');
    }).length;
}

function buildActionHooks(clientId, contentOpportunityCount, promptableHealthHookCount) {
    const baseHref = `/admin/clients/${clientId}`;

    return [
        {
            id: 'queue',
            title: 'File d’actions existante',
            description: contentOpportunityCount > 0
                ? `${contentOpportunityCount} opportunité(s) contenu sont déjà ouvertes dans la file opérateur.`
                : 'La file d’actions reste aujourd’hui le point de traitement opérateur quand une action contenu doit être prise en charge.',
            href: `${baseHref}/seo/opportunities`,
            cta: 'Ouvrir Opportunités SEO',
            reliability: 'calculated',
        },
        {
            id: 'on-page',
            title: 'Lecture on-page détaillée',
            description: 'Les preuves page par page restent détaillées dans la surface on-page existante, sans dupliquer toute la lecture ici.',
            href: `${baseHref}/seo/on-page`,
            cta: 'Ouvrir on-page',
            reliability: 'calculated',
        },
        promptableHealthHookCount > 0
            ? {
                id: 'health-prompts',
                title: 'Hooks de correction déjà branchés',
                description: `${promptableHealthHookCount} signal(aux) disposent déjà d’une entrée de correction dans Santé SEO.`,
                href: `${baseHref}/seo/health#issues`,
                cta: 'Voir santé SEO',
                reliability: 'calculated',
            }
            : {
                id: 'future-prompts',
                title: 'Prompts contenu dédiés',
                description: 'Le branchement d’un moteur de prompts contenu dédié n’est pas encore stabilisé. Aucun faux générateur n’est exposé ici.',
                href: null,
                cta: 'Branchement futur',
                reliability: 'unavailable',
            },
    ];
}

function buildOperatorSummary({ pages, coverage, contentDecay, refreshOpportunities, missingPages, clusters, contentOpportunityCount }) {
    const parts = [
        `Lecture construite sur ${pages.length} page(s) auditées. ${coverage.summary}`,
    ];

    if (contentDecay.items.length > 0) {
        parts.push(`${contentDecay.items.length} décrochage(s) Search Console ressortent sur la fenêtre mesurée.`);
    }

    if (refreshOpportunities.items.length > 0) {
        parts.push(`${refreshOpportunities.items.length} page(s) méritent un retravail éditorial prioritaire.`);
    }

    if (missingPages.items.length > 0) {
        parts.push(`${missingPages.items.length} manque(s) structurels freinent encore la couverture éditoriale.`);
    }

    if (clusters.length === 0) {
        parts.push('Aucun cluster éditorial propre n’est encore inférable depuis la structure observée.');
    }

    if (contentOpportunityCount > 0) {
        parts.push(`${contentOpportunityCount} sujet(s) contenu sont déjà remontés dans la file d’actions.`);
    }

    return {
        text: parts.join(' '),
        note: 'Cette vue ne mesure pas encore la date de mise à jour éditoriale page par page ; elle assemble seulement des preuves réellement stockées ou des calculs déterministes.',
        reliability: 'calculated',
    };
}

export async function getSeoContentSlice(clientId) {
    const [audit, latestOpportunities, connectorRows, gscRows] = await Promise.all([
        db.getLatestAudit(clientId).catch(() => null),
        db.getLatestOpportunities(clientId).catch(() => ({ active: [], stale: [], latestAuditId: null })),
        getClientConnectorRows(clientId).catch(() => []),
        getRecentGscRows(clientId, { days: COMPARISON_WINDOW_DAYS, limit: 1200 }).catch(() => []),
    ]);

    if (!audit) {
        return {
            emptyState: {
                title: 'Contenu SEO indisponible',
                description: 'Aucun audit exploitable n’est disponible pour ouvrir une surface contenu honnête. Relancez un audit avant de piloter cette lecture.',
            },
        };
    }

    const pages = dedupePagesByUrl(toArray(audit?.extracted_data?.page_summaries))
        .slice()
        .sort(comparePages);

    if (pages.length === 0) {
        return {
            emptyState: {
                title: 'Contenu SEO indisponible',
                description: 'Le dernier audit ne contient pas de `page_summaries` exploitables pour une lecture contenu fiable.',
            },
        };
    }

    const gscFreshness = buildGscFreshness(connectorRows, gscRows);
    const pagePerformance = buildPagePerformance(gscRows);
    const coverage = buildCoverage(pages, audit);
    const clusters = buildProvisionalClusters(pages);
    const pageRoles = buildPageRoles(pages, clusters);
    const contentDecay = buildContentDecay(pages, pagePerformance, gscFreshness);
    const refreshOpportunities = buildRefreshOpportunities(pages, pagePerformance);
    const missingPages = buildMissingPages(audit, pages, clusters);
    const mergeOpportunities = buildMergeOpportunities(pages, clusters);
    const contentOpportunityCount = toArray(latestOpportunities?.active)
        .filter((item) => item?.status === 'open' && item?.category === 'content')
        .length;
    const topOpportunities = buildTopOpportunities({
        contentOpportunityCount,
        contentDecay,
        refreshOpportunities,
        missingPages,
        mergeOpportunities,
    });
    const promptableHealthHookCount = getPromptableHealthHookCount(audit);
    const actionHooks = buildActionHooks(clientId, contentOpportunityCount, promptableHealthHookCount);
    const operatorSummary = buildOperatorSummary({
        pages,
        coverage,
        contentDecay,
        refreshOpportunities,
        missingPages,
        clusters,
        contentOpportunityCount,
    });

    return {
        auditMeta: {
            createdAt: audit?.created_at || null,
            sourceUrl: audit?.resolved_url || audit?.source_url || null,
            siteTypeLabel: audit?.site_classification?.label || audit?.seo_breakdown?.site_classification?.label || null,
        },
        summaryCards: [
            {
                id: 'latest_audit',
                label: 'Dernier audit',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: 'Référence active pour cette lecture contenu',
                reliability: 'measured',
                accent: 'emerald',
            },
            {
                id: 'pages_analyzed',
                label: 'Pages observées',
                value: pages.length,
                detail: 'Pages conservées dans l’échantillon audité',
                reliability: 'calculated',
                accent: 'sky',
            },
            {
                id: 'editorial_coverage',
                label: 'Couverture éditoriale',
                value: `${coverage.directAnswerCount}/${pages.length}`,
                detail: 'Pages avec FAQ ou blocs déjà réutilisables',
                reliability: 'calculated',
                accent: coverage.directAnswerCount > 0 ? 'emerald' : 'amber',
            },
            {
                id: 'priority_count',
                label: 'Priorités visibles',
                value: topOpportunities.length,
                detail: 'Refresh, manques, merges ou décrochages réellement observés',
                reliability: 'calculated',
                accent: topOpportunities.length > 0 ? 'amber' : 'slate',
            },
        ],
        operatorSummary,
        freshness: {
            audit: {
                status: audit?.created_at ? 'ok' : 'unavailable',
                reliability: audit?.created_at ? 'measured' : 'unavailable',
                label: 'Audit contenu',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: 'Fraîcheur de la preuve audit disponible',
            },
            gsc: gscFreshness,
            pageFreshness: {
                status: 'unavailable',
                reliability: 'unavailable',
                label: 'Fraîcheur page par page',
                value: 'Indisponible',
                detail: 'Aucune date de mise à jour éditoriale par page n’est stockée aujourd’hui.',
            },
        },
        coverage,
        topOpportunities,
        clusters,
        pageRoles,
        contentDecay,
        refreshOpportunities,
        missingPages,
        mergeOpportunities,
        actionHooks,
        emptyState: null,
    };
}
