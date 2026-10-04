import 'server-only';

import { getSourceStatus, loadIndependentSources } from './source-availability';

import { toArray, compactString, timeSince } from './geo-foundation-shared';

import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';

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
        .filter((token) => token.length >= 3);
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

function pagePriority(page) {
    if (page?.page_type === 'homepage') return 0;
    if (page?.page_type === 'services') return 1;
    if (page?.page_type === 'location') return 2;
    if (page?.page_type === 'about') return 3;
    if (page?.page_type === 'contact') return 4;
    return 5;
}

function comparePages(left, right) {
    const priorityDelta = pagePriority(left) - pagePriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return String(left?.url || '').localeCompare(String(right?.url || ''), 'fr-CA');
}

function getPageLabel(page) {
    const url = compactString(page?.url);
    if (!url) return page?.page_type || 'Page auditée';

    try {
        const parsed = new URL(url);
        return parsed.pathname || '/';
    } catch {
        return url;
    }
}

function getPageContextLabel(pageType) {
    if (pageType === 'homepage') return "Page d'accueil";
    if (pageType === 'services') return 'Page service';
    if (pageType === 'location') return 'Page locale';
    if (pageType === 'about') return 'À propos';
    if (pageType === 'contact') return 'Contact';
    if (pageType === 'faq') return 'FAQ';
    return 'Page auditée';
}

function baseItem(page, evidence) {
    const pageType = compactString(page?.page_type);

    return {
        label: getPageLabel(page),
        url: compactString(page?.url),
        context: getPageContextLabel(pageType),
        contextKey: pageType || 'page',
        evidence,
    };
}

function makeBlock({ id, title, status, reliability, summary, detail, suggestion, items }) {
    return {
        id,
        title,
        status,
        reliability,
        summary,
        detail,
        suggestion,
        items,
    };
}

function pickWeakTitles(pages) {
    const items = pages
        .filter((page) => {
            const length = String(page?.title || '').trim().length;
            return length === 0 || length < 35;
        })
        .slice(0, 5)
        .map((page) => {
            const length = String(page?.title || '').trim().length;
            return baseItem(page, length === 0
                ? 'Aucun title exploitable n’a été observé.'
                : `Title trop court (${length} caractères observés).`);
        });

    return makeBlock({
        id: 'weak_titles',
        title: 'Titles faibles',
        status: items.length === 0 ? 'ok' : items.some((item) => item.contextKey === 'homepage') ? 'critical' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'Aucun title faible détecté sur l’échantillon audité.'
            : `${items.length} page(s) montrent un title absent ou trop court pour cadrer clairement le sujet.`,
        detail: 'Lecture déterministe basée sur les titles persistés dans `page_summaries`.',
        suggestion: items.length > 0 ? 'Renforcer le sujet, l’offre et le contexte utile dans les titles prioritaires.' : null,
        items,
    });
}

function pickWeakMetas(pages) {
    const items = pages
        .filter((page) => {
            const length = String(page?.description || '').trim().length;
            return length === 0 || length < 70;
        })
        .slice(0, 5)
        .map((page) => {
            const length = String(page?.description || '').trim().length;
            return baseItem(page, length === 0
                ? 'Aucune meta description exploitable observée.'
                : `Meta trop courte (${length} caractères observés).`);
        });

    return makeBlock({
        id: 'weak_metas',
        title: 'Metas faibles',
        status: items.length === 0 ? 'ok' : items.some((item) => item.contextKey === 'homepage') ? 'critical' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'Les metas auditées ont une longueur exploitable sur l’échantillon observé.'
            : `${items.length} page(s) ont une meta absente ou trop courte pour soutenir le clic organique.`,
        detail: 'Contrôle déterministe fondé sur la meta description observée dans le crawl.',
        suggestion: items.length > 0 ? 'Réécrire les metas pour clarifier la promesse, le service et le contexte d’usage.' : null,
        items,
    });
}

function pickMisalignedH1(pages) {
    const items = pages
        .filter((page) => {
            const title = compactString(page?.title);
            const h1 = compactString(page?.h1);
            if (!h1) return true;
            if (!title) return false;
            return overlapScore(title, h1) < 0.35;
        })
        .slice(0, 5)
        .map((page) => {
            const title = compactString(page?.title);
            const h1 = compactString(page?.h1);
            return baseItem(page, !h1
                ? 'Aucun H1 clair observé sur cette page.'
                : `Recouvrement faible entre le title et le H1 (${Math.round(overlapScore(title, h1) * 100)}% de tokens communs).`);
        });

    return makeBlock({
        id: 'misaligned_h1',
        title: 'H1 mal alignés',
        status: items.length === 0 ? 'ok' : items.some((item) => item.contextKey === 'homepage') ? 'critical' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'Les H1 audités restent globalement alignés avec les titles observés.'
            : `${items.length} page(s) manquent d’un H1 clair ou aligné avec le title.`,
        detail: 'Détection déterministe basée sur la présence du H1 et son chevauchement lexical avec le title.',
        suggestion: items.length > 0 ? 'Réaligner le H1 sur l’intention principale servie par le title.' : null,
        items,
    });
}

