import { auditAnalysisSchema, geoQueryRunSchema } from './schemas.js';

function normalizePriority(value) {
    return ['high', 'medium', 'low'].includes(value) ? value : 'medium';
}

function normalizeOpportunityCategory(value, text = '') {
    if (['seo', 'geo', 'content', 'technical', 'trust'].includes(value)) return value;

    const haystack = `${value || ''} ${text || ''}`.toLowerCase();
    if (/(https|noindex|canonical|crawl|schema)/.test(haystack)) return 'technical';
    if (/(local|city|region|area served|zone|maps|address)/.test(haystack)) return 'geo';
    if (/(faq|answer|content|service|offer)/.test(haystack)) return 'content';
    if (/(trust|review|social|testimonial|proof|credib)/.test(haystack)) return 'trust';
    return 'seo';
}

function normalizeSource(value) {
    return ['observed', 'inferred', 'recommended'].includes(value) ? value : 'recommended';
}

function normalizeConfidence(value) {
    return ['high', 'medium', 'low'].includes(value) ? value : 'medium';
}

function stringOrFallback(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function stringArray(value) {
    return Array.isArray(value)
        ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))]
        : [];
}

function normalizeEvidenceLevel(value) {
    return ['none', 'weak', 'source_provided', 'cited_url', 'verified_source'].includes(value) ? value : 'none';
}

function normalizeSentiment(value) {
    return ['positive', 'neutral', 'negative'].includes(value) ? value : 'neutral';
}

function normalizeHallucinationRisk(value) {
    return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function normalizeCitations(value) {
    return Array.isArray(value)
        ? value
            .map((item) => ({
                url: stringOrFallback(item?.url),
                claim: stringOrFallback(item?.claim),
                evidence_span: stringOrFallback(item?.evidence_span),
            }))
            .filter((item) => item.url)
        : [];
}

function normalizeOpportunity(raw) {
    const title = stringOrFallback(raw?.title);
    const description = stringOrFallback(raw?.description);
    if (!title || !description) return null;

    return {
        title,
        description,
        priority: normalizePriority(raw?.priority),
        category: normalizeOpportunityCategory(raw?.category, `${title} ${description}`),
        source: normalizeSource(raw?.source),
        evidence_summary: stringOrFallback(raw?.evidence_summary),
        recommended_fix: stringOrFallback(raw?.recommended_fix),
    };
}

function normalizeFaqSuggestion(raw) {
    const question = stringOrFallback(raw?.question);
    if (!question) return null;

    return {
        question,
        suggested_answer: stringOrFallback(raw?.suggested_answer),
        source: normalizeSource(raw?.source),
        rationale: stringOrFallback(raw?.rationale),
    };
}

function normalizeMergeSuggestion(raw) {
    const field_name = stringOrFallback(raw?.field_name);
    const suggested_value = raw?.suggested_value;
    if (!field_name || suggested_value === null || suggested_value === undefined || suggested_value === '') return null;

    return {
        field_name,
        suggested_value,
        confidence: normalizeConfidence(raw?.confidence),
        rationale: stringOrFallback(raw?.rationale, 'Suggestion IA'),
        source: normalizeSource(raw?.source),
    };
}

/**
 * Valide et normalise la reponse d'analyse d'audit via Zod.
 * Retourne { success, data, errors }.
 */
export function normalizeAuditAnalysis(rawData) {
    if (!rawData || typeof rawData !== 'object') {
        console.warn('[AI/Normalize] rawData absent ou non-objet, retour par defaut');
        rawData = {};
    }

    const result = auditAnalysisSchema.safeParse(rawData);
    if (result.success) {
        return { success: true, data: result.data, errors: null };
    }

    console.warn('[AI/Normalize] Audit analysis validation partielle:', result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));

    const partial = {
        business_summary: stringOrFallback(rawData?.business_summary, 'Resume non disponible'),
        geo_recommendability: ['strong', 'moderate', 'weak', 'unclear'].includes(rawData?.geo_recommendability) ? rawData.geo_recommendability : 'unclear',
        geo_recommendability_rationale: stringOrFallback(rawData?.geo_recommendability_rationale),
        llm_comprehension_score: Number.isFinite(rawData?.llm_comprehension_score) ? Math.min(15, Math.max(0, Math.round(rawData.llm_comprehension_score))) : 0,
        answerability_summary: stringOrFallback(rawData?.answerability_summary),
        opportunities: Array.isArray(rawData?.opportunities) ? rawData.opportunities.map(normalizeOpportunity).filter(Boolean) : [],
        faq_suggestions: Array.isArray(rawData?.faq_suggestions) ? rawData.faq_suggestions.map(normalizeFaqSuggestion).filter(Boolean) : [],
        merge_suggestions: Array.isArray(rawData?.merge_suggestions) ? rawData.merge_suggestions.map(normalizeMergeSuggestion).filter(Boolean) : [],
        detected_services: stringArray(rawData?.detected_services),
        detected_areas: stringArray(rawData?.detected_areas),
        detected_business_name: stringOrFallback(rawData?.detected_business_name) || null,
    };

    return { success: false, data: partial, errors: result.error.issues };
}

/**
 * Valide et normalise la reponse d'analyse de GEO query.
 */
export function normalizeGeoQueryAnalysis(rawData) {
    if (!rawData || typeof rawData !== 'object') {
        console.warn('[AI/Normalize] rawData GEO absent ou non-objet, retour par defaut');
        rawData = {};
    }

    const result = geoQueryRunSchema.safeParse(rawData);
    if (result.success) {
        return { success: true, data: result.data, errors: null };
    }

    console.warn('[AI/Normalize] GEO query validation partielle:', result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));

    const partial = {
        query: stringOrFallback(rawData?.query),
        response_text: stringOrFallback(rawData?.response_text),
        mentioned_businesses: Array.isArray(rawData?.mentioned_businesses) ? rawData.mentioned_businesses : [],
        total_businesses_mentioned: Number.isFinite(rawData?.total_businesses_mentioned) ? rawData.total_businesses_mentioned : 0,
        target_found: rawData?.target_found === true,
        target_position: Number.isFinite(rawData?.target_position) ? rawData.target_position : null,
        brand_mentioned: rawData?.brand_mentioned === true || rawData?.target_found === true,
        brand_position: Number.isFinite(rawData?.brand_position)
            ? rawData.brand_position
            : (Number.isFinite(rawData?.target_position) ? rawData.target_position : null),
        competitors_mentioned: stringArray(rawData?.competitors_mentioned),
        urls_cited: stringArray(rawData?.urls_cited),
        sentiment: normalizeSentiment(rawData?.sentiment),
        evidence_level: normalizeEvidenceLevel(rawData?.evidence_level),
        claims: stringArray(rawData?.claims),
        unsupported_claims: stringArray(rawData?.unsupported_claims),
        citations: normalizeCitations(rawData?.citations),
        uncertainty_flags: stringArray(rawData?.uncertainty_flags),
        hallucination_risk: normalizeHallucinationRisk(rawData?.hallucination_risk),
    };

    return { success: false, data: partial, errors: result.error.issues };
}
