import 'server-only';

import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import { getCrawlerSlice } from './geo-crawlers';
import {
    auditItemReliability,
    compactString,
    findAuditItem,
    getGeoFoundationContext,
    localizeAuditCopy,
    timeSince,
    toArray,
} from './geo-foundation-shared';
import { getSchemaSlice } from './geo-schema';

const PAGE_TYPE_LABELS = {
    homepage: "Page d'accueil",
    faq: 'FAQ',
    about: 'À propos',
    contact: 'Contact',
    pricing: 'Tarifs',
    features: 'Fonctionnalités',
    product: 'Offre',
    blog: 'Éditorial',
    docs: 'Documentation',
    services: 'Services',
    location: 'Localisation',
    unknown: 'Page',
};

function uniqueStrings(values = []) {
    return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

function average(values = []) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function scoreStatus(status, full, partial, confirm = 0) {
    if (status === 'couvert' || status === 'aligné' || status === 'présents') return full;
    if (status === 'partiel' || status === 'manquant' || status === 'incohérent' || status === 'écart') return partial;
    if (status === 'à confirmer') return confirm;
    return 0;
}

function getDimensionStatus(score, evidenceCount = 0) {
    if (score >= 75) return 'couvert';
    if (score >= 45) return 'partiel';
    if (evidenceCount > 0) return 'à confirmer';
    return 'absent';
}

function getDimensionSignalLabel(status) {
    if (status === 'couvert') return 'Préparation probable';
    if (status === 'partiel') return 'Signal partiel';
    if (status === 'à confirmer') return 'Évaluation partielle';
    return 'Préparation faible';
}

function toPageTypeLabel(pageType) {
    return PAGE_TYPE_LABELS[pageType] || PAGE_TYPE_LABELS.unknown;
}

function compactUrlPath(value) {
    const compact = compactString(value);
    if (!compact) return 'URL indisponible';

    try {
        const parsed = new URL(compact);
        return parsed.pathname === '/' ? "Page d'accueil" : decodeURIComponent(parsed.pathname);
    } catch {
        return compact;
    }
}

function pageLabel(page) {
    return compactString(page?.title)
        || compactString(page?.h1)
        || compactUrlPath(page?.url);
}

function localizeAuditValue(value, fallback) {
    const compact = compactString(value);
    if (!compact) return fallback;

    const localized = localizeAuditCopy(compact);
    if (!localized || localized === compact) return fallback;
    return localized;
}

function flattenCitabilityBlocks(pageSummaries = []) {
    return toArray(pageSummaries).flatMap((page) =>
        toArray(page?.citability?.top_blocks).map((block) => ({
            ...block,
            page_url: compactString(block?.page_url) || compactString(page?.url),
            page_title: compactString(page?.title) || compactString(page?.h1),
            page_type: page?.page_type || 'unknown',
            page_text_sample: compactString(page?.text_sample),
        }))
    );
}

function collectReadinessMetrics(audit) {
    const extracted = audit?.extracted_data || {};
    const pageSummaries = toArray(extracted.page_summaries);
    const citabilityPages = pageSummaries.filter((page) => Number(page?.citability?.block_count || 0) > 0);
    const citabilityBlocks = flattenCitabilityBlocks(pageSummaries);
    const localEvidence = uniqueStrings([
        ...toArray(extracted.local_signals?.cities),
        ...toArray(extracted.local_signals?.regions),
        ...toArray(extracted.local_signals?.area_served),
        ...toArray(extracted.local_signals?.address_lines),
        ...toArray(extracted.local_signals?.local_terms),
    ]);
    const serviceEvidence = uniqueStrings([
        ...toArray(extracted.service_signals?.services),
        ...toArray(extracted.service_signals?.keywords),
    ]);
    const trustEvidence = uniqueStrings([
        ...toArray(extracted.trust_signals?.proof_terms),
        ...toArray(extracted.trust_signals?.review_terms),
    ]);
    const scannedPages = toArray(audit?.scanned_pages);
    const successPageCount = scannedPages.filter((page) => page?.success).length || Number(extracted.page_stats?.successful_pages || 0);
    const averageCitabilityScore = citabilityPages.length > 0
        ? Math.round(average(citabilityPages.map((page) => Number(page?.citability?.page_score || 0))))
        : 0;

    return {
        extracted,
        pageSummaries,
        citabilityPages,
        citabilityBlocks,
        pageCount: pageSummaries.length,
        scannedPageCount: scannedPages.length,
        successPageCount,
        totalWordCount: Number(extracted.page_stats?.total_word_count || 0),
        faqCount: toArray(extracted.faq_pairs).length,
        hasFaqSchema: extracted.has_faq_schema === true,
        faqPageCount: Number(extracted.page_stats?.faq_pages || 0),
        servicePageCount: Number(extracted.page_stats?.service_pages || 0),
        aboutPageCount: Number(extracted.page_stats?.about_pages || 0),
        contactPageCount: Number(extracted.page_stats?.contact_pages || 0),
        localPageCount: pageSummaries.filter((page) => page?.page_type === 'location').length,
        structuredDataCount: toArray(extracted.structured_data).length,
        schemaEntityCount: toArray(extracted.schema_entities).length,
        businessNames: uniqueStrings(extracted.business_names || []),
        phones: uniqueStrings(extracted.phones || []),
        emails: uniqueStrings(extracted.emails || []),
        socialLinks: uniqueStrings(extracted.social_links || []),
        localEvidence,
        localEvidenceCount: localEvidence.length,
        serviceEvidence,
        serviceEvidenceCount: serviceEvidence.length,
        trustEvidence,
        hasNoindex: extracted.has_noindex === true,
        h2Rich: toArray(extracted.h2_clusters).some((cluster) => Array.isArray(cluster) && cluster.length >= 3),
        averageCitabilityScore,
        citabilityPageCount: citabilityPages.length,
        citabilityBlockCount: citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.block_count || 0), 0),
        highCitabilityBlockCount: citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.high_citability_count || 0), 0),
        lowCitabilityBlockCount: citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.low_citability_count || 0), 0),
        aiAnswerabilitySummary: compactString(audit?.geo_breakdown?.ai_analysis?.answerability_summary),
        aiBusinessSummary: compactString(audit?.geo_breakdown?.ai_analysis?.business_summary),
        llmStatus: compactString(audit?.geo_breakdown?.overall?.llm_status),
    };
}

