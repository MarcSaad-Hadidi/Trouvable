import { normalizeAuditProblems } from '../truth/problems.js';
import { classifySiteForAudit } from './site-classification.js';
import { buildDimensionParts } from './score-indicators.js';
import { applyScoreRules } from './score-rules.js';
import {
    PRIORITY_ORDER,
    DIMENSION_META,
    toArray,
    uniqueStrings,
    applicabilityLabel,
} from './score-meta.js';

function summarizeDimension(key, indicators, applicabilityLevel) {
    const observed = indicators.reduce((sum, indicator) => sum + indicator.score, 0);
    const max = indicators.reduce((sum, indicator) => sum + indicator.max_score, 0);
    const score = max > 0 ? Math.round((observed / max) * 100) : 0;
    const meta = DIMENSION_META[key];

    let summary;
    if (max === 0) summary = `${meta.label} is not applicable based on observed site profile.`;
    else if (score >= 80) summary = `${meta.label} is a clear strength based on observed evidence.`;
    else if (score >= 60) summary = `${meta.label} is workable but still has actionable gaps.`;
    else if (score >= 40) summary = `${meta.label} is uneven and should be strengthened.`;
    else summary = `${meta.label} is currently weak relative to the detected site profile.`;

    return {
        key,
        label: meta.label,
        description: meta.description,
        category: meta.category,
        provenance: meta.provenance,
        score,
        score_label: max === 0 ? 'N/A' : `${score}/100`,
        applicability: applicabilityLabel(applicabilityLevel),
        summary,
        indicators: indicators.map((indicator) => ({
            key: indicator.key,
            label: indicator.label,
            score: Math.round(indicator.score),
            max_score: Math.round(indicator.max_score),
            applicability: indicator.applicability,
            evidence: indicator.evidence,
            status: indicator.status,
        })),
    };
}

function sortIssues(issues = []) {
    return [...issues].sort((a, b) => {
        const priorityDelta = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        if (priorityDelta !== 0) return priorityDelta;
        return String(a.title || '').localeCompare(String(b.title || ''), 'en-CA');
    });
}

function sortStrengths(strengths = []) {
    return [...strengths].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'en-CA'));
}

function scanResultsSafeUrl(scanResults) {
    const resolved = scanResults?.resolved_url || scanResults?.source_url || '';
    return resolved || 'No resolved URL observed.';
}

