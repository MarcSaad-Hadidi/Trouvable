/**
 * Canonical internal audit object assembler.
 *
 * This module is the single place that produces the layered audit structure
 * (`extracted_data.layered_v1`) described in the 4-layer architecture plan:
 *
 *   - target                      identity of the audit run
 *   - crawl_metadata              Layer 1 crawl strategy + budget + stats
 *   - render_metadata             Layer 1 render adapter stats
 *   - page_artifacts              per-page normalized summary
 *   - page_level_checks           Layer 1 deterministic check registry
 *   - site_level_raw_scores       Layer 1 aggregate category scores (diagnostic)
 *   - site_level_expert           Layer 2 expert bundle
 *   - normalized_evidence         Layer 3 deduped facts (references existing extracted_data)
 *   - classification              Layer 3 site classification
 *   - subsystem_scores            { layer1_raw_scan, layer2_expert_summary }
 *   - final_trouvable_score       Layer 4 canonical product score
 *   - recommendations / hooks     links between layers
 *   - dashboard_reporting_fields  mapping for backward-compatible UI consumers
 *   - debug_benchmark             layer timings, hashes, reference pointers
 *
 * IMPORTANT: this object is additive. The existing persistence columns
 * (`seo_score`, `geo_score`, `seo_breakdown`, `geo_breakdown`, `issues`, ...)
 * continue to be written unchanged — consumers see zero break.
 */

import { AUDIT_VERSION_LAYERED, LAYERED_SCHEMA_KEY } from './audit-config.js';

const SCHEMA_VERSION = 1;

function coerceArray(value) {
    return Array.isArray(value) ? value : [];
}

function pickPageArtifact(page) {
    if (!page || typeof page !== 'object') return null;
    return {
        url: page.url || null,
        final_url: page.final_url || null,
        normalized_url: page.normalized_url || page.url || null,
        status_code: page.status_code ?? null,
        page_type: page.page_type || 'unknown',
        success: Boolean(page.success),
        render_mode: page.render_mode || 'static',
        render_error: page.render_error || null,
        title: page.title || null,
    };
}

/**
 * @param {object} params
 * @param {object} params.target            { audit_id, client_id, source_url, resolved_url }
 * @param {object} params.scanResults       Layer 1 output (scanner.js runSiteAudit result)
 * @param {object} params.siteClassification Layer 3 classification
 * @param {object} params.scoring           Layer 4 scoreAuditV2 output
 * @param {object} params.hybrid            Layer 4 hybrid merge { deterministicScore, hybridScore, normalizedAnalysis }
 * @param {object} [params.crawlerAccess]   Layer 1/2 crawler-access output
 * @param {object} [params.layer2Expert]    Layer 2 orchestrator output
 * @param {object} [params.timings]         Step-level timings
 * @param {Array<object>} [params.opportunitiesHooks] Linkage to opportunity ids
 * @returns {object} layered audit block suitable for `extracted_data.layered_v1`
 */