function buildCitabilityDimension(metrics, schemaSlice) {
    const organizationCoverage = toArray(schemaSlice?.coverageItems).find((item) => item.key === 'organization');
    const localCoverage = toArray(schemaSlice?.coverageItems).find((item) => item.key === 'localbusiness');
    const faqCoverage = toArray(schemaSlice?.coverageItems).find((item) => item.key === 'faq');
    const strongPages = metrics.pageSummaries.filter((page) => Number(page?.citability?.page_score || 0) >= 60).length;

    const score = clamp(
        Math.round(metrics.averageCitabilityScore * 0.42)
        + (metrics.highCitabilityBlockCount >= 4 ? 18 : metrics.highCitabilityBlockCount >= 2 ? 14 : metrics.highCitabilityBlockCount === 1 ? 9 : metrics.citabilityBlockCount > 0 ? 4 : 0)
        + (metrics.faqCount >= 4 || metrics.hasFaqSchema ? 18 : metrics.faqCount > 0 ? 10 : 0)
        + scoreStatus(organizationCoverage?.operatorStatus, 6, 4)
        + scoreStatus(localCoverage?.operatorStatus, 6, 4)
        + scoreStatus(faqCoverage?.operatorStatus, 6, 3)
        + (strongPages >= 2 ? 10 : strongPages === 1 ? 6 : 0),
        0,
        100,
    );

    const evidence = [
        `${metrics.citabilityBlockCount} bloc(s) cotés sur ${metrics.citabilityPageCount} page(s).`,
        metrics.highCitabilityBlockCount > 0
            ? `${metrics.highCitabilityBlockCount} bloc(s) fortement citables observés.`
            : 'Aucun bloc fortement citable observé dans l’échantillon.',
        metrics.faqCount > 0
            ? `${metrics.faqCount} paire(s) FAQ / QA extraites.`
            : metrics.hasFaqSchema
                ? 'Schema FAQ observé sans paire FAQ/QA stockée.'
                : 'Aucune FAQ exploitable observée.',
        organizationCoverage?.evidence,
        localCoverage?.evidence,
    ].filter(Boolean);

    const gaps = [];
    if (metrics.citabilityBlockCount === 0) {
        gaps.push("Aucun bloc autoportant n’a été coté pour la citation.");
    } else if (metrics.averageCitabilityScore < 45) {
        gaps.push('Les passages observés restent encore peu autoportants pour être repris proprement.');
    }
    if (metrics.faqCount === 0 && !metrics.hasFaqSchema) {
        gaps.push('Aucune FAQ ou réponse directe exploitable n’a été observée.');
    }
    if (!faqCoverage || faqCoverage.operatorStatus === 'absent') {
        gaps.push('Le support FAQ reste absent ou trop faible dans le schema observé.');
    }
    if (strongPages === 0) {
        gaps.push('Aucune page ne ressort encore avec un passage nettement réutilisable en réponse.');
    }

    const status = getDimensionStatus(score, evidence.length);

    return {
        key: 'citability',
        label: 'Citabilité',
        status,
        signalLabel: getDimensionSignalLabel(status),
        reliability: 'calculated',
        score,
        scoreLabel: `${score}/100`,
        summary: status === 'couvert'
            ? 'Des passages réutilisables ressortent déjà dans le crawl, sans que cela garantisse une citation réelle par les modèles.'
            : status === 'partiel'
                ? 'La base de citation existe, mais elle reste inégale selon les pages et les formats observés.'
                : status === 'à confirmer'
                    ? 'Quelques indices existent, mais le repo ne peut pas encore conclure à une base de citation solide.'
                    : 'La base de citation reste faible dans les preuves actuellement stockées.',
        evidence,
        gaps,
    };
}