function pickDirectAnswerGaps(pages) {
    const items = pages
        .filter((page) => {
            const faqCount = Number(page?.faq_pairs_count || 0);
            const citabilityCount = Number(page?.citability?.block_count || 0);
            const important = ['homepage', 'services', 'location'].includes(page?.page_type);
            return important && faqCount === 0 && citabilityCount === 0;
        })
        .slice(0, 5)
        .map((page) => baseItem(
            page,
            `Aucune FAQ et aucun bloc de réponse directe exploitable (${Number(page?.citability?.block_count || 0)} bloc cité).`,
        ));

    return makeBlock({
        id: 'direct_answers',
        title: 'Manque de réponse directe',
        status: items.length === 0 ? 'ok' : items.some((item) => item.contextKey === 'homepage') ? 'critical' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'L’échantillon audité expose au moins des FAQ ou des blocs réutilisables sur les pages clés.'
            : `${items.length} page(s) clés ne montrent ni FAQ ni bloc de réponse directement réutilisable.`,
        detail: 'Lecture basée sur `faq_pairs_count` et sur les blocs de citabilité persistés par page.',
        suggestion: items.length > 0 ? 'Ajouter des réponses courtes, structurées et localement utiles sur les pages clés.' : null,
        items,
    });
}

function pickGenericContent(pages) {
    const items = pages
        .filter((page) => {
            const wordCount = Number(page?.word_count || 0);
            const serviceSignals = Number(page?.service_signal_count || 0);
            return wordCount < 180 || (wordCount < 260 && serviceSignals === 0);
        })
        .slice(0, 5)
        .map((page) => baseItem(
            page,
            `${Number(page?.word_count || 0)} mots visibles et ${Number(page?.service_signal_count || 0)} signal service détecté.`,
        ));

    return makeBlock({
        id: 'generic_content',
        title: 'Contenu trop générique',
        status: items.length === 0 ? 'ok' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'Le contenu audité garde une densité et des signaux métier corrects sur l’échantillon observé.'
            : `${items.length} page(s) exposent un contenu court ou peu spécifique métier.`,
        detail: 'Heuristique déterministe fondée sur le volume visible et les signaux service observés.',
        suggestion: items.length > 0 ? 'Renforcer les pages concernées avec des éléments métier concrets, des cas et des détails de service.' : null,
        items,
    });
}

function pickLocalClarityGaps(pages, serviceAreaApplicability) {
    if (serviceAreaApplicability === 'low') {
        return makeBlock({
            id: 'local_clarity',
            title: 'Clarté locale',
            status: 'ok',
            reliability: 'calculated',
            summary: 'Le profil détecté a une exigence locale faible dans l’échantillon actuel.',
            detail: 'Aucune alerte locale prioritaire ne remonte tant que le besoin local reste peu applicable.',
            suggestion: null,
            items: [],
        });
    }

    const items = pages
        .filter((page) => ['homepage', 'services', 'location'].includes(page?.page_type) && Number(page?.local_signal_count || 0) === 0)
        .slice(0, 5)
        .map((page) => baseItem(page, 'Aucun signal local clair observé sur cette page auditée.'));

    return makeBlock({
        id: 'local_clarity',
        title: 'Manque de clarté locale',
        status: items.length === 0 ? 'ok' : items.some((item) => item.contextKey === 'homepage') ? 'critical' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'Les pages clés auditée(s) exposent au moins des indices locaux exploitables.'
            : `${items.length} page(s) clés manquent encore de repères locaux explicites.`,
        detail: 'Évaluation déterministe dérivée des signaux locaux observés par page.',
        suggestion: items.length > 0 ? 'Ajouter lieux, zones servies, ancrages locaux ou preuves territoriales là où l’intention le justifie.' : null,
        items,
    });
}

function pickEeatSignals(audit) {
    const trustSignals = audit?.extracted_data?.trust_signals || {};
    const pageStats = audit?.extracted_data?.page_stats || {};
    const items = [];

    if (Number(pageStats.about_pages || 0) === 0) {
        items.push({ label: 'Page À propos absente', url: null, context: 'site', evidence: 'Aucune page de type `about` n’a été observée dans le crawl.' });
    }
    if (Number(pageStats.contact_pages || 0) === 0) {
        items.push({ label: 'Page Contact absente', url: null, context: 'site', evidence: 'Aucune page de type `contact` n’a été observée dans le crawl.' });
    }
    if (toArray(trustSignals.proof_terms).length === 0 && toArray(trustSignals.review_terms).length === 0) {
        items.push({ label: 'Preuves visibles insuffisantes', url: null, context: 'site', evidence: 'Aucun terme de preuve, d’avis ou de réassurance n’a été extrait.' });
    }
    if (toArray(trustSignals.social_networks).length === 0) {
        items.push({ label: 'Renfort social absent', url: null, context: 'site', evidence: 'Aucun profil social public n’a été observé comme preuve complémentaire.' });
    }

    return makeBlock({
        id: 'eeat_signals',
        title: 'Signaux visibles E-E-A-T insuffisants',
        status: items.length === 0 ? 'ok' : items.length >= 3 ? 'critical' : 'warning',
        reliability: 'calculated',
        summary: items.length === 0
            ? 'L’échantillon audité montre des signaux visibles de confiance et d’identité suffisants.'
            : `${items.length} manque(s) visible(s) affaiblissent encore l’exposition de l’expertise et de la confiance.`,
        detail: 'Lecture déterministe basée sur les pages support et les signaux de confiance observés.',
        suggestion: items.length > 0 ? 'Renforcer preuves, pages support et signaux publics de réassurance là où ils manquent.' : null,
        items,
    });
}

