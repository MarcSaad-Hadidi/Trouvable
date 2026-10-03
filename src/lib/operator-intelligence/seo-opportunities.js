import 'server-only';

import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getRecentGscRows } from '@/lib/db/gsc';

import { getSeoCannibalizationSlice } from './seo-cannibalization';
import { getSeoContentSlice } from './seo-content';
import { getSeoOnPageSlice } from './seo-on-page';
import { getVisibilitySlice } from './visibility';

const CURRENT_WINDOW_DAYS = 28;

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

function getSinceDate(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function filterRowsSince(rows, sinceDate) {
    return (rows || []).filter((row) => String(row?.date || '') >= sinceDate);
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
        return normalizePathname(value);
    }
}

function normalizeUrl(value) {
    if (!value) return null;

    try {
        const parsed = new URL(value);
        return `${parsed.origin}${normalizePathname(parsed.pathname || '/')}`.toLowerCase();
    } catch {
        return compactString(value)?.toLowerCase() || null;
    }
}

function getPageLabelFromUrl(value) {
    const pathname = getPathname(value);
    return pathname || compactString(value) || 'Page observée';
}

function pageTypeLabel(pageType) {
    if (pageType === 'homepage') return 'Page pivot';
    if (pageType === 'services') return 'Page service';
    if (pageType === 'faq') return 'Page réponse';
    if (pageType === 'location') return 'Page locale';
    if (pageType === 'about') return 'Support confiance';
    if (pageType === 'contact') return 'Support contact';
    return 'Page auditée';
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
                key,
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
                key,
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

function buildPageIndex(audit) {
    const index = new Map();

    for (const page of toArray(audit?.extracted_data?.page_summaries)) {
        const key = normalizeUrl(page?.url);
        if (!key || index.has(key)) continue;
        index.set(key, page);
    }

    return index;
}

function resolvePriority(score) {
    if (score >= 180) {
        return { label: 'Maintenant', tone: 'critical' };
    }
    if (score >= 95) {
        return { label: 'Ensuite', tone: 'warning' };
    }
    return { label: 'À planifier', tone: 'default' };
}

function buildMetrics(metrics) {
    return metrics.filter((metric) => metric.value !== null && metric.value !== undefined);
}

function makeOpportunityItem({
    id,
    title,
    source,
    why,
    evidence,
    impact,
    reliability = 'calculated',
    score = 0,
    href = null,
    cta = null,
    pages = [],
    metrics = [],
    note = null,
    confidenceLabel = null,
    actionLabel = null,
}) {
    const priority = resolvePriority(score);

    return {
        id,
        title,
        source,
        why,
        evidence,
        impact,
        reliability,
        priorityLabel: priority.label,
        priorityTone: priority.tone,
        score,
        href,
        cta,
        pages,
        metrics,
        note,
        confidenceLabel,
        actionLabel,
    };
}

function createSection({ status, reliability, description, items }) {
    return {
        status,
        reliability,
        description,
        items,
    };
}

function getPageWeight(pageType) {
    if (pageType === 'homepage') return 70;
    if (pageType === 'services') return 45;
    if (pageType === 'faq') return 30;
    if (pageType === 'location') return 24;
    return 12;
}

function dedupeItems(items) {
    const seen = new Set();
    const deduped = [];

    for (const item of items || []) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        deduped.push(item);
    }

    return deduped;
}