function buildExtractabilityDimension(metrics, crawlerSlice, schemaSlice) {
    const blockedBots = Number(crawlerSlice?.summary?.blockedCount || 0);
    const ambiguousBots = Number(crawlerSlice?.summary?.ambiguousCount || 0);
    const confirmBots = Number(crawlerSlice?.summary?.confirmCount || 0);
    const homepageBlocked = toArray(crawlerSlice?.pageSignals).some((item) => item.operatorStatus === 'bloqué');
    const consistencyRows = toArray(schemaSlice?.consistencyRows);
    const consistencyAlignedCount = consistencyRows.filter((row) => row.status === 'aligné').length;
    const consistencyGapCount = consistencyRows.filter((row) => row.status === 'écart').length;
    const criticalSchemaGaps = Number(schemaSlice?.summary?.criticalGapCount || 0);
    const coveragePercent = Number(schemaSlice?.summary?.coveragePercent || 0);

    let crawlComponent = 0;
    if (!crawlerSlice?.available) {
        crawlComponent = 0;
    } else if (homepageBlocked || blockedBots > 0) {
        crawlComponent = 6;
    } else if (ambiguousBots > 0 || confirmBots > 0) {
        crawlComponent = 16;
    } else {
        crawlComponent = 24;
    }

    const score = clamp(
        crawlComponent
        + Math.round(coveragePercent * 0.22)
        + (metrics.schemaEntityCount >= 3 && metrics.businessNames.length > 0 ? 16 : metrics.schemaEntityCount > 0 || metrics.businessNames.length > 0 ? 9 : 0)
        + (metrics.localEvidenceCount >= 5 ? 14 : metrics.localEvidenceCount >= 2 ? 8 : 0)
        + (metrics.h2Rich ? 10 : compactString(metrics.extracted?.h1s?.[0]) ? 5 : 0)
        + (consistencyGapCount === 0 && consistencyAlignedCount > 0 ? 8 : consistencyGapCount === 0 ? 5 : consistencyAlignedCount > 0 ? 3 : 0)
        + (metrics.totalWordCount >= 800 ? 6 : metrics.totalWordCount >= 400 ? 3 : 0),
        0,
        100,
    );

    const evidence = [
        crawlerSlice?.available
            ? `Relecture robots : ${crawlerSlice.summary.blockedCount} bot(s) bloqué(s), ${crawlerSlice.summary.ambiguousCount} ambigu(s), ${crawlerSlice.summary.confirmCount} à confirmer.`
            : 'Relecture robots indisponible pour cette synthèse.',
        `Couverture schema observée : ${coveragePercent}% sur les familles suivies.`,
        `${metrics.schemaEntityCount} entité(s) schema et ${metrics.structuredDataCount} nœud(s) structurés extraits.`,
        metrics.localEvidenceCount > 0
            ? `${metrics.localEvidenceCount} indice(s) locaux ou de zone desservie observés.`
            : 'Aucun indice local fort observé dans l’échantillon.',
        metrics.h2Rich
            ? 'Structure H2 riche observée dans le crawl.'
            : compactString(metrics.extracted?.h1s?.[0])
                ? 'Au moins un H1 clair observé, mais peu de structure secondaire forte.'
                : 'Structure de titres limitée dans les preuves stockées.',
    ].filter(Boolean);

    const gaps = [];
    if (!crawlerSlice?.available) {
        gaps.push("Aucune relecture robots/page d’accueil n’est disponible pour confirmer les blocages techniques.");
    }
    if (homepageBlocked || blockedBots > 0) {
        gaps.push('Des blocages robots ou indexation réduisent directement l’extraction potentielle.');
    }
    if (criticalSchemaGaps > 0) {
        gaps.push(`${criticalSchemaGaps} lacune(s) schema critique(s) restent ouvertes dans la lecture actuelle.`);
    }
    if (consistencyGapCount > 0) {
        gaps.push("Certaines coordonnées d’entité divergent encore du dossier partagé.");
    }
    if (metrics.localEvidenceCount < 2) {
        gaps.push('Peu d’indices locaux ou de zones desservies sont extractibles proprement.');
    }
    if (!metrics.h2Rich && !compactString(metrics.extracted?.h1s?.[0])) {
        gaps.push('La structure H1/H2 reste trop faible pour extraire les faits par section.');
    }

    const status = getDimensionStatus(score, evidence.length);

    return {
        key: 'extractability',
        label: 'Extractabilité',
        status,
        signalLabel: getDimensionSignalLabel(status),
        reliability: 'calculated',
        score,
        scoreLabel: `${score}/100`,
        summary: status === 'couvert'
            ? 'Les faits utiles ressortent de façon relativement lisible entre structure, entités et accès crawlables.'
            : status === 'partiel'
                ? 'La base extractable existe, mais elle reste fragilisée par des lacunes structurelles ou d’accès.'
                : status === 'à confirmer'
                    ? 'Le repo voit quelques signaux utiles, sans base assez propre pour conclure à une extraction robuste.'
                    : 'L’extractabilité reste trop faible ou trop incomplète dans les données actuellement disponibles.',
        evidence,
        gaps,
    };
}