function collectMetrics(scanResults) {
    const extracted = scanResults?.extracted_data || {};
    const scannedPages = toArray(scanResults?.scanned_pages);
    const successPages = scannedPages.filter((page) => page.success);
    const pageSummaries = toArray(extracted.page_summaries);
    const citabilityPages = pageSummaries.filter((page) => Number(page?.citability?.block_count || 0) > 0);
    const homePage = pageSummaries.find((page) => page.page_type === 'homepage') || pageSummaries[0] || null;
    const title = extracted.titles?.[0] || homePage?.title || '';
    const description = extracted.descriptions?.[0] || homePage?.description || '';
    const h1 = extracted.h1s?.[0] || homePage?.h1 || '';
    const totalWordCount = Number(extracted.page_stats?.total_word_count || 0);
    const appShellPages = Number(extracted.technology_signals?.app_shell_pages || 0);
    const averageWords = successPages.length > 0 ? Math.round(totalWordCount / successPages.length) : 0;
    const citabilityPageCount = citabilityPages.length;
    const citabilityBlockCount = citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.block_count || 0), 0);
    const highCitabilityBlockCount = citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.high_citability_count || 0), 0);
    const lowCitabilityBlockCount = citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.low_citability_count || 0), 0);
    const averageCitabilityScore = citabilityPageCount > 0
        ? Math.round(citabilityPages.reduce((sum, page) => sum + Number(page?.citability?.page_score || 0), 0) / citabilityPageCount)
        : 0;
    const citabilityHighlights = uniqueStrings(citabilityPages.flatMap((page) =>
        toArray(page?.citability?.top_blocks).map((block) => block?.heading || block?.text_sample || '')
    ));

    return {
        extracted,
        title,
        description,
        h1,
        successCount: successPages.length,
        scannedCount: scannedPages.length,
        crawlSuccessRate: scannedPages.length > 0 ? successPages.length / scannedPages.length : 0,
        totalWordCount,
        averageWords,
        appShellPages,
        hydrationHints: uniqueStrings(extracted.technology_signals?.hydration_hints || []),
        hasHydrationRisk: appShellPages > 0 && (averageWords < 180 || totalWordCount < 700),
        hasHttps: String(scanResults?.resolved_url || '').startsWith('https://'),
        hasCanonical: toArray(extracted.canonicals).length > 0,
        hasNoindex: extracted.has_noindex === true,
        hasFaq: extracted.has_faq_schema === true || toArray(extracted.faq_pairs).length > 0 || Number(extracted.page_stats?.faq_pages || 0) > 0,
        hasFaqSchema: extracted.has_faq_schema === true,
        faqCount: toArray(extracted.faq_pairs).length,
        hasLocalBusinessSchema: extracted.has_local_business_schema === true,
        localSignals: extracted.local_signals || {},
        trustSignals: extracted.trust_signals || {},
        serviceSignals: extracted.service_signals || {},
        businessNames: uniqueStrings(extracted.business_names || []),
        phones: uniqueStrings(extracted.phones || []),
        emails: uniqueStrings(extracted.emails || []),
        socialLinks: uniqueStrings(extracted.social_links || []),
        schemaEntities: toArray(extracted.schema_entities),
        servicePageCount: Number(extracted.page_stats?.service_pages || 0),
        contactPageCount: Number(extracted.page_stats?.contact_pages || 0),
        aboutPageCount: Number(extracted.page_stats?.about_pages || 0),
        localPageCount: pageSummaries.filter((page) => page.page_type === 'location').length,
        citabilityPageCount,
        citabilityBlockCount,
        highCitabilityBlockCount,
        lowCitabilityBlockCount,
        averageCitabilityScore,
        citabilityHighlights,
        h2Rich: toArray(extracted.h2_clusters).some((cluster) => cluster.length >= 3),
        localEvidence: uniqueStrings([
            ...(extracted.local_signals?.cities || []),
            ...(extracted.local_signals?.regions || []),
            ...(extracted.local_signals?.area_served || []),
            ...(extracted.local_signals?.address_lines || []),
            ...(extracted.local_signals?.local_terms || []),
        ]),
        trustEvidence: uniqueStrings([
            ...(extracted.trust_signals?.proof_terms || []),
            ...(extracted.trust_signals?.review_terms || []),
        ]),
        serviceEvidence: uniqueStrings([
            ...(extracted.service_signals?.services || []),
            ...(extracted.service_signals?.keywords || []),
        ]),
    };
}

function buildSubsystemScores(truthContext, scanResults) {
    const extracted = scanResults?.extracted_data || {};
    const layer1Bundle = truthContext.layer1RawScan || extracted.layered_v1_layer1?.site_level_raw_scores || null;
    const layer2Bundle = truthContext.layer2Expert || null;
    const crawlerAccess = truthContext.crawlerAccessData || null;

    const layer2Summary = layer2Bundle
        ? {
            summary_score: layer2Bundle.summary_score ?? null,
            module_scores: layer2Bundle.module_scores || null,
            finding_counts: Array.isArray(layer2Bundle.findings)
                ? {
                    total: layer2Bundle.findings.length,
                    high: layer2Bundle.findings.filter((f) => f.severity === 'high').length,
                    medium: layer2Bundle.findings.filter((f) => f.severity === 'medium').length,
                    low: layer2Bundle.findings.filter((f) => f.severity === 'low').length,
                }
                : null,
        }
        : null;

    return {
        layer1_raw_scan: layer1Bundle,
        layer2_expert_summary: layer2Summary,
        crawler_access_score: crawlerAccess?.crawlerAccessScore ?? null,
        note: 'Diagnostic subsystem scores. Not the canonical Trouvable product score; see `overall.deterministic_score` / hybrid_score.',
    };
}