function buildPagesInBandSection(clientId, pageMetricsMap, pageIndex, gscFreshness) {
    if (gscFreshness?.reliability === 'unavailable') {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: 'Search Console n’est pas disponible pour repérer les pages déjà visibles entre les positions 4 et 20.',
            items: [],
        });
    }

    const baseHref = `/admin/clients/${clientId}/seo/visibility`;
    const items = Array.from(pageMetricsMap.values())
        .filter((page) => page.position !== null && page.position >= 4 && page.position <= 20 && page.impressions >= 20)
        .map((page) => {
            const auditPage = pageIndex.get(page.key) || null;
            const pageType = auditPage?.page_type || null;
            const label = getPageLabelFromUrl(page.url);
            const score = Math.round(page.impressions + Math.max(0, 20 - page.position) * 12 + getPageWeight(pageType));

            return makeOpportunityItem({
                id: `band_${page.key}`,
                title: `Pousser ${label} vers le top 3`,
                source: 'Search Console · fenêtre 28 jours',
                why: `Page déjà visible autour de la position ${page.position?.toFixed(1) || 'n.d.'} avec un volume exploitable d’impressions.`,
                evidence: `${page.impressions.toLocaleString('fr-FR')} impressions et ${page.clicks.toLocaleString('fr-FR')} clics observés sur la fenêtre active.`,
                impact: 'Transformer une visibilité déjà installée en trafic supplémentaire sans ouvrir un chantier net de nouvelle page.',
                reliability: 'calculated',
                score,
                href: baseHref,
                cta: 'Ouvrir Visibilité SEO',
                pages: [{
                    label,
                    url: compactString(page.url),
                    role: pageType ? pageTypeLabel(pageType) : null,
                }],
                metrics: buildMetrics([
                    { label: 'Position', type: 'position', value: page.position },
                    { label: 'Impressions', type: 'number', value: page.impressions },
                    { label: 'CTR', type: 'percent', value: page.ctr },
                    { label: 'Clics', type: 'number', value: page.clicks },
                ]),
                note: pageType ? `Type observé: ${pageTypeLabel(pageType)}.` : null,
            });
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);

    return createSection({
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: items.length > 0
            ? 'Pages déjà visibles hors top 3, où un travail ciblé peut encore faire progresser le trafic organique.'
            : 'Aucune page ne ressort proprement dans la bande 4 à 20 avec assez de visibilité pour ouvrir une priorité dédiée.',
        items,
    });
}

function buildClickGapSection(clientId, pageMetricsMap, pageIndex, gscFreshness) {
    if (gscFreshness?.reliability === 'unavailable') {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: 'Sans Search Console exploitable, la page ne peut pas isoler un écart de clic réel.',
            items: [],
        });
    }

    const baseHref = `/admin/clients/${clientId}/seo/visibility`;
    const items = Array.from(pageMetricsMap.values())
        .filter((page) => page.position !== null && page.position >= 4 && page.position <= 20 && page.impressions >= 60)
        .map((page) => {
            const auditPage = pageIndex.get(page.key) || null;
            const label = getPageLabelFromUrl(page.url);
            const pageType = auditPage?.page_type || null;
            const score = Math.round(page.impressions + Math.max(0, 12 - page.position) * 18 + getPageWeight(pageType));

            return makeOpportunityItem({
                id: `click_gap_${page.key}`,
                title: `Récupérer plus de clics sur ${label}`,
                source: 'Search Console · exposition déjà mesurée',
                why: `La page prend déjà de la visibilité organique, mais convertit encore peu cette exposition en clics utiles.`,
                evidence: `${page.impressions.toLocaleString('fr-FR')} impressions, ${page.clicks.toLocaleString('fr-FR')} clics, CTR ${page.ctr === null ? 'n.d.' : `${(page.ctr * 100).toFixed(1)}%`} et position moyenne ${page.position?.toFixed(1) || 'n.d.'}.`,
                impact: 'Priorité adaptée à un travail de snippet, de cadrage éditorial ou de réponse directe avant de lancer une nouvelle page.',
                reliability: 'calculated',
                score,
                href: baseHref,
                cta: 'Creuser la visibilité',
                pages: [{
                    label,
                    url: compactString(page.url),
                    role: pageType ? pageTypeLabel(pageType) : null,
                }],
                metrics: buildMetrics([
                    { label: 'Position', type: 'position', value: page.position },
                    { label: 'Impressions', type: 'number', value: page.impressions },
                    { label: 'CTR', type: 'percent', value: page.ctr },
                ]),
            });
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);

    return createSection({
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: items.length > 0
            ? 'Pages où l’exposition organique existe déjà et où un retravail rapide peut d’abord viser le clic avant d’ouvrir un nouveau chantier.'
            : 'Aucun écart de clic dominant ne ressort sur la fenêtre Search Console courante.',
        items,
    });
}