function buildAnswerabilityDimension(metrics, crawlerSlice) {
    const score = clamp(
        (metrics.totalWordCount >= 1600 ? 24 : metrics.totalWordCount >= 900 ? 18 : metrics.totalWordCount >= 400 ? 10 : 4)
        + (metrics.serviceEvidenceCount >= 5 || metrics.servicePageCount > 0 ? 22 : metrics.serviceEvidenceCount >= 2 ? 14 : 4)
        + (metrics.faqCount >= 4 || metrics.hasFaqSchema ? 20 : metrics.faqCount > 0 ? 10 : 0)
        + (metrics.averageCitabilityScore > 0 ? Math.round(metrics.averageCitabilityScore * 0.22) : 0)
        + (metrics.localEvidenceCount >= 2 && metrics.businessNames.length > 0 ? 14 : metrics.localEvidenceCount > 0 || metrics.businessNames.length > 0 ? 7 : 0),
        0,
        100,
    );

    const evidence = [
        `${metrics.totalWordCount} mots visibles extraits sur ${metrics.successPageCount || metrics.pageCount} page(s).`,
        metrics.serviceEvidenceCount > 0
            ? `${metrics.serviceEvidenceCount} signal(s) d’offre/service observé(s) et ${metrics.servicePageCount} page(s) service détectée(s).`
            : 'Peu de signaux d’offre ou de service observés.',
        metrics.faqCount > 0
            ? `${metrics.faqCount} paire(s) FAQ / QA extraites.`
            : metrics.hasFaqSchema
                ? 'Schema FAQ observé.'
                : 'Aucune FAQ ou réponse directe observée.',
        metrics.averageCitabilityScore > 0
            ? `Citabilité moyenne des pages avec blocs : ${metrics.averageCitabilityScore}/100.`
            : 'Aucune page n’a fourni de score de citabilité exploitable.',
        metrics.localPageCount > 0
            ? `${metrics.localPageCount} page(s) locale(s) détectée(s).`
            : metrics.localEvidenceCount > 0
                ? `${metrics.localEvidenceCount} signal(s) local(aux) observé(s) sans page locale nette.`
                : 'Aucun appui local net observé pour soutenir une réponse ciblée.',
    ].filter(Boolean);

    const gaps = [];
    if (metrics.totalWordCount < 400) {
        gaps.push('Le volume de texte visible reste trop faible pour soutenir des réponses complètes.');
    }
    if (metrics.serviceEvidenceCount < 2 && metrics.servicePageCount === 0) {
        gaps.push("L’offre ou les cas d’usage ressortent encore trop peu pour une réponse directe.");
    }
    if (metrics.faqCount === 0 && !metrics.hasFaqSchema) {
        gaps.push('Aucune FAQ ou bloc de réponse directe n’a été observé.');
    }
    if (metrics.highCitabilityBlockCount === 0) {
        gaps.push('Aucun passage nettement réutilisable ne ressort encore pour appuyer une réponse.');
    }
    if (metrics.localEvidenceCount === 0) {
        gaps.push('La réponse manque encore de précision locale ou de zone desservie lisible.');
    }
    if (Number(crawlerSlice?.summary?.criticalBlockedCount || 0) > 0) {
        gaps.push("Des bots IA critiques restent bloqués : la capacité de réponse observée n’implique pas une extraction réelle.");
    }

    const status = getDimensionStatus(score, evidence.length);

    return {
        key: 'answerability',
        label: 'Capacité de réponse',
        status,
        signalLabel: getDimensionSignalLabel(status),
        reliability: 'calculated',
        score,
        scoreLabel: `${score}/100`,
        summary: status === 'couvert'
            ? 'Le site montre déjà une base raisonnable pour soutenir des réponses directes, sans certitude d’usage réel par les IA.'
            : status === 'partiel'
                ? 'La capacité de réponse semble plausible, mais encore trop irrégulière selon les contenus observés.'
                : status === 'à confirmer'
                    ? 'Quelques appuis existent, mais ils restent trop limités pour conclure à une base de réponse solide.'
                    : 'La capacité de réponse reste faible dans les preuves actuellement stockées.',
        evidence,
        gaps,
        analysis: metrics.aiAnswerabilitySummary
            ? {
                label: 'Lecture IA persistée',
                text: metrics.aiAnswerabilitySummary,
                reliability: 'ai_analysis',
            }
            : null,
    };
}

