import 'server-only';

import { analyzeCrawlerAccess, CRAWLER_STATUS } from '@/lib/audit/crawler-access';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import {
    auditItemReliability,
    compactString,
    findAuditItem,
    getGeoFoundationContext,
    localizeAuditCopy,
    timeSince,
} from './geo-foundation-shared';

/* Bots affichés par défaut (périmètre produit / lecture robots).
 * Extension de la liste = évolution produit, pas un « plafond runtime ». */
const DISPLAYED_CRAWLERS = new Set([
    'GPTBot',
    'ClaudeBot',
    'PerplexityBot',
    'Google-Extended',
    'OAI-SearchBot',
    'ChatGPT-User',
    'CCBot',
]);

const STATUS_PRIORITY = {
    bloqué: 0,
    ambigu: 1,
    'à confirmer': 2,
    autorisé: 3,
};

const FETCH_TIMEOUT_MS = 8000;
const ROBOT_BLOCK_REGEX = /\b(noindex|none)\b/i;

function uniqueStrings(values = []) {
    return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function botOperatorStatus(entry) {
    if (!entry) return 'à confirmer';
    if (entry.status === CRAWLER_STATUS.BLOCKED) return 'bloqué';
    if (entry.status === CRAWLER_STATUS.RESTRICTED) return 'ambigu';
    if (entry.status === CRAWLER_STATUS.ALLOWED) return 'autorisé';
    return 'à confirmer';
}

function botStatusTone(status) {
    if (status === 'bloqué') return 'critical';
    if (status === 'ambigu') return 'warning';
    if (status === 'autorisé') return 'ok';
    return 'idle';
}

function botReliability(entry, crawlerAccess) {
    if (crawlerAccess?.fetchError) return 'unavailable';
    if (!crawlerAccess?.robotsTxtFound && entry?.status === CRAWLER_STATUS.UNKNOWN) return 'unavailable';
    return 'measured';
}

function describeBotEvidence(entry, crawlerAccess) {
    if (crawlerAccess?.fetchError) {
        return 'Lecture live de robots.txt indisponible pour ce mandat.';
    }

    if (!crawlerAccess?.robotsTxtFound) {
        return 'Aucun robots.txt observé au domaine racine.';
    }

    if (entry?.matchedBy === 'specific') {
        const parts = [];
        if (entry.ruleLabel) parts.push(`Règle dédiée : ${entry.ruleLabel}`);
        if (entry.disallow?.length) parts.push(`Disallow : ${entry.disallow.join(', ')}`);
        if (entry.allow?.length) parts.push(`Allow : ${entry.allow.join(', ')}`);
        if (entry.crawlDelay) parts.push(`Crawl-delay : ${entry.crawlDelay}`);
        return parts.join(' · ');
    }

    if (entry?.matchedBy === 'wildcard') {
        const parts = ['Règle générique : *'];
        if (entry.disallow?.length) parts.push(`Disallow : ${entry.disallow.join(', ')}`);
        if (entry.allow?.length) parts.push(`Allow : ${entry.allow.join(', ')}`);
        if (entry.crawlDelay) parts.push(`Crawl-delay : ${entry.crawlDelay}`);
        return parts.join(' · ');
    }

    return 'Aucune règle pertinente observée pour ce bot.';
}

function describeBotImpact(status) {
    if (status === 'bloqué') {
        return 'Blocage robots explicite : exposition IA probablement coupée pour ce bot.';
    }
    if (status === 'ambigu') {
        return 'Règles partielles : certaines familles de pages peuvent rester inaccessibles.';
    }
    if (status === 'autorisé') {
        return 'Aucun blocage robots direct observé pour ce bot dans la lecture live.';
    }
    return 'Preuve insuffisante pour conclure finement sur ce bot.';
}

function sortBotRows(left, right) {
    const statusDelta = (STATUS_PRIORITY[left.operatorStatus] ?? 99) - (STATUS_PRIORITY[right.operatorStatus] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    if (left.tier !== right.tier) return left.tier === 'critical' ? -1 : 1;
    return String(left.name || '').localeCompare(String(right.name || ''), 'fr-CA');
}

function buildBotRows(crawlerAccess) {
    const rows = Object.values(crawlerAccess?.crawlerStatuses || {})
        .filter((entry) => DISPLAYED_CRAWLERS.has(entry.name))
        .map((entry) => {
            const operatorStatus = botOperatorStatus(entry);
            return {
                name: entry.name,
                service: entry.service,
                tier: entry.tier,
                operatorStatus,
                tone: botStatusTone(operatorStatus),
                evidence: describeBotEvidence(entry, crawlerAccess),
                reliability: botReliability(entry, crawlerAccess),
                impact: describeBotImpact(operatorStatus),
                impactReliability: 'calculated',
                ruleSource: entry.matchedBy === 'specific'
                    ? 'Règle dédiée'
                    : entry.matchedBy === 'wildcard'
                        ? 'Règle générique'
                        : 'Aucune règle',
                disallow: uniqueStrings(entry.disallow),
                allow: uniqueStrings(entry.allow),
                crawlDelay: entry.crawlDelay ?? null,
            };
        })
        .sort(sortBotRows);

    return rows;
}

function buildRestrictionRows(crawlerAccess) {
    const aggregate = new Map();

    for (const entry of Object.values(crawlerAccess?.crawlerStatuses || {})) {
        if (!DISPLAYED_CRAWLERS.has(entry.name)) continue;

        for (const pattern of uniqueStrings(entry.disallow)) {
            const key = pattern;
            if (!aggregate.has(key)) {
                aggregate.set(key, {
                    pattern,
                    bots: [],
                    hasRootBlock: pattern === '/',
                    blockedBots: 0,
                    ambiguousBots: 0,
                    reliability: crawlerAccess?.fetchError ? 'unavailable' : 'measured',
                });
            }

            const current = aggregate.get(key);
            current.bots.push(entry.name);
            if (entry.status === CRAWLER_STATUS.BLOCKED) current.blockedBots += 1;
            if (entry.status === CRAWLER_STATUS.RESTRICTED) current.ambiguousBots += 1;
        }
    }

    return [...aggregate.values()]
        .map((entry) => ({
            pattern: entry.pattern,
            bots: uniqueStrings(entry.bots),
            scope: entry.hasRootBlock ? 'Blocage racine' : 'Famille de pages restreinte',
            impact: entry.hasRootBlock
                ? `Le pattern ${entry.pattern} coupe potentiellement l'accès complet à ${entry.bots.length} bot(s).`
                : `Le pattern ${entry.pattern} masque une zone du site pour ${entry.bots.length} bot(s).`,
            reliability: entry.reliability,
            severity: entry.hasRootBlock || entry.blockedBots > 0 ? 'critical' : 'warning',
        }))
        .sort((left, right) => {
            if (left.severity !== right.severity) return left.severity === 'critical' ? -1 : 1;
            return String(left.pattern || '').localeCompare(String(right.pattern || ''), 'fr-CA');
        });
}

function buildRobotsRules(crawlerAccess) {
    if (crawlerAccess?.fetchError) {
        return {
            usefulRules: [],
            problematicRules: [],
            ambiguousRules: [
                {
                    label: 'Lecture robots.txt indisponible',
                    detail: 'Le repo ne peut pas confirmer les directives en direct sur ce domaine.',
                    reliability: 'unavailable',
                },
            ],
        };
    }

    if (!crawlerAccess?.robotsTxtFound) {
        return {
            usefulRules: [],
            problematicRules: [],
            ambiguousRules: [
                {
                    label: 'robots.txt absent',
                    detail: 'Sans robots.txt, la lecture bot par bot reste à confirmer.',
                    reliability: 'unavailable',
                },
            ],
        };
    }

    const usefulRules = [];
    const problematicRules = [];
    const ambiguousRules = [];

    if (crawlerAccess.robotsHasSitemap) {
        usefulRules.push({
            label: 'Sitemap déclaré',
            detail: 'robots.txt référence un sitemap public.',
            reliability: 'measured',
        });
    }

    const wildcardRule = crawlerAccess.robotsRules?.['*'];
    if (wildcardRule && wildcardRule.allow?.length > 0 && wildcardRule.disallow?.length === 0) {
        usefulRules.push({
            label: 'Règle générique permissive',
            detail: 'La règle * autorise la navigation sans blocage direct observé.',
            reliability: 'measured',
        });
    }

    for (const bot of buildBotRows(crawlerAccess)) {
        if (bot.operatorStatus === 'bloqué') {
            problematicRules.push({
                label: `${bot.name} bloqué`,
                detail: bot.evidence,
                reliability: bot.reliability,
            });
        } else if (bot.operatorStatus === 'ambigu') {
            ambiguousRules.push({
                label: `${bot.name} ambigu`,
                detail: bot.evidence,
                reliability: bot.reliability,
            });
        }
    }

    if (problematicRules.length === 0 && usefulRules.length === 0) {
        usefulRules.push({
            label: 'Aucun blocage majeur observé',
            detail: 'La lecture live ne montre pas de règle critique sur les bots suivis ici.',
            reliability: 'measured',
        });
    }

    return { usefulRules, problematicRules, ambiguousRules };
}

function extractMetaRobots(html) {
    if (!html) return null;

    const directMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    if (directMatch?.[1]) return directMatch[1].trim();

    const reverseMatch = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']robots["'][^>]*>/i);
    if (reverseMatch?.[1]) return reverseMatch[1].trim();

    return null;
}