function buildMetadataSection(clientId, onPage, pageMetricsMap, pageIndex) {
    if (onPage?.emptyState) {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: onPage.emptyState.description,
            items: [],
        });
    }

    const configs = {
        weak_titles: {
            titlePrefix: 'Renforcer le title de',
            impact: 'Clarifier l’intention servie et rendre le snippet plus compétitif sur une visibilité déjà existante.',
            baseScore: 70,
        },
        weak_metas: {
            titlePrefix: 'Réécrire la meta de',
            impact: 'Mieux expliciter la promesse, le service ou le contexte pour soutenir le clic organique.',
            baseScore: 62,
        },
        misaligned_h1: {
            titlePrefix: 'Réaligner le H1 de',
            impact: 'Rendre la page plus cohérente entre title, H1 et intention servie avant un retravail plus lourd.',
            baseScore: 54,
        },
    };

    const baseHref = `/admin/clients/${clientId}/seo/on-page#blocks`;
    const items = [];

    for (const block of toArray(onPage?.blocks)) {
        const config = configs[block?.id];
        if (!config) continue;

        for (const blockItem of toArray(block?.items)) {
            const pageKey = normalizeUrl(blockItem?.url);
            const metrics = pageKey ? pageMetricsMap.get(pageKey) : null;
            const auditPage = pageKey ? pageIndex.get(pageKey) : null;
            const pageType = auditPage?.page_type || null;
            const score = Math.round(config.baseScore + toNumber(metrics?.impressions) + getPageWeight(pageType));
            const label = blockItem?.label || getPageLabelFromUrl(blockItem?.url);

            items.push(makeOpportunityItem({
                id: `${block.id}_${pageKey || label}`,
                title: `${config.titlePrefix} ${label}`,
                source: block.title,
                why: blockItem?.evidence || block.summary || 'Signal on-page observé dans le dernier audit.',
                evidence: metrics
                    ? `${toNumber(metrics.impressions).toLocaleString('fr-FR')} impressions et position moyenne ${metrics.position?.toFixed(1) || 'n.d.'} sur Search Console.`
                    : `Signal issu du dernier audit sur ${label}.`,
                impact: config.impact,
                reliability: block.reliability || 'calculated',
                score,
                href: baseHref,
                cta: 'Ouvrir l’on-page',
                pages: blockItem?.url ? [{
                    label,
                    url: compactString(blockItem.url),
                    role: pageType ? pageTypeLabel(pageType) : blockItem?.context || null,
                }] : [],
                metrics: buildMetrics([
                    { label: 'Impressions', type: 'number', value: metrics?.impressions ?? null },
                    { label: 'Position', type: 'position', value: metrics?.position ?? null },
                ]),
            }));
        }
    }

    const sortedItems = dedupeItems(items)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);

    return createSection({
        status: sortedItems.length > 0 ? 'warning' : 'ok',
        reliability: sortedItems.length > 0 ? sortedItems[0].reliability : 'calculated',
        description: sortedItems.length > 0
            ? 'Titles, metas et H1 à reprendre d’abord sur les pages déjà visibles ou structurellement importantes.'
            : 'Aucun chantier metadata prioritaire ne ressort proprement du dernier audit on-page.',
        items: sortedItems,
    });
}