function buildPageReadinessRows(metrics) {
    const rows = metrics.pageSummaries.map((page) => {
        const citabilityScore = Number(page?.citability?.page_score || 0);
        const blockCount = Number(page?.citability?.block_count || 0);
        const highCount = Number(page?.citability?.high_citability_count || 0);
        const faqPairsCount = Number(page?.faq_pairs_count || 0);
        const localSignalCount = Number(page?.local_signal_count || 0);
        const serviceSignalCount = Number(page?.service_signal_count || 0);
        const wordCount = Number(page?.word_count || 0);

        const score = clamp(
            Math.round(citabilityScore * 0.45)
            + (faqPairsCount >= 2 ? 18 : faqPairsCount === 1 ? 10 : 0)
            + (highCount > 0 ? 15 : blockCount > 0 ? 6 : 0)
            + (wordCount >= 400 ? 10 : wordCount >= 180 ? 6 : 0)
            + (localSignalCount >= 2 ? 6 : 0)
            + (serviceSignalCount >= 2 ? 6 : 0),
            0,
            100,
        );

        const evidence = [
            citabilityScore > 0 ? `Citabilité ${citabilityScore}/100` : 'Citabilité non cotée',
            faqPairsCount > 0 ? `${faqPairsCount} FAQ/QA` : null,
            localSignalCount > 0 ? `${localSignalCount} signal(aux) local(aux)` : null,
            serviceSignalCount > 0 ? `${serviceSignalCount} signal(aux) service` : null,
            wordCount > 0 ? `${wordCount} mots visibles` : null,
        ].filter(Boolean);

        const status = getDimensionStatus(score, evidence.length);

        return {
            id: `${page?.url || page?.title || 'page'}-${page?.page_type || 'unknown'}`,
            label: pageLabel(page),
            pageTypeLabel: toPageTypeLabel(page?.page_type || 'unknown'),
            path: compactUrlPath(page?.url),
            url: compactString(page?.url),
            score,
            scoreLabel: `${score}/100`,
            status,
            signalLabel: getDimensionSignalLabel(status),
            reliability: 'calculated',
            evidence,
            textSample: compactString(page?.text_sample) || 'Aucun extrait disponible.',
        };
    });

    const stronger = rows.filter((row) => row.score >= 55).sort((left, right) => right.score - left.score).slice(0, 4);
    const weaker = rows.filter((row) => row.score < 55).sort((left, right) => left.score - right.score).slice(0, 4);

    return { rows, stronger, weaker };
}

function buildPassageCollections(metrics, pageGroups) {
    const strongBlocks = metrics.citabilityBlocks
        .filter((block) => Number(block?.citability_score || 0) >= 60)
        .sort((left, right) => Number(right?.citability_score || 0) - Number(left?.citability_score || 0))
        .slice(0, 6)
        .map((block) => ({
            id: block.block_id,
            label: compactString(block.heading) || pageLabel({ title: block.page_title, url: block.page_url }),
            pageLabel: toPageTypeLabel(block.page_type || 'unknown'),
            path: compactUrlPath(block.page_url),
            score: Number(block.citability_score || 0),
            scoreLabel: `${Number(block.citability_score || 0)}/100`,
            textSample: compactString(block.text_sample) || compactString(block.page_text_sample) || 'Extrait non disponible.',
            reason: block.block_type === 'faq_answer'
                ? 'Bloc FAQ directement réutilisable.'
                : 'Bloc autoportant avec structure exploitable.',
            reliability: 'calculated',
        }));

    const weakBlocks = metrics.citabilityBlocks
        .filter((block) => Number(block?.citability_score || 0) > 0 && Number(block?.citability_score || 0) < 40)
        .sort((left, right) => Number(left?.citability_score || 0) - Number(right?.citability_score || 0))
        .slice(0, 6)
        .map((block) => ({
            id: block.block_id,
            label: compactString(block.heading) || pageLabel({ title: block.page_title, url: block.page_url }),
            pageLabel: toPageTypeLabel(block.page_type || 'unknown'),
            path: compactUrlPath(block.page_url),
            score: Number(block.citability_score || 0),
            scoreLabel: `${Number(block.citability_score || 0)}/100`,
            textSample: compactString(block.text_sample) || compactString(block.page_text_sample) || 'Extrait non disponible.',
            reason: 'Bloc trop peu spécifique ou trop peu autoportant pour une reprise fiable.',
            reliability: 'calculated',
        }));

    if (weakBlocks.length > 0) {
        return { strong: strongBlocks, weak: weakBlocks };
    }

    return {
        strong: strongBlocks,
        weak: pageGroups.weaker.slice(0, 4).map((page) => ({
            id: `weak-${page.id}`,
            label: page.label,
            pageLabel: page.pageTypeLabel,
            path: page.path,
            score: page.score,
            scoreLabel: page.scoreLabel,
            textSample: page.textSample,
            reason: 'La page ne ressort pas avec de passage fortement réutilisable dans le crawl actuel.',
            reliability: 'calculated',
        })),
    };
}