async function fetchHomepageRobotSignals(siteUrl) {
    let targetUrl;
    try {
        targetUrl = new URL(siteUrl);
    } catch {
        return {
            observedAt: new Date().toISOString(),
            metaRobots: null,
            xRobotsTag: null,
            finalUrl: null,
            fetchError: 'invalid_url',
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(targetUrl.href, {
            cache: 'no-store',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, TrouvableGeoOps/1.0)',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        const html = /text\/html|application\/xhtml\+xml/i.test(contentType)
            ? await response.text().catch(() => '')
            : '';

        return {
            observedAt: new Date().toISOString(),
            metaRobots: extractMetaRobots(html),
            xRobotsTag: compactString(response.headers.get('x-robots-tag')),
            finalUrl: response.url || targetUrl.href,
            fetchError: null,
        };
    } catch {
        clearTimeout(timeoutId);
        return {
            observedAt: new Date().toISOString(),
            metaRobots: null,
            xRobotsTag: null,
            finalUrl: targetUrl.href,
            fetchError: 'fetch_failed',
        };
    }
}

function buildPageSignals({ homepageSignals, audit }) {
    const items = [];

    if (homepageSignals?.fetchError) {
        items.push({
            label: 'Homepage · X-Robots-Tag',
            operatorStatus: 'à confirmer',
            tone: 'idle',
            evidence: 'Lecture header indisponible sur la page d’entrée.',
            reliability: 'unavailable',
        });
        items.push({
            label: 'Homepage · Meta robots',
            operatorStatus: 'à confirmer',
            tone: 'idle',
            evidence: 'Lecture HTML indisponible sur la page d’entrée.',
            reliability: 'unavailable',
        });
        return items;
    }

    const xRobotsBlocked = ROBOT_BLOCK_REGEX.test(String(homepageSignals?.xRobotsTag || ''));
    items.push({
        label: 'Homepage · X-Robots-Tag',
        operatorStatus: homepageSignals?.xRobotsTag
            ? (xRobotsBlocked ? 'bloqué' : 'autorisé')
            : 'à confirmer',
        tone: homepageSignals?.xRobotsTag ? (xRobotsBlocked ? 'critical' : 'ok') : 'idle',
        evidence: homepageSignals?.xRobotsTag
            ? `Header observé : ${homepageSignals.xRobotsTag}`
            : 'Aucun header X-Robots-Tag observé sur la page d’entrée.',
        reliability: homepageSignals?.xRobotsTag ? 'measured' : 'unavailable',
    });

    const metaBlocked = ROBOT_BLOCK_REGEX.test(String(homepageSignals?.metaRobots || ''));
    items.push({
        label: 'Homepage · Meta robots',
        operatorStatus: homepageSignals?.metaRobots
            ? (metaBlocked ? 'bloqué' : 'autorisé')
            : audit?.extracted_data?.has_noindex === true
                ? 'bloqué'
                : 'à confirmer',
        tone: homepageSignals?.metaRobots
            ? (metaBlocked ? 'critical' : 'ok')
            : audit?.extracted_data?.has_noindex === true
                ? 'critical'
                : 'idle',
        evidence: homepageSignals?.metaRobots
            ? `Balise observée : ${homepageSignals.metaRobots}`
            : audit?.extracted_data?.has_noindex === true
                ? 'Le dernier audit a observé une instruction noindex sur la page d’entrée.'
                : 'Aucune balise meta robots exploitable n’a été observée récemment.',
        reliability: homepageSignals?.metaRobots || audit?.extracted_data?.has_noindex === true ? 'measured' : 'unavailable',
    });

    return items;
}

function buildRecommendations({ crawlerAccess, restrictionRows, pageSignals, auditCrawlerSignal }) {
    const recommendations = [];

    if (crawlerAccess?.fetchError) {
        recommendations.push({
            title: 'Confirmer la lecture robots.txt',
            description: 'La preuve live n’a pas pu être relue. Vérifiez la disponibilité publique du domaine avant de conclure bot par bot.',
            evidence: 'Sans robots.txt relu en direct, le statut fin des bots reste partiel.',
            reliability: 'unavailable',
        });
    }

    if ((crawlerAccess?.blockedCriticalCount || 0) > 0) {
        recommendations.push({
            title: 'Lever le blocage des bots critiques',
            description: 'Commencer par les bots explicitement bloqués dans robots.txt avant toute autre optimisation GEO.',
            evidence: `Bots concernés : ${(crawlerAccess?.blockedCriticalNames || []).join(', ')}.`,
            reliability: 'calculated',
        });
    }

    if (restrictionRows.some((item) => item.pattern !== '/')) {
        recommendations.push({
            title: 'Relire les patterns restreints',
            description: 'Les familles de pages restreintes peuvent couper des pages utiles aux réponses IA sans bloquer tout le site.',
            evidence: restrictionRows.filter((item) => item.pattern !== '/').slice(0, 3).map((item) => item.pattern).join(' · '),
            reliability: 'calculated',
        });
    }

    if (pageSignals.some((item) => item.operatorStatus === 'bloqué')) {
        recommendations.push({
            title: 'Retirer les blocages d’indexation sur la page d’entrée',
            description: 'Un `noindex` ou un `X-Robots-Tag` bloquant sur la homepage affaiblit la lisibilité globale du site.',
            evidence: pageSignals.filter((item) => item.operatorStatus === 'bloqué').map((item) => `${item.label} · ${item.evidence}`).join(' · '),
            reliability: 'calculated',
        });
    }

    if (auditCrawlerSignal?.item) {
        recommendations.push({
            title: auditCrawlerSignal.kind === 'issue' ? 'Dernière alerte audit' : 'Dernier signal favorable audit',
            description: localizeAuditCopy(compactString(auditCrawlerSignal.item.recommended_fix))
                || localizeAuditCopy(compactString(auditCrawlerSignal.item.description))
                || 'Le dernier audit contient un signal crawlers exploitable.',
            evidence: localizeAuditCopy(compactString(auditCrawlerSignal.item.evidence_summary))
                || localizeAuditCopy(compactString(auditCrawlerSignal.item.description))
                || 'Preuve audit disponible.',
            reliability: auditItemReliability(auditCrawlerSignal.item),
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Aucune correction prioritaire détectée',
            description: 'La lecture actuelle ne remonte pas de blocage critique sur les bots suivis ici.',
            evidence: 'Le pilotage peut rester focalisé sur la fraîcheur des audits et l’évolution des patterns.',
            reliability: 'calculated',
        });
    }

    return recommendations.slice(0, 4);
}

function buildEvidenceLayers({ crawlerAccess, restrictionRows, pageSignals, botRows }) {
    return {
        measured: {
            title: 'Mesurée',
            description: crawlerAccess?.fetchError
                ? 'Lecture live indisponible pour robots.txt ou la page d’entrée.'
                : 'robots.txt, meta robots et X-Robots-Tag relus directement sur le site.',
            reliability: crawlerAccess?.fetchError ? 'unavailable' : 'measured',
            items: [
                crawlerAccess?.robotsTxtFound ? 'robots.txt observé en direct' : 'robots.txt non observé en direct',
                ...pageSignals.map((item) => `${item.label} · ${item.operatorStatus}`),
            ],
        },
        calculated: {
            title: 'Calculée',
            description: 'Statuts groupés par bot, synthèse des patterns et impact probable sur la couverture GEO.',
            reliability: 'calculated',
            items: [
                `${restrictionRows.length} pattern(s) restreint(s) regroupé(s)`,
                `${(botRows || []).filter((item) => item.operatorStatus === 'bloqué').length} bot(s) bloqué(s) dans la grille suivie`,
            ],
        },
        ai: {
            title: 'Analyse IA',
            description: 'Aucune lecture IA ciblée sur les crawlers n’est persistée pour ce mandat à ce stade.',
            reliability: 'unavailable',
            items: ['Les recommandations ci-dessous restent déterministes et fondées sur les preuves observées.'],
        },
        unavailable: {
            title: 'Indisponible',
            description: 'Le repo ne couvre pas encore proprement toutes les restrictions page par page au-delà de la homepage et des patterns robots.',
            reliability: 'unavailable',
            items: ['Pas de preuve exhaustive des X-Robots-Tag sur toutes les URLs du site.'],
        },
    };
}

export async function getCrawlerSlice(clientId) {
    const { client, audit } = await getGeoFoundationContext(clientId);

    if (!client) {
        return {
            available: false,
            emptyState: {
                title: 'Surface crawlers indisponible',
                description: 'Le mandat demandé est introuvable.',
            },
        };
    }

    if (!compactString(client.website_url)) {
        return {
            available: false,
            emptyState: {
                title: 'Surface crawlers indisponible',
                description: 'Aucune URL de site n’est renseignée dans le dossier partagé pour ce mandat.',
            },
        };
    }

    const [crawlerAccess, homepageSignals] = await Promise.all([
        analyzeCrawlerAccess(client.website_url),
        fetchHomepageRobotSignals(client.website_url),
    ]);

    const botRows = buildBotRows(crawlerAccess);
    const restrictionRows = buildRestrictionRows(crawlerAccess);
    const pageSignals = buildPageSignals({ homepageSignals, audit });
    const robotsRules = buildRobotsRules(crawlerAccess);
    const auditCrawlerSignal = findAuditItem(audit, (item) => {
        const haystack = `${item?.title || ''} ${item?.description || ''}`.toLowerCase();
        return /crawler|robots|x-robots|noindex|bot/.test(haystack);
    });

    const blockedCount = botRows.filter((item) => item.operatorStatus === 'bloqué').length;
    const ambiguousCount = botRows.filter((item) => item.operatorStatus === 'ambigu').length;
    const confirmCount = botRows.filter((item) => item.operatorStatus === 'à confirmer').length;
    const allowedCount = botRows.filter((item) => item.operatorStatus === 'autorisé').length;

    return {
        available: true,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
            not_connected: getProvenanceMeta('not_connected'),
        },
        summary: {
            blockedCount,
            ambiguousCount,
            confirmCount,
            allowedCount,
            criticalBlockedCount: crawlerAccess?.blockedCriticalCount || 0,
            restrictionCount: restrictionRows.length,
            robotsStatus: crawlerAccess?.robotsTxtFound ? 'présent' : 'non observé',
            robotsReliability: crawlerAccess?.fetchError ? 'unavailable' : 'measured',
            liveFreshness: timeSince(crawlerAccess?.observedAt) || 'Indisponible',
            auditFreshness: timeSince(audit?.created_at) || 'Indisponible',
        },
        freshness: {
            live: {
                label: 'Lecture live robots',
                value: timeSince(crawlerAccess?.observedAt) || 'Indisponible',
                detail: crawlerAccess?.fetchError
                    ? 'La relance live n’a pas pu confirmer robots.txt.'
                    : 'robots.txt et homepage relus en direct au chargement de cette page.',
                reliability: crawlerAccess?.fetchError ? 'unavailable' : 'measured',
            },
            audit: {
                label: 'Dernier audit site',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: audit?.created_at
                    ? 'Source complémentaire pour les restrictions observées côté crawl.'
                    : 'Aucun audit exploitable pour compléter la lecture live.',
                reliability: audit?.created_at ? 'measured' : 'unavailable',
            },
        },
        botRows,
        robotsRules,
        restrictionRows,
        pageSignals,
        recommendations: buildRecommendations({ crawlerAccess, restrictionRows, pageSignals, auditCrawlerSignal }),
        evidenceLayers: buildEvidenceLayers({ crawlerAccess, restrictionRows, pageSignals, botRows }),
        auditContext: {
            createdAt: audit?.created_at || null,
            latestSignal: auditCrawlerSignal?.item
                ? {
                    kind: auditCrawlerSignal.kind,
                    title: localizeAuditCopy(compactString(auditCrawlerSignal.item.title)) || 'Signal audit crawlers',
                    evidence: localizeAuditCopy(compactString(auditCrawlerSignal.item.evidence_summary))
                        || localizeAuditCopy(compactString(auditCrawlerSignal.item.description))
                        || null,
                    reliability: auditItemReliability(auditCrawlerSignal.item),
                }
                : null,
        },
        emptyState: null,
    };
}
