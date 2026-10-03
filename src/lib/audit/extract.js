import { classifySiteForAudit } from './site-classification.js';

function uniqueStrings(values = []) {
    return [...new Set((values || []).filter(Boolean))];
}

function simplifySchemaEntities(entities = []) {
    return (entities || []).slice(0, 8).map((entity) => ({
        type: entity.type,
        name: entity.name || null,
        telephone: entity.telephone || null,
        email: entity.email || null,
        areaServed: (entity.areaServed || []).slice(0, 4),
        address: entity.address?.line || null,
    }));
}

/**
 * Extrait et nettoie les donnees du crawl pour les envoyer au LLM.
 * Le but: produire une representation compacte, evidence-driven et schema-safe.
 */
export function extractForLLM(scanResults, providedSiteClassification = null) {
    const ed = scanResults.extracted_data || {};
    const siteClassification = providedSiteClassification || classifySiteForAudit(scanResults);
    const textChunks = (ed.text_chunks || []).slice(0, 14);
    const cleanText = textChunks
        .join('\n\n')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000);

    const pageSummaries = (ed.page_summaries || []).slice(0, 8).map((page) => ({
        url: page.url,
        page_type: page.page_type,
        title: page.title || null,
        h1: page.h1 || null,
        word_count: page.word_count || 0,
        faq_pairs_count: page.faq_pairs_count || 0,
        text_sample: page.text_sample || null,
    }));

    return {
        source_url: scanResults.source_url,
        resolved_url: scanResults.resolved_url,
        pages_scanned: scanResults.scanned_pages?.length || 0,
        page_summaries: pageSummaries,
        titles: ed.titles || [],
        descriptions: ed.descriptions || [],
        h1s: ed.h1s || [],
        h2_clusters: ed.h2_clusters || [],
        phones: ed.phones || [],
        emails: ed.emails || [],
        social_links: ed.social_links || [],
        business_names: ed.business_names || [],
        has_local_business_schema: ed.has_local_business_schema || false,
        has_faq_schema: ed.has_faq_schema || false,
        schema_entities: simplifySchemaEntities(ed.schema_entities || []),
        faq_pairs: (ed.faq_pairs || []).slice(0, 8),
        local_signals: {
            cities: (ed.local_signals?.cities || []).slice(0, 6),
            regions: (ed.local_signals?.regions || []).slice(0, 6),
            area_served: (ed.local_signals?.area_served || []).slice(0, 8),
            address_lines: (ed.local_signals?.address_lines || []).slice(0, 4),
            maps_links_count: (ed.local_signals?.maps_links || []).length,
        },
        service_signals: {
            services: (ed.service_signals?.services || []).slice(0, 8),
            keywords: (ed.service_signals?.keywords || []).slice(0, 8),
        },
        trust_signals: {
            proof_terms: (ed.trust_signals?.proof_terms || []).slice(0, 8),
            review_terms: (ed.trust_signals?.review_terms || []).slice(0, 8),
            social_networks: (ed.trust_signals?.social_networks || []).slice(0, 8),
        },
        technology_signals: {
            has_next_data: ed.technology_signals?.has_next_data === true,
            hydration_hints: ed.technology_signals?.hydration_hints || [],
            app_shell_pages: ed.technology_signals?.app_shell_pages || 0,
        },
        page_stats: ed.page_stats || {},
        site_classification: {
            type: siteClassification.type,
            label: siteClassification.label,
            confidence: siteClassification.confidence,
            reasons: siteClassification.reasons || [],
            evidence_summary: siteClassification.evidence_summary || [],
        },
        evidence_summary: uniqueStrings([
            ...(ed.business_names || []).slice(0, 2),
            ...(ed.local_signals?.cities || []).slice(0, 2),
            ...(ed.service_signals?.services || []).slice(0, 2),
            ...(ed.trust_signals?.proof_terms || []).slice(0, 2),
            ...(ed.trust_signals?.social_networks || []).slice(0, 2),
        ]).slice(0, 10),
        text_content: cleanText,
    };
}