function buildSuggestions(blocks, aiSummary) {
    const suggestions = [];

    for (const block of blocks) {
        if (!block?.suggestion || block.status === 'ok') continue;

        suggestions.push({
            id: `${block.id}_suggestion`,
            title: block.title,
            description: block.suggestion,
            reliability: block.reliability,
        });
    }

    if (compactString(aiSummary)) {
        suggestions.push({
            id: 'ai_answerability_read',
            title: 'Lecture IA du contenu',
            description: aiSummary,
            reliability: 'ai_analysis',
        });
    }

    if (suggestions.length === 0) {
        suggestions.push({
            id: 'no_priority_gap',
            title: 'Aucune faiblesse on-page dominante',
            description: 'Le dernier audit ne fait pas ressortir de faiblesse on-page majeure sur l’échantillon audité.',
            reliability: 'calculated',
        });
    }

    return suggestions.slice(0, 8);
}

export async function getSeoOnPageSlice(clientId) {
    const { values: { audit }, dataSources, errors } = await loadIndependentSources({ audit: () => dbGetLatestAudit(clientId) });
    const availability = { status: getSourceStatus(dataSources), dataSources, errors };

    if (!audit) {
        return {
            ...availability,
            emptyState: {
                title: 'Analyse on-page indisponible',
                description: dataSources.audit === 'unavailable' ? 'Données audit temporairement indisponibles pour cette lecture on-page.' : 'Aucun audit exploitable n’est disponible pour ouvrir une lecture on-page fiable.',
            },
        };
    }

    const pages = toArray(audit?.extracted_data?.page_summaries)
        .slice()
        .sort(comparePages);

    if (pages.length === 0) {
        return {
            ...availability,
            emptyState: {
                title: 'Analyse on-page indisponible',
                description: 'Le dernier audit ne contient pas de `page_summaries` exploitables pour une lecture on-page honnête.',
            },
        };
    }

    const serviceAreaApplicability = audit?.seo_breakdown?.site_classification?.applicability?.service_area
        || audit?.site_classification?.applicability?.service_area
        || 'medium';
    const directAnswerCount = pages.filter((page) => Number(page?.faq_pairs_count || 0) > 0 || Number(page?.citability?.block_count || 0) > 0).length;
    const trustSurfacesVisible = [
        Number(audit?.extracted_data?.page_stats?.about_pages || 0) > 0,
        Number(audit?.extracted_data?.page_stats?.contact_pages || 0) > 0,
        toArray(audit?.extracted_data?.trust_signals?.proof_terms).length + toArray(audit?.extracted_data?.trust_signals?.review_terms).length > 0,
        toArray(audit?.extracted_data?.trust_signals?.social_networks).length > 0,
    ].filter(Boolean).length;

    const blocks = [
        pickWeakTitles(pages),
        pickWeakMetas(pages),
        pickMisalignedH1(pages),
        pickDirectAnswerGaps(pages),
        pickGenericContent(pages),
        pickLocalClarityGaps(pages, serviceAreaApplicability),
        pickEeatSignals(audit),
    ];

    return {
        ...availability,
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
                detail: 'Référence active pour cette lecture on-page',
                reliability: 'measured',
                accent: 'emerald',
            },
            {
                id: 'pages_analyzed',
                label: 'Pages analysées',
                value: pages.length,
                detail: 'Pages conservées dans l’échantillon audité',
                reliability: 'calculated',
                accent: 'sky',
            },
            {
                id: 'direct_answers',
                label: 'Réponses directes',
                value: directAnswerCount,
                detail: `${directAnswerCount}/${pages.length} page(s) exposent FAQ ou blocs directement réutilisables`,
                reliability: 'calculated',
                accent: directAnswerCount > 0 ? 'emerald' : 'amber',
            },
            {
                id: 'eeat_support',
                label: 'Surfaces E-E-A-T',
                value: `${trustSurfacesVisible}/4`,
                detail: 'À propos, Contact, preuves/avis, profils publics',
                reliability: 'calculated',
                accent: trustSurfacesVisible >= 3 ? 'emerald' : 'amber',
            },
        ],
        blocks,
        suggestions: buildSuggestions(blocks, audit?.geo_breakdown?.ai_analysis?.answerability_summary || ''),
        emptyState: null,
    };
}