export function scoreAuditV2(scanResults, providedSiteClassification = null, truthContext = {}) {
    const siteClassification = providedSiteClassification || classifySiteForAudit(scanResults);
    const metrics = collectMetrics(scanResults);
    const scanUrlEvidence = scanResultsSafeUrl(scanResults);
    const parts = buildDimensionParts({
        metrics,
        siteClassification,
        scanUrlEvidence,
        crawlerAccessData: truthContext.crawlerAccessData || null,
    });
    const automation_data = applyScoreRules({
        parts,
        metrics,
        truthContext,
        scanUrlEvidence,
    });

    const dimensions = [
        summarizeDimension('technical_seo', parts.technical, 'high'),
        summarizeDimension('local_readiness', parts.local, parts.localApplicability),
        summarizeDimension('ai_answerability', parts.answerability, 'high'),
        summarizeDimension('trust_signals', parts.trust, 'high'),
        summarizeDimension('identity_completeness', parts.identity, parts.publicContactApplicability),
    ];

    const dimensionByKey = Object.fromEntries(dimensions.map((dimension) => [dimension.key, dimension]));
    const deterministic_score = Math.round(
        (dimensionByKey.technical_seo.score * siteClassification.weight_profile.technical_seo)
        + (dimensionByKey.local_readiness.score * siteClassification.weight_profile.local_readiness)
        + (dimensionByKey.ai_answerability.score * siteClassification.weight_profile.ai_answerability)
        + (dimensionByKey.trust_signals.score * siteClassification.weight_profile.trust_signals)
        + (dimensionByKey.identity_completeness.score * siteClassification.weight_profile.identity_completeness)
    );

    const subsystemScores = buildSubsystemScores(truthContext, scanResults);

    const sharedBreakdown = {
        methodology: {
            type: 'deterministic_site_type_aware',
            notes: [
                'Scores are derived from observed crawl evidence and deterministic rules.',
                'Local expectations are adjusted by detected site type and applicability.',
                'Missing local signals are softened when local relevance is low.',
            ],
        },
        site_classification: {
            type: siteClassification.type,
            label: siteClassification.label,
            confidence: siteClassification.confidence,
            reasons: siteClassification.reasons || [],
            applicability: siteClassification.applicability || {},
            weight_profile: siteClassification.weight_profile || {},
            evidence_summary: siteClassification.evidence_summary || [],
        },
        overall: {
            deterministic_score,
            score_label: `${deterministic_score}/100`,
        },
        dimensions,
        subsystem_scores: subsystemScores,
    };

    const normalizedIssues = normalizeAuditProblems(sortIssues(parts.issues), {
        auditId: truthContext.auditId || null,
        clientId: truthContext.clientId || null,
        sourceUrl: truthContext.sourceUrl || scanResults?.resolved_url || scanResults?.source_url || null,
    });

    return {
        seo_score: dimensionByKey.technical_seo.score,
        geo_score: dimensionByKey.local_readiness.score,
        deterministic_score,
        score_dimensions: dimensions,
        site_classification: siteClassification,
        seo_breakdown: {
            ...sharedBreakdown,
            summary: {
                score: dimensionByKey.technical_seo.score,
                label: 'Technical SEO',
                description: DIMENSION_META.technical_seo.description,
            },
        },
        geo_breakdown: {
            ...sharedBreakdown,
            summary: {
                score: dimensionByKey.local_readiness.score,
                label: 'Local / GEO readiness',
                description: DIMENSION_META.local_readiness.description,
            },
        },
        breakdown: {
            technical_seo: { score: dimensionByKey.technical_seo.score, max: 100 },
            local_readiness: { score: dimensionByKey.local_readiness.score, max: 100 },
            ai_answerability: { score: dimensionByKey.ai_answerability.score, max: 100 },
            trust_signals: { score: dimensionByKey.trust_signals.score, max: 100 },
            identity_completeness: { score: dimensionByKey.identity_completeness.score, max: 100 },
            overall: { score: deterministic_score, max: 100 },
            site_classification: {
                type: siteClassification.type,
                label: siteClassification.label,
                confidence: siteClassification.confidence,
            },
        },
        issues: normalizedIssues,
        strengths: sortStrengths(parts.strengths),
        automation_data,
        subsystem_scores: subsystemScores,
    };
}