function buildRecommendations({ metrics, crawlerSlice, schemaSlice, pageGroups }) {
    const recommendations = [];
    const blockedBots = Number(crawlerSlice?.summary?.blockedCount || 0);
    const criticalBlockedCount = Number(crawlerSlice?.summary?.criticalBlockedCount || 0);
    const homepageBlocked = toArray(crawlerSlice?.pageSignals).some((item) => item.operatorStatus === 'bloqué');
    const criticalSchemaGaps = Number(schemaSlice?.summary?.criticalGapCount || 0);
    const weakerPages = pageGroups.weaker;

    if (homepageBlocked || blockedBots > 0) {
        recommendations.push({
            title: 'Lever les blocages crawl/indexation en premier',
            description: 'La préparation structurelle restera théorique tant que des bots ou la page d’accueil portent des blocages observés.',
            evidence: homepageBlocked
                ? "La page d’accueil présente un signal de blocage d’indexation ou de robots."
                : `${criticalBlockedCount || blockedBots} bot(s) suivis restent bloqué(s) dans la lecture live.`,
            reliability: crawlerSlice?.available ? 'measured' : 'unavailable',
        });
    }

    if (criticalSchemaGaps > 0 || toArray(schemaSlice?.coverageItems).some((item) => item.key === 'localbusiness' && item.operatorStatus === 'absent')) {
        recommendations.push({
            title: "Compléter le schema d'entité prioritaire",
            description: 'L’extractabilité et la citabilité souffrent encore d’un schema trop incomplet sur l’entité principale, l’ancrage local ou les FAQ.',
            evidence: `${criticalSchemaGaps} lacune(s) critique(s) schema relevée(s) dans la lecture actuelle.`,
            reliability: 'calculated',
        });
    }

    if (metrics.faqCount === 0 && !metrics.hasFaqSchema) {
        recommendations.push({
            title: 'Ajouter des réponses directes visibles',
            description: 'Le site manque encore de blocs FAQ ou Q/R qui aident les moteurs à reformuler des réponses courtes.',
            evidence: 'Aucune FAQ/QA exploitable ni schema FAQ n’a été observé.',
            reliability: 'measured',
        });
    }

    if (metrics.highCitabilityBlockCount === 0 || metrics.averageCitabilityScore < 45) {
        recommendations.push({
            title: 'Réécrire les sections trop peu citables',
            description: 'Les passages observés doivent être plus autoportants, plus précis et mieux ancrés sous des titres clairs.',
            evidence: metrics.citabilityBlockCount > 0
                ? `Citabilité moyenne observée : ${metrics.averageCitabilityScore}/100.`
                : 'Aucun bloc cotable n’a été retenu par le crawl.',
            reliability: 'calculated',
        });
    }

    if (weakerPages.length > 0) {
        recommendations.push({
            title: 'Commencer par les pages les plus faibles',
            description: 'Le gain opérateur le plus rapide viendra des pages déjà détectées mais encore trop minces ou trop ambiguës.',
            evidence: weakerPages.slice(0, 3).map((page) => page.label).join(' · '),
            reliability: 'calculated',
        });
    }

    if (toArray(schemaSlice?.consistencyRows).some((row) => row.status === 'écart') || schemaSlice?.sameAsSummary?.status === 'incohérent') {
        recommendations.push({
            title: 'Réaligner identité dossier ↔ schema',
            description: 'Les écarts d’identité réduisent la capacité à extraire proprement qui parle, où et pour quels services.',
            evidence: toArray(schemaSlice?.consistencyRows)
                .filter((row) => row.status === 'écart')
                .map((row) => row.label)
                .slice(0, 3)
                .join(' · ')
                || 'Des profils sameAs divergent du dossier partagé.',
            reliability: 'calculated',
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Aucun correctif prioritaire détecté',
            description: 'La base observée est déjà exploitable pour cette étape de fondation GEO.',
            evidence: 'Le pilotage peut se concentrer ensuite sur la cohérence inter-pages et les futures surfaces GEO.',
            reliability: 'calculated',
        });
    }

    return recommendations.slice(0, 5);
}