function buildRefreshSection(clientId, content) {
    if (content?.emptyState) {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: content.emptyState.description,
            items: [],
        });
    }

    const decayItems = toArray(content?.contentDecay?.items).map((item) => makeOpportunityItem({
        id: item.id,
        title: item.title,
        source: item.source,
        why: item.why,
        evidence: item.evidence,
        impact: item.impact,
        reliability: item.reliability,
        score: toNumber(item.severityScore) + 32,
        href: `/admin/clients/${clientId}/seo/content#decay`,
        cta: 'Ouvrir Contenu SEO',
        pages: item.url ? [{ label: item.label || getPageLabelFromUrl(item.url), url: item.url }] : [],
    }));

    const refreshItems = toArray(content?.refreshOpportunities?.items).map((item) => makeOpportunityItem({
        id: item.id,
        title: item.title,
        source: item.source,
        why: item.why,
        evidence: item.evidence,
        impact: item.impact,
        reliability: item.reliability,
        score: toNumber(item.priorityScore),
        href: `/admin/clients/${clientId}/seo/content#refresh`,
        cta: 'Ouvrir Contenu SEO',
        pages: item.url ? [{ label: item.label || getPageLabelFromUrl(item.url), url: item.url }] : [],
    }));

    const items = dedupeItems([...decayItems, ...refreshItems])
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);

    return createSection({
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: items.length > 0 ? 'calculated' : 'calculated',
        description: items.length > 0
            ? 'Pages à retravailler ou à réactualiser en priorité à partir des faiblesses et décrochages réellement observés.'
            : 'Aucune page ne cumule de décrochage ou de faiblesse éditoriale assez nette pour ouvrir un retravail prioritaire.',
        items,
    });
}

function getCoverageScore(item) {
    const title = String(item?.title || '').toLowerCase();
    if (title.includes('service')) return 130;
    if (title.includes('faq')) return 112;
    if (title.includes('hub')) return 96;
    if (title.includes('contact') || title.includes('propos')) return 88;
    return 72;
}

