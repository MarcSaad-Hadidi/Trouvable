import 'server-only';

import { toArray, compactString, timeSince } from './geo-foundation-shared';

import { getLatestAudit as dbGetLatestAudit, getRecentAudits as dbGetRecentAudits } from '@/lib/db/audits';
import { filterSeoRelevant } from './seo-categories';
import { getSeoHealthIssues } from './seo-health-issues';

function getTechnicalDimension(audit) {
    return toArray(audit?.seo_breakdown?.dimensions).find((dimension) => dimension?.key === 'technical_seo') || null;
}

function getIndicator(audit, key) {
    return toArray(getTechnicalDimension(audit)?.indicators).find((indicator) => indicator?.key === key) || null;
}

function indicatorStatus(indicator, missingSeverity = 'warning') {
    if (!indicator) return 'unavailable';
    if (indicator.status === 'detected') return 'ok';
    if (indicator.status === 'weak_evidence') return 'warning';
    if (indicator.status === 'not_found') return missingSeverity;
    return 'unavailable';
}

function findIssueOrStrength(audit, matcher) {
    const issue = toArray(audit?.issues).find((item) => matcher(item));
    if (issue) return { kind: 'issue', item: issue };

    const strength = toArray(audit?.strengths).find((item) => matcher(item));
    if (strength) return { kind: 'strength', item: strength };

    return null;
}

function buildCheck({ id, label, status, detail, evidence, reliability, action }) {
    return {
        id,
        label,
        status,
        detail,
        evidence,
        reliability,
        action,
    };
}

function isCrawlLikeIssue(issue) {
    const haystack = String(`${issue?.title || ''} ${issue?.description || ''} ${issue?.detail || ''}`).toLowerCase();
    return /crawl|crawler|robots|index|canonical|render|https|redirect|404|500|server/.test(haystack);
}

function buildAuditHistory(audits) {
    return (audits || [])
        .filter((audit) => audit?.scan_status === 'success' || audit?.scan_status === 'partial_error')
        .slice()
        .reverse()
        .map((audit) => {
            const issues = getSeoHealthIssues(audit, { limit: 50 });
            const crawlIssues = issues.filter(isCrawlLikeIssue);
            return {
                id: audit.id,
                date: audit.created_at,
                label: (() => {
                    try {
                        return new Date(audit.created_at).toLocaleDateString('fr-CA', { month: '2-digit', day: '2-digit' });
                    } catch {
                        return 'n.d.';
                    }
                })(),
                issueCount: issues.length,
                crawlIssueCount: crawlIssues.length,
                seoScore: audit?.seo_score ?? null,
            };
        });
}