function buildEvidenceLayers({ metrics, crawlerSlice, dimensions, pageGroups }) {
    const globalScore = Math.round(average(dimensions.map((dimension) => dimension.score)));

    return {
        measured: {
            title: 'Mesurée',
            description: 'Observations directes relues sur le site ou extraites par le dernier audit stocké.',
            reliability: 'measured',
            items: [
                `${metrics.pageCount} page(s) résumée(s) par l’audit`,
                `${metrics.structuredDataCount} nœud(s) structurés extraits`,
                `${metrics.faqCount} paire(s) FAQ / QA extraites`,
                crawlerSlice?.available
                    ? `${crawlerSlice.summary.blockedCount} bot(s) bloqué(s) observé(s) en direct`
                    : 'Relecture robots indisponible',
            ],
        },
        calculated: {
            title: 'Calculée',
            description: 'Synthèse déterministe construite uniquement à partir des signaux observés ci-dessus.',
            reliability: 'calculated',
            items: [
                `Indice structurel : ${globalScore}/100`,
                ...dimensions.map((dimension) => `${dimension.label} : ${dimension.score}/100`),
                `${pageGroups.stronger.length} page(s) ressortent comme appui réponse`,
            ].slice(0, 5),
        },
        ai: {
            title: 'Analyse IA',
            description: metrics.aiAnswerabilitySummary
                ? 'Synthèse IA persistée dans le dernier audit, fondée sur des données réelles déjà extraites.'
                : 'Aucune synthèse IA persistée n’est disponible pour cette surface à ce stade.',
            reliability: metrics.aiAnswerabilitySummary ? 'ai_analysis' : 'unavailable',
            items: [
                metrics.aiAnswerabilitySummary
                    || 'Le repo ne fournit pas encore de lecture IA dédiée à la préparation sur cette page.',
            ],
        },
        unavailable: {
            title: 'Indisponible',
            description: 'Ce que cette surface ne peut pas encore confirmer proprement.',
            reliability: 'unavailable',
            items: [
                'Aucune preuve directe de citations réelles dans les réponses des modèles.',
                'Pas de confirmation exhaustive page par page sur l’ensemble du site.',
                'Pas encore de reporting GEO, d’alertes GEO ni de lecture GEO cohérence dans cette vue.',
            ],
        },
    };
}

function buildTopBlockers({ crawlerSlice, dimensions, schemaSlice }) {
    const items = [];

    if (Number(crawlerSlice?.summary?.criticalBlockedCount || 0) > 0) {
        items.push({
            title: 'Crawl IA bloqué',
            detail: `${crawlerSlice.summary.criticalBlockedCount} bot(s) critique(s) restent bloqué(s).`,
            status: 'bloqué',
            reliability: crawlerSlice?.available ? 'measured' : 'unavailable',
        });
    }

    if (Number(schemaSlice?.summary?.criticalGapCount || 0) > 0) {
        items.push({
            title: 'Schema incomplet',
            detail: `${schemaSlice.summary.criticalGapCount} lacune(s) critique(s) sur les familles suivies.`,
            status: 'partiel',
            reliability: 'calculated',
        });
    }

    for (const dimension of dimensions) {
        if (dimension.status === 'couvert') continue;
        items.push({
            title: dimension.label,
            detail: dimension.gaps[0] || dimension.summary,
            status: dimension.status,
            reliability: dimension.reliability,
        });
    }

    if (items.length === 0) {
        items.push({
            title: 'Aucun blocage majeur',
            detail: 'Les principales surfaces observées ressortent à un niveau exploitable pour cette étape.',
            status: 'couvert',
            reliability: 'calculated',
        });
    }

    return items.slice(0, 4);
}

function buildOperatorSummary({ client, metrics, dimensions, topBlockers }) {
    const globalScore = Math.round(average(dimensions.map((dimension) => dimension.score)));
    const globalStatus = getDimensionStatus(globalScore, dimensions.length);

    const description = globalStatus === 'couvert'
        ? `${client?.client_name || 'Le mandat'} montre une préparation structurelle probable pour être extrait et réutilisé, sans que cette vue ne confirme une visibilité IA réelle.`
        : globalStatus === 'partiel'
            ? `${client?.client_name || 'Le mandat'} présente une préparation structurelle partielle : certaines pages et certains signaux sont exploitables, mais les lacunes restent encore visibles.`
            : globalStatus === 'à confirmer'
                ? `${client?.client_name || 'Le mandat'} laisse voir quelques signaux utiles, mais la préparation reste trop partielle pour conclure sereinement.`
                : `${client?.client_name || 'Le mandat'} ne montre pas encore une base structurelle assez forte pour parler d’une préparation GEO exploitable.`;

    return {
        globalScore,
        globalStatus,
        globalSignalLabel: getDimensionSignalLabel(globalStatus),
        reliability: 'calculated',
        title: 'Résumé opérateur',
        description,
        details: [
            `${metrics.pageCount} page(s) analysée(s) dans le dernier audit`,
            `${metrics.highCitabilityBlockCount} passage(s) fort(s) repéré(s)`,
            `${topBlockers.length} blocage(s) prioritaire(s)`,
        ],
    };
}