export function buildLayeredAuditObject(params) {
    const {
        target,
        scanResults,
        siteClassification,
        scoring,
        hybrid = {},
        crawlerAccess = null,
        layer2Expert = null,
        timings = null,
        opportunitiesHooks = [],
    } = params;

    const extracted = scanResults?.extracted_data || {};
    const layer1Block = extracted.layered_v1_layer1 || extracted[LAYERED_SCHEMA_KEY]?.layer1 || null;

    const pageArtifacts = coerceArray(scanResults?.scanned_pages).map(pickPageArtifact).filter(Boolean);
    const pageLevelChecks = coerceArray(layer1Block?.page_level_checks);
    const siteLevelRawScores = layer1Block?.site_level_raw_scores || null;
    const crawlMetadata = layer1Block?.crawl_metadata || {
        strategy: 'bfs_fallback',
        single_engine_id: 'trouvable.scanner.v1',
        pages_budget: pageArtifacts.length,
        pages_visited: pageArtifacts.length,
        sitemap_sources: [],
        robots_present: Boolean(crawlerAccess?.robotsTxtFound),
    };

    const renderMetadata = {
        adapter: 'trouvable.playwright-renderer',
        playwright_available: Boolean(extracted.render_stats?.playwright_available),
        playwright_reason: extracted.render_stats?.playwright_reason || null,
        audit_strategy: extracted.render_stats?.audit_strategy || 'unknown',
        rendered_pages: Number(extracted.render_stats?.rendered_pages || 0),
        static_pages: Number(extracted.render_stats?.static_pages || 0),
        render_fallback_pages: Number(extracted.render_stats?.render_fallback_pages || 0),
        render_failures: Number(extracted.render_stats?.render_failures || 0),
    };

    const layer1Summary = siteLevelRawScores
        ? {
            overall: siteLevelRawScores.overall,
            categories: siteLevelRawScores.categories,
            totals: siteLevelRawScores.totals,
            distinct_check_ids: siteLevelRawScores.distinct_check_ids,
        }
        : null;

    const layer2Summary = layer2Expert
        ? {
            summary_score: layer2Expert.summary_score,
            module_scores: layer2Expert.module_scores,
            finding_counts: summarizeFindings(layer2Expert.findings || []),
        }
        : null;

    const finalScore = {
        deterministic_score: Number(hybrid.deterministicScore ?? scoring?.deterministic_score ?? 0),
        hybrid_score: Number(hybrid.hybridScore ?? scoring?.deterministic_score ?? 0),
        dimension_scores: scoring?.dimensions || null,
        weight_profile: scoring?.weight_profile || siteClassification?.weight_profile || null,
        llm_status: hybrid.llmStatus || 'unknown',
    };

    const dashboardReportingFields = {
        seo_score: scoring?.dimensions?.technical_seo?.score ?? null,
        geo_score: scoring?.dimensions?.local_readiness?.score ?? null,
        hybrid_score: finalScore.hybrid_score,
        classification_type: siteClassification?.type || null,
        classification_label: siteClassification?.label || null,
    };

    const recommendations = {
        issues_count: coerceArray(scoring?.issues).length,
        strengths_count: coerceArray(scoring?.strengths).length,
        opportunities_hooks: coerceArray(opportunitiesHooks),
    };

    return {
        __schema: {
            name: LAYERED_SCHEMA_KEY,
            version: SCHEMA_VERSION,
            audit_version: AUDIT_VERSION_LAYERED,
            generated_at: new Date().toISOString(),
        },
        target: {
            audit_id: target?.audit_id || null,
            client_id: target?.client_id || null,
            source_url: target?.source_url || scanResults?.source_url || null,
            resolved_url: target?.resolved_url || scanResults?.resolved_url || null,
        },
        crawl_metadata: crawlMetadata,
        render_metadata: renderMetadata,
        page_artifacts: pageArtifacts,
        page_level_checks: pageLevelChecks,
        site_level_raw_scores: layer1Summary,
        site_level_expert: layer2Expert
            ? {
                llms_txt_deep: layer2Expert.modules?.llms_txt_deep || null,
                ai_discovery_endpoints: layer2Expert.modules?.ai_discovery_endpoints || null,
                brand_entity: layer2Expert.modules?.brand_entity || null,
                trust_stack: layer2Expert.modules?.trust_stack || null,
                negative_signals: layer2Expert.modules?.negative_signals || null,
            }
            : null,
        normalized_evidence: {
            business_names: coerceArray(extracted.business_names),
            phones: coerceArray(extracted.phones),
            emails: coerceArray(extracted.emails),
            social_links: coerceArray(extracted.social_links),
            schema_entities: coerceArray(extracted.schema_entities),
            local_signals: extracted.local_signals || null,
            service_signals: extracted.service_signals || null,
            trust_signals: extracted.trust_signals || null,
            page_stats: extracted.page_stats || null,
        },
        classification: siteClassification || null,
        subsystem_scores: {
            layer1_raw_scan: layer1Summary,
            layer2_expert_summary: layer2Summary,
            crawler_access_score: crawlerAccess?.crawlerAccessScore ?? null,
        },
        final_trouvable_score: finalScore,
        recommendations,
        dashboard_reporting_fields: dashboardReportingFields,
        debug_benchmark: {
            single_engine_id: crawlMetadata.single_engine_id || 'trouvable.scanner.v1',
            timings: timings || null,
        },
    };
}

function summarizeFindings(findings) {
    const counts = { total: findings.length, high: 0, medium: 0, low: 0, by_module: {} };
    for (const finding of findings) {
        if (finding.severity === 'high') counts.high += 1;
        else if (finding.severity === 'medium') counts.medium += 1;
        else if (finding.severity === 'low') counts.low += 1;
        const moduleKey = finding.module || 'unspecified';
        counts.by_module[moduleKey] = (counts.by_module[moduleKey] || 0) + 1;
    }
    return counts;
}