function buildCoverageSection(clientId, content) {
    if (content?.emptyState) {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: content.emptyState.description,
            items: [],
        });
    }

    const items = toArray(content?.missingPages?.items)
        .map((item) => makeOpportunityItem({
            id: item.id,
            title: item.title,
            source: item.source,
            why: item.why,
            evidence: item.evidence,
            impact: item.impact,
            reliability: item.reliability,
            score: getCoverageScore(item),
            href: `/admin/clients/${clientId}/seo/content#missing`,
            cta: 'Voir la couverture',
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);

    return createSection({
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: 'calculated',
        description: items.length > 0
            ? 'Manques de couverture éditoriale et de structure repérés sans inventer de nouvelles pages hors des preuves actuelles.'
            : 'Aucun manque structurel dominant ne ressort sur la couverture actuelle.',
        items,
    });
}

function buildInternalLinkingSection(clientId, content) {
    if (content?.emptyState) {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: content.emptyState.description,
            items: [],
        });
    }

    const items = toArray(content?.clusters)
        .filter((cluster) => cluster?.hubPage?.url && toArray(cluster?.supportPages).length > 0)
        .map((cluster) => makeOpportunityItem({
            id: `internal_${cluster.id}`,
            title: `Structurer le maillage autour de ${cluster.label}`,
            source: cluster.detectionDetail,
            why: `${toArray(cluster.supportPages).length} page(s) support existent déjà autour d’un hub identifiable.`,
            evidence: `${cluster.evidence} Aucun graphe de liens page à page n’est stocké: il s’agit d’une opportunité structurelle, pas d’un défaut mesuré.`,
            impact: `Donner un chemin plus clair entre ${cluster.hubPage.label} et les pages support quand cela sert réellement l’intention.` ,
            reliability: cluster.reliability || 'calculated',
            score: 48 + toArray(cluster.supportPages).length * 12,
            href: `/admin/clients/${clientId}/seo/content#clusters`,
            cta: 'Ouvrir Contenu SEO',
            pages: [cluster.hubPage, ...toArray(cluster.supportPages).slice(0, 3)],
            note: 'Le repo ne mesure pas encore les liens internes réellement présents. Cette section ne propose donc que des pistes de structure.',
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);

    return createSection({
        status: items.length > 0 ? 'warning' : 'unavailable',
        reliability: items.length > 0 ? 'calculated' : 'unavailable',
        description: items.length > 0
            ? 'Pistes de maillage fondées sur des hubs et pages support réellement observés, sans prétendre mesurer les liens existants.'
            : 'Aucune piste de maillage interne suffisamment nette ne peut être proposée honnêtement sans graphe de liens interne persisté.',
        items,
    });
}

function buildConsolidationSection(clientId, cannibalization) {
    if (cannibalization?.emptyState) {
        return createSection({
            status: 'unavailable',
            reliability: 'unavailable',
            description: cannibalization.emptyState.description,
            items: [],
        });
    }

    const items = toArray(cannibalization?.groups)
        .map((group) => {
            const measuredScore = toNumber(group?.measured?.sharedImpressions) + toNumber(group?.measured?.sharedQueryCount) * 22;
            const confidenceBonus = group?.confidenceLabel === 'Confiance élevée' ? 70 : group?.confidenceLabel === 'Confiance moyenne' ? 40 : 16;

            return makeOpportunityItem({
                id: `consolidation_${group.id}`,
                title: group.title,
                source: group.conflictTypeLabel,
                why: group?.action?.why || group?.summary || 'Arbitrage SEO à confirmer depuis les signaux de recouvrement observés.',
                evidence: group?.measured?.text || group?.calculated?.text || 'Aucune preuve de recouvrement exploitable.',
                impact: group?.action?.guardrail || 'Confirmer l’arbitrage avant fusion, repositionnement ou différenciation.',
                reliability: group?.action?.reliability || 'calculated',
                score: measuredScore + confidenceBonus,
                href: `/admin/clients/${clientId}/seo/cannibalization#actions`,
                cta: 'Ouvrir Cannibalisation SEO',
                pages: toArray(group?.pages).map((page) => ({ label: page.label, url: page.url, role: page.pageTypeLabel || null })),
                metrics: buildMetrics([
                    { label: 'Req. partagées', type: 'number', value: group?.measured?.sharedQueryCount ?? null },
                    { label: 'Impressions', type: 'number', value: group?.measured?.sharedImpressions ?? null },
                ]),
                confidenceLabel: group?.confidenceLabel || null,
                actionLabel: group?.action?.label || null,
            });
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);

    return createSection({
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: items.length > 0 ? 'calculated' : 'calculated',
        description: items.length > 0
            ? 'Arbitrages de fusion, différenciation ou repositionnement appuyés par la surface cannibalisation existante.'
            : 'Aucun arbitrage de consolidation ne dépasse aujourd’hui le seuil minimum de confiance opérateur.',
        items,
    });
}

function buildQuickWinsSection(clickGap, metadata, refresh, coverage) {
    const items = dedupeItems([
        ...toArray(clickGap?.items).slice(0, 3),
        ...toArray(metadata?.items).slice(0, 2),
        ...toArray(refresh?.items).slice(0, 2),
        ...toArray(coverage?.items).slice(0, 1),
    ])
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);

    return createSection({
        status: items.length > 0 ? 'warning' : 'ok',
        reliability: items.length > 0 ? 'calculated' : 'calculated',
        description: items.length > 0
            ? 'Sous-ensemble des actions pouvant faire bouger la visibilité ou clarifier l’offre sans lancer une refonte complète.'
            : 'Aucune action rapide dominante ne ressort sur les données actuellement disponibles.',
        items,
    });
}

function buildReliabilityBreakdown({ clickGap, positionBand, metadata, refresh, coverage, internalLinking, consolidation }) {
    const measuredCount = toArray(clickGap?.items).length + toArray(positionBand?.items).length;
    const calculatedCount = toArray(metadata?.items).length
        + toArray(refresh?.items).length
        + toArray(coverage?.items).length
        + toArray(internalLinking?.items).length
        + toArray(consolidation?.items).length;

    return [
        {
            id: 'measured',
            title: 'Mesurée',
            reliability: 'measured',
            text: measuredCount > 0
                ? `${measuredCount} opportunité(s) s’appuient directement sur la visibilité Search Console déjà observée.`
                : 'Aucune opportunité mesurée n’est ouverte tant que Search Console ne fournit pas une bande 4 à 20 exploitable.',
        },
        {
            id: 'calculated',
            title: 'Calculée',
            reliability: 'calculated',
            text: calculatedCount > 0
                ? `${calculatedCount} opportunité(s) sont dérivées de l’audit, de la structure de pages et de calculs déterministes.`
                : 'Aucune priorité calculée supplémentaire ne ressort de l’audit courant.',
        },
        {
            id: 'ai',
            title: 'Analyse IA',
            reliability: 'unavailable',
            text: 'Aucune priorisation IA dédiée à cette file SEO n’est persistée proprement dans le repo aujourd’hui.',
        },
        {
            id: 'unavailable',
            title: 'Indisponible',
            reliability: 'unavailable',
            text: 'Le repo ne stocke ni benchmark CTR externe ni graphe de maillage interne page par page. La page n’invente donc ni gains attendus artificiels ni liens absents.',
        },
    ];
}

function buildOperatorSummary({ totalBacklogCount, quickWins, positionBand, metadata, refresh, coverage, internalLinking }) {
    const parts = [];

    if (totalBacklogCount === 0) {
        parts.push('Aucune opportunité SEO dominante ne ressort des données actuellement disponibles.');
    } else {
        parts.push(`${totalBacklogCount} opportunité(s) SEO ressortent sur cette lecture opérateur.`);
    }

    if (toArray(quickWins?.items).length > 0) {
        parts.push(`${toArray(quickWins.items).length} action(s) rapide(s) peuvent être traitée(s) sans ouvrir un nouveau chantier de production.`);
    }

    if (toArray(positionBand?.items).length > 0) {
        parts.push(`${toArray(positionBand.items).length} page(s) sont déjà visibles entre les positions 4 et 20.`);
    }

    if (toArray(metadata?.items).length > 0) {
        parts.push(`${toArray(metadata.items).length} reprise(s) metadata ou H1 sont directement cadrables.`);
    }

    if (toArray(refresh?.items).length > 0) {
        parts.push(`${toArray(refresh.items).length} retravail(s) ou actualisation(s) restent prioritaires.`);
    }

    if (toArray(coverage?.items).length > 0) {
        parts.push(`${toArray(coverage.items).length} manque(s) de couverture freinent encore la structure SEO.`);
    }

    if (toArray(internalLinking?.items).length === 0) {
        parts.push('Le maillage interne reste une lecture structurelle uniquement tant qu’aucun graphe de liens n’est persisté.');
    }

    return {
        text: parts.join(' '),
        note: 'Cette file n’invente ni click gap benchmarké depuis une source externe, ni défaut de maillage mesuré. Elle combine seulement visibilité Search Console, audit structurel et calculs déterministes déjà stockés.',
        reliability: 'calculated',
    };
}

function buildActionHooks(clientId, { gscFreshness, hasAudit, totalBacklogCount }) {
    const baseHref = `/admin/clients/${clientId}`;
    const hooks = [
        {
            id: 'visibility',
            title: 'Creuser requêtes et pages visibles',
            description: 'La surface Visibilité SEO reste le bon endroit pour trier requêtes, CTR et pages organiques avant arbitrage.',
            href: `${baseHref}/seo/visibility`,
            cta: 'Ouvrir Visibilité SEO',
            reliability: 'calculated',
        },
        {
            id: 'on-page',
            title: 'Reprendre le cadrage éditorial',
            description: 'La surface Optimisation on-page détaille titles, metas, H1, réponses directes et faiblesses éditoriales page par page.',
            href: `${baseHref}/seo/on-page`,
            cta: 'Ouvrir Optimisation on-page',
            reliability: 'calculated',
        },
        {
            id: 'content',
            title: 'Piloter couverture et retravails',
            description: totalBacklogCount > 0
                ? 'Contenu SEO reste la meilleure surface pour détailler retravails, manques de pages et consolidations éditoriales.'
                : 'Contenu SEO reste le meilleur point d’entrée pour confirmer qu’aucun chantier éditorial prioritaire n’est en attente.',
            href: `${baseHref}/seo/content`,
            cta: 'Ouvrir Contenu SEO',
            reliability: 'calculated',
        },
        {
            id: 'health',
            title: 'Valider les prérequis techniques',
            description: 'Avant de pousser une page ou de produire un nouveau contenu, vérifiez que les blocages techniques ne dégradent pas déjà le potentiel SEO.',
            href: `${baseHref}/seo/health`,
            cta: 'Ouvrir Santé SEO',
            reliability: 'calculated',
        },
    ];

    if (gscFreshness?.reliability === 'unavailable') {
        hooks.push({
            id: 'connect-gsc',
            title: 'Connecter Search Console',
            description: 'Sans Search Console proprement synchronisée, la page ne peut pas ouvrir d’actions rapides mesurées ni de bande 4 à 20 fiable.',
            href: `${baseHref}/dossier/connectors`,
            cta: 'Voir les connecteurs',
            reliability: 'unavailable',
        });
    }

    if (!hasAudit) {
        hooks.push({
            id: 'run-audit',
            title: 'Relancer un audit structurel',
            description: 'Sans audit récent, metadata, couverture, maillage structurel et arbitrages de consolidation restent incomplets.',
            href: `${baseHref}/seo/health`,
            cta: 'Relancer l’audit',
            reliability: 'unavailable',
        });
    }

    return hooks;
}

export async function getSeoOpportunitiesSlice(clientId, { audit: providedAudit } = {}) {
    const audit = providedAudit ?? await dbGetLatestAudit(clientId).catch(() => null);

    const [visibility, content, onPage, cannibalization, gscRows] = await Promise.all([
        getVisibilitySlice(clientId).catch(() => ({ emptyState: { title: 'Visibilité indisponible', description: 'Visibilité SEO non disponible.' }, freshness: { gsc: { reliability: 'unavailable', status: 'unavailable', label: 'Search Console', lastObservedDate: null, lastSyncedAt: null } } })),
        getSeoContentSlice(clientId).catch(() => ({ emptyState: { title: 'Contenu SEO indisponible', description: 'Contenu SEO non disponible.' } })),
        getSeoOnPageSlice(clientId).catch(() => ({ emptyState: { title: 'On-page indisponible', description: 'On-page non disponible.' } })),
        getSeoCannibalizationSlice(clientId).catch(() => ({ emptyState: { title: 'Cannibalisation indisponible', description: 'Cannibalisation non disponible.' } })),
        getRecentGscRows(clientId, { days: CURRENT_WINDOW_DAYS, limit: 1200 }).catch(() => []),
    ]);

    const hasAudit = Boolean(audit);
    const currentGscRows = filterRowsSince(gscRows, getSinceDate(CURRENT_WINDOW_DAYS));
    const gscFreshness = visibility?.freshness?.gsc || {
        status: 'unavailable',
        reliability: 'unavailable',
        label: 'Search Console',
        lastObservedDate: null,
        lastSyncedAt: null,
        detail: 'Search Console indisponible.',
    };

    if (!hasAudit && currentGscRows.length === 0) {
        return {
            emptyState: {
                title: 'Opportunités SEO indisponibles',
                description: 'Ni audit structurel ni données Search Console exploitables ne sont disponibles. Relancez un audit ou connectez Search Console avant d’ouvrir cette file SEO.',
            },
        };
    }

    const pageIndex = buildPageIndex(audit);
    const pageMetricsMap = aggregatePageRows(currentGscRows);

    const positionBand = buildPagesInBandSection(clientId, pageMetricsMap, pageIndex, gscFreshness);
    const clickGap = buildClickGapSection(clientId, pageMetricsMap, pageIndex, gscFreshness);
    const metadata = buildMetadataSection(clientId, onPage, pageMetricsMap, pageIndex);
    const refresh = buildRefreshSection(clientId, content);
    const coverage = buildCoverageSection(clientId, content);
    const internalLinking = buildInternalLinkingSection(clientId, content);
    const consolidation = buildConsolidationSection(clientId, cannibalization);
    const quickWins = buildQuickWinsSection(clickGap, metadata, refresh, coverage);

    const totalBacklogCount = dedupeItems([
        ...toArray(clickGap.items),
        ...toArray(positionBand.items),
        ...toArray(metadata.items),
        ...toArray(refresh.items),
        ...toArray(coverage.items),
        ...toArray(internalLinking.items),
        ...toArray(consolidation.items),
    ]).length;

    const reliabilityBreakdown = buildReliabilityBreakdown({
        clickGap,
        positionBand,
        metadata,
        refresh,
        coverage,
        internalLinking,
        consolidation,
    });

    const operatorSummary = buildOperatorSummary({
        totalBacklogCount,
        quickWins,
        positionBand,
        metadata,
        refresh,
        coverage,
        internalLinking,
    });

    return {
        auditMeta: {
            createdAt: audit?.created_at || null,
            sourceUrl: audit?.resolved_url || audit?.source_url || null,
            siteTypeLabel: audit?.site_classification?.label || audit?.seo_breakdown?.site_classification?.label || null,
        },
        summaryCards: [
            {
                id: 'backlog_total',
                label: 'Backlog SEO',
                value: totalBacklogCount,
                detail: totalBacklogCount > 0 ? 'Opportunités réellement ouvertes par la mesure ou par l’audit' : 'Aucune opportunité dominante',
                reliability: 'calculated',
                accent: totalBacklogCount > 0 ? 'amber' : 'slate',
            },
            {
                id: 'quick_wins',
                label: 'Actions rapides',
                value: toArray(quickWins.items).length,
                detail: 'Actions prioritaires à faible friction',
                reliability: 'calculated',
                accent: toArray(quickWins.items).length > 0 ? 'emerald' : 'slate',
            },
            {
                id: 'pages_4_20',
                label: 'Pages 4–20',
                value: toArray(positionBand.items).length,
                detail: 'Pages déjà visibles hors top 3',
                reliability: gscFreshness.reliability === 'unavailable' ? 'unavailable' : 'calculated',
                accent: toArray(positionBand.items).length > 0 ? 'sky' : 'slate',
            },
            {
                id: 'click_gap',
                label: 'Écart de clic',
                value: toArray(clickGap.items).length,
                detail: 'Pages visibles qui peuvent d’abord récupérer plus de clics',
                reliability: gscFreshness.reliability === 'unavailable' ? 'unavailable' : 'calculated',
                accent: toArray(clickGap.items).length > 0 ? 'emerald' : 'slate',
            },
        ],
        operatorSummary,
        freshness: {
            audit: {
                status: audit?.created_at ? 'ok' : 'unavailable',
                reliability: audit?.created_at ? 'measured' : 'unavailable',
                label: 'Audit structurel',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: audit?.created_at ? 'Fraîcheur de l’audit utilisé pour cette file SEO.' : 'Aucun audit récent pour confirmer metadata, couverture et structure.',
            },
            gsc: gscFreshness,
            backlog: {
                status: totalBacklogCount > 0 ? 'ok' : 'unavailable',
                reliability: 'calculated',
                label: 'Backlog recalculé',
                value: totalBacklogCount > 0 ? `${totalBacklogCount} opportunité(s)` : 'Aucune',
                detail: 'Synthèse recalculée à partir des signaux disponibles au chargement.',
            },
        },
        reliabilityBreakdown,
        quickWins,
        clickGap,
        positionBand,
        metadata,
        refresh,
        coverage,
        internalLinking,
        consolidation,
        actionHooks: buildActionHooks(clientId, {
            gscFreshness,
            hasAudit,
            totalBacklogCount,
        }),
        emptyState: null,
    };
}