function buildLatestReadinessSignal(audit) {
    const readinessSignal = findAuditItem(audit, (item) => {
        const haystack = `${item?.title || ''} ${item?.description || ''}`.toLowerCase();
        return /faq|answer|citation|citability|extract|schema|robots|crawler|service|local/.test(haystack);
    });

    if (!readinessSignal?.item) return null;

    return {
        kind: readinessSignal.kind,
        title: localizeAuditValue(readinessSignal.item.title, 'Signal de préparation'),
        evidence: localizeAuditValue(readinessSignal.item.evidence_summary, null)
            || localizeAuditValue(readinessSignal.item.description, null)
            || null,
        reliability: auditItemReliability(readinessSignal.item),
    };
}

export async function getReadinessSlice(clientId) {
    const [{ client, audit }, crawlerSlice, schemaSlice] = await Promise.all([
        getGeoFoundationContext(clientId),
        getCrawlerSlice(clientId).catch(() => null),
        getSchemaSlice(clientId).catch(() => null),
    ]);

    if (!client) {
        return {
            available: false,
            emptyState: {
                title: 'Préparation GEO indisponible',
                description: 'Le mandat demandé est introuvable.',
            },
        };
    }

    if (!audit) {
        return {
            available: false,
            emptyState: {
                title: 'Préparation GEO indisponible',
                description: "Aucun audit exploitable n’est disponible pour mesurer la citabilité, l’extractabilité et la capacité de réponse de ce mandat.",
            },
        };
    }

    const metrics = collectReadinessMetrics(audit);
    const dimensions = [
        buildCitabilityDimension(metrics, schemaSlice),
        buildExtractabilityDimension(metrics, crawlerSlice, schemaSlice),
        buildAnswerabilityDimension(metrics, crawlerSlice),
    ];
    const pageGroups = buildPageReadinessRows(metrics);
    const passages = buildPassageCollections(metrics, pageGroups);
    const topBlockers = buildTopBlockers({ crawlerSlice, dimensions, schemaSlice });
    const operatorSummary = buildOperatorSummary({ client, metrics, dimensions, topBlockers });
    const recommendations = buildRecommendations({ metrics, crawlerSlice, schemaSlice, pageGroups });

    return {
        available: true,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
            not_connected: getProvenanceMeta('not_connected'),
        },
        summary: {
            globalScore: operatorSummary.globalScore,
            globalStatus: operatorSummary.globalStatus,
            globalSignalLabel: operatorSummary.globalSignalLabel,
            pageCount: metrics.pageCount,
            highPassageCount: metrics.highCitabilityBlockCount,
            faqCount: metrics.faqCount,
            topBlockerCount: topBlockers.length,
            auditFreshness: timeSince(audit?.created_at) || 'Indisponible',
            liveFreshness: crawlerSlice?.summary?.liveFreshness || 'Indisponible',
        },
        freshness: {
            audit: {
                label: 'Dernier audit de préparation',
                value: timeSince(audit?.created_at) || 'Indisponible',
                detail: 'Les dimensions de préparation s’appuient sur le dernier crawl structuré enregistré.',
                reliability: audit?.created_at ? 'measured' : 'unavailable',
            },
            live: {
                label: 'Relecture robots',
                value: crawlerSlice?.summary?.liveFreshness || 'Indisponible',
                detail: crawlerSlice?.available
                    ? 'Les directives robots et la page d’accueil ont été relues au chargement de cette page.'
                    : "Aucune relecture directe n’est disponible pour compléter l’audit stocké.",
                reliability: crawlerSlice?.available ? 'measured' : 'unavailable',
            },
        },
        operatorSummary,
        topBlockers,
        dimensions,
        pageGroups,
        passages,
        recommendations,
        evidenceLayers: buildEvidenceLayers({ metrics, crawlerSlice, dimensions, pageGroups }),
        auditContext: {
            createdAt: audit?.created_at || null,
            latestSignal: buildLatestReadinessSignal(audit),
            aiSummary: metrics.aiAnswerabilitySummary
                ? {
                    text: metrics.aiAnswerabilitySummary,
                    reliability: 'ai_analysis',
                }
                : null,
        },
        emptyState: null,
    };
}
