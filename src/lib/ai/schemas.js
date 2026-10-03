import { z } from 'zod';

const opportunityCategorySchema = z.enum(['seo', 'geo', 'content', 'technical', 'trust']);
const opportunitySourceSchema = z.enum(['observed', 'inferred', 'recommended']);
const confidenceSchema = z.enum(['high', 'medium', 'low']);

/**
 * Schema de reponse pour l'analyse d'audit par le LLM.
 */
export const auditAnalysisSchema = z.object({
    business_summary: z.string().describe("Resume court de l'activite observee sur le site"),
    geo_recommendability: z.enum(['strong', 'moderate', 'weak', 'unclear']).describe('Niveau de recommandabilite GEO'),
    geo_recommendability_rationale: z.string().describe("Justification de l'evaluation GEO"),
    llm_comprehension_score: z.number().int().min(0).max(15).describe('Score /15 de comprehension LLM'),
    answerability_summary: z.string().optional().describe("Resume de la clarte reponse / answerability"),
    opportunities: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        category: opportunityCategorySchema,
        source: opportunitySourceSchema,
        evidence_summary: z.string().optional(),
        recommended_fix: z.string().optional(),
    })).describe('Opportunites identifiees'),
    faq_suggestions: z.array(z.object({
        question: z.string(),
        suggested_answer: z.string(),
        source: opportunitySourceSchema,
        rationale: z.string().optional(),
    })).describe('Suggestions de FAQ'),
    merge_suggestions: z.array(z.object({
        field_name: z.string(),
        suggested_value: z.any(),
        confidence: confidenceSchema,
        rationale: z.string(),
        source: opportunitySourceSchema,
    })).describe('Suggestions de donnees a merger dans le profil'),
    detected_services: z.array(z.string()).optional(),
    detected_areas: z.array(z.string()).optional(),
    detected_business_name: z.string().nullable().optional(),
});

/**
 * Schema de reponse pour un GEO query run.
 */
export const geoQueryRunSchema = z.object({
    query: z.string(),
    response_text: z.string().describe('La reponse complete generee par le modele'),
    mentioned_businesses: z.array(z.object({
        name: z.string(),
        position: z.number().int().min(1).describe('Position dans la reponse (1 = premier mentionne)'),
        context: z.string().describe('Extrait du passage ou le business est mentionne'),
        is_target: z.boolean().describe("True si c'est le business suivi"),
        sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    })),
    total_businesses_mentioned: z.number().int(),
    target_found: z.boolean(),
    target_position: z.number().int().nullable(),
    brand_mentioned: z.boolean().optional(),
    brand_position: z.number().int().nullable().optional(),
    competitors_mentioned: z.array(z.string()).optional(),
    urls_cited: z.array(z.string()).optional(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    evidence_level: z.enum(['none', 'weak', 'source_provided', 'cited_url', 'verified_source']).optional(),
    claims: z.array(z.string()).optional(),
    unsupported_claims: z.array(z.string()).optional(),
    citations: z.array(z.object({
        url: z.string(),
        claim: z.string().optional(),
        evidence_span: z.string().optional(),
    })).optional(),
    uncertainty_flags: z.array(z.string()).optional(),
    hallucination_risk: z.enum(['low', 'medium', 'high']).optional(),
});

/**
 * Schema pour la validation d'un payload de lancement d'audit.
 */
export const auditRunPayloadSchema = z.object({
    clientId: z.string().uuid().optional(),
    websiteUrl: z.string().url().optional(),
    clientName: z.string().min(1).optional(),
}).refine(
    (data) => data.clientId || (data.websiteUrl && data.clientName),
    { message: 'clientId OU (websiteUrl + clientName) requis' }
);

/**
 * Schema pour le payload de query run.
 */
export const queryRunPayloadSchema = z.object({
    clientId: z.string().uuid(),
    trackedQueryId: z.string().uuid().optional(),
});

/**
 * Schema pour l'application d'une merge suggestion.
 */
export const mergeApplyPayloadSchema = z.object({
    mergeSuggestionId: z.string().uuid(),
});