export async function getSeoHealthSlice(clientId, { audit: providedAudit } = {}) {
    const [audit, recentAudits] = await Promise.all([
        providedAudit ?? dbGetLatestAudit(clientId).catch(() => null),
        dbGetRecentAudits(clientId, 6).catch(() => []),
    ]);

    if (!audit) {
        return {
            available: false,
            emptyState: {
                title: 'Sante SEO indisponible',
                description: "Aucun audit exploitable n'est disponible pour ce mandat. Relancez un audit avant d'ouvrir la lecture technique.",
            },
        };
    }

    if (audit.scan_status === 'pending' || audit.scan_status === 'running') {
        return {
            available: false,
            emptyState: {
                title: 'Audit SEO en cours',
                description: 'Le dernier audit est encore en cours de traitement. Rechargez la page dans un instant pour recuperer la lecture technique complete.',
            },
        };
    }

    if (audit.scan_status === 'failed') {
        return {
            available: false,
            emptyState: {
                title: 'Dernier audit echoue',
                description: audit.error_message || "L'audit n'a pas pu etre complete. Relancez-le depuis le dossier.",
            },
        };
    }

    const technicalIndicator = getTechnicalDimension(audit);
    const schemaEntities = toArray(audit?.extracted_data?.schema_entities);
    const schemaTypes = schemaEntities.map((entity) => compactString(entity?.type)).filter(Boolean);
    const seoStrengths = filterSeoRelevant(toArray(audit?.strengths)).slice(0, 15);

    const robotsSignal = findIssueOrStrength(audit, (item) => {
        const title = String(item?.title || '').toLowerCase();
        return title.includes('crawler') || title.includes('robots');
    });

    const indexationIndicator = getIndicator(audit, 'indexability');
    const canonicalIndicator = getIndicator(audit, 'canonical');
    const crawlIndicator = getIndicator(audit, 'crawl');
    const renderedIndicator = getIndicator(audit, 'rendered_content');
    const httpsIndicator = getIndicator(audit, 'https');

    const normalizedIssues = getSeoHealthIssues(audit, { limit: 8 });
    const promptableIssueCount = normalizedIssues.filter((issue) => issue.promptAvailable !== false).length;

    return {
        available: true,
        seoScore: audit?.seo_score ?? null,
        issueCount: normalizedIssues.length,
        strengthCount: seoStrengths.length,
        totalIssueCount: toArray(audit?.issues).length,
        auditDate: audit?.created_at || null,
        strengths: seoStrengths,
        auditMeta: {
            createdAt: audit?.created_at || null,
            sourceUrl: audit?.resolved_url || audit?.source_url || null,
            seoScore: audit?.seo_score ?? null,
            scannedPages: toArray(audit?.scanned_pages).length,
            technicalSummary: technicalIndicator?.summary || null,
        },
        summaryCards: [
            {
                id: 'latest_audit',
                label: 'Dernier audit',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: audit?.created_at ? 'Audit technique observe' : 'Aucun audit recent',
                reliability: 'measured',
                accent: 'emerald',
            },
            {
                id: 'technical_score',
                label: 'Score technique',
                value: audit?.seo_score ?? 'n.d.',
                detail: technicalIndicator?.summary || 'Synthese technique non disponible',
                reliability: audit?.seo_score !== null && audit?.seo_score !== undefined ? 'calculated' : 'unavailable',
                accent: 'sky',
            },
            {
                id: 'technical_issues',
                label: 'Points critiques',
                value: normalizedIssues.length,
                detail: normalizedIssues.length > 0 ? 'Problemes techniques prioritaires issus du dernier audit' : 'Aucun probleme technique majeur remonte',
                reliability: 'calculated',
                accent: normalizedIssues.length > 0 ? 'amber' : 'emerald',
            },
            {
                id: 'promptable_issues',
                label: 'Prompts prets',
                value: promptableIssueCount,
                detail: promptableIssueCount > 0 ? 'Problemes techniques pouvant produire un prompt de correction depuis la preuve audit' : 'Aucun probleme technique exploitable pour generer un prompt de correction',
                reliability: 'calculated',
                accent: promptableIssueCount > 0 ? 'emerald' : 'slate',
            },
        ],
        checks: [
            buildCheck({
                id: 'indexation',
                label: 'Indexation',
                status: indicatorStatus(indexationIndicator, 'critical'),
                detail: indexationIndicator?.status === 'detected'
                    ? "Aucune instruction `noindex` n'a ete observee sur la page d'entree auditee."
                    : "Un signal de blocage d'indexation a ete observe ou la preuve est insuffisante.",
                evidence: indexationIndicator?.evidence || "Aucune preuve d'indexation exploitable dans cet audit.",
                reliability: indexationIndicator ? 'calculated' : 'unavailable',
                action: "Verifier les balises index/noindex et relancer l'audit apres correction.",
            }),
            buildCheck({
                id: 'robots',
                label: 'Robots',
                status: !robotsSignal ? 'unavailable' : robotsSignal.kind === 'strength' ? 'ok' : (robotsSignal.item?.priority === 'high' ? 'critical' : 'warning'),
                detail: !robotsSignal
                    ? "Aucune preuve robots exploitable n'a ete persistee dans le dernier audit."
                    : robotsSignal.kind === 'strength'
                        ? 'Les crawlers critiques ne sont pas bloques dans la preuve observee.'
                        : 'Un blocage robots / crawler ressort dans le dernier audit.',
                evidence: robotsSignal?.item?.evidence_summary || robotsSignal?.item?.description || 'Preuve robots absente.',
                reliability: robotsSignal ? 'measured' : 'unavailable',
                action: 'Corriger robots.txt ou les regles crawler avant un nouveau passage.',
            }),
            buildCheck({
                id: 'canonical',
                label: 'Canonical',
                status: indicatorStatus(canonicalIndicator, 'warning'),
                detail: canonicalIndicator?.status === 'detected'
                    ? 'Une balise canonique a ete observee sur la homepage auditee.'
                    : "La clarte canonique reste insuffisante sur la page d'entree auditee.",
                evidence: canonicalIndicator?.evidence || 'Aucune preuve canonique exploitable.',
                reliability: canonicalIndicator ? 'calculated' : 'unavailable',
                action: 'Aligner la balise canonique sur la page canonique reelle.',
            }),
            buildCheck({
                id: 'hreflang',
                label: 'Hreflang',
                status: 'unavailable',
                detail: "Le pipeline d'audit actuel ne persiste pas encore un controle hreflang exploitable mandat par mandat.",
                evidence: 'Aucune mesure `hreflang` structuree disponible dans les sources admin actuelles.',
                reliability: 'unavailable',
                action: 'Preparer un point de controle hreflang dans une vague ulterieure si le besoin multilingue est confirme.',
            }),
            buildCheck({
                id: 'sitemap',
                label: 'Sitemap',
                status: 'unavailable',
                detail: "Le dernier audit ne conserve pas un signal sitemap exploitable cote admin, meme si le repo sait analyser `robots.txt`.",
                evidence: 'Aucune preuve sitemap persistee avec le dernier audit client.',
                reliability: 'unavailable',
                action: 'Preparer une persistance sitemap dediee avant de promettre un suivi operateur fiable.',
            }),
            buildCheck({
                id: 'schema',
                label: 'Schema',
                status: schemaTypes.length > 0 ? 'ok' : 'warning',
                detail: schemaTypes.length > 0
                    ? `${schemaTypes.length} type(s) de donnees structurees observe(s).`
                    : "Aucune entite structuree exploitable n'a ete detectee dans l'echantillon audite.",
                evidence: schemaTypes.length > 0 ? schemaTypes.slice(0, 4).join(' · ') : "Aucune entite Schema.org persistee dans l'audit.",
                reliability: schemaTypes.length > 0 ? 'measured' : 'unavailable',
                action: 'Verifier la presence et la coherence du JSON-LD sur les pages strategiques.',
            }),
        ],
        indicators: [
            {
                id: 'https',
                label: 'HTTPS',
                status: indicatorStatus(httpsIndicator, 'critical'),
                evidence: httpsIndicator?.evidence || 'Preuve HTTPS indisponible.',
            },
            {
                id: 'crawl',
                label: 'Couverture de crawl',
                status: indicatorStatus(crawlIndicator, 'warning'),
                evidence: crawlIndicator?.evidence || 'Preuve de crawl indisponible.',
            },
            {
                id: 'rendered_content',
                label: 'Contenu rendu',
                status: indicatorStatus(renderedIndicator, 'warning'),
                evidence: renderedIndicator?.evidence || 'Preuve de rendu indisponible.',
            },
        ],
        issues: normalizedIssues,
        history: buildAuditHistory(recentAudits),
        emptyState: null,
    };
}
