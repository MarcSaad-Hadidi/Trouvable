import { z } from 'zod';

const TRACKED_QUERY_CATEGORY_VALUES = ['local_intent', 'service_intent', 'brand', 'competitor_comparison', 'discovery'];
const trackedQueryCategorySchema = z.enum(TRACKED_QUERY_CATEGORY_VALUES);
const promptQualityStatusSchema = z.enum(['strong', 'review', 'weak']);
const discoveryModeSchema = z.enum([
    'blind_discovery',
    'neutral_brand_check',
    'skeptical_brand_evaluation',
    'competitor_discovery',
    'source_grounded_evaluation',
    'controlled_context_answer',
    'operator_extraction',
    'brand_aware',
]);

export const clientCreateSchema = z.object({
    client_name: z.string().min(1).max(200),
    client_slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
    website_url: z.string().url(),
    business_type: z.string().max(120).optional(),
    target_region: z.string().max(200).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
});

export const clientUpdateSchema = z.object({
    id: z.string().uuid(),
    client_name: z.string().min(1).max(200).optional(),
    client_slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
    website_url: z.string().url().optional(),
    business_type: z.string().max(120).optional().nullable(),
    target_region: z.string().max(200).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    seo_title: z.string().max(300).optional().nullable(),
    seo_description: z.string().max(2000).optional().nullable(),
});

export const clientIdSchema = z.object({
    clientId: z.string().uuid(),
});

export const trackedQueryCreateSchema = z.object({
    clientId: z.string().uuid(),
    query_text: z.string().min(1).max(2000),
    category: trackedQueryCategorySchema.optional(),
    discovery_mode: discoveryModeSchema.optional(),
    locale: z.string().max(20).optional(),
    query_type: trackedQueryCategorySchema.optional(),
    is_active: z.boolean().optional(),
    prompt_origin: z.string().max(120).optional(),
    intent_family: z.string().max(120).optional(),
    query_type_v2: z.string().max(120).optional(),
    funnel_stage: z.string().max(120).optional(),
    geo_scope: z.string().max(120).optional(),
    brand_scope: z.string().max(120).optional(),
    comparison_scope: z.string().max(120).optional(),
    quality_status: promptQualityStatusSchema.optional(),
    quality_score: z.number().min(0).max(100).optional(),
    quality_reasons: z.array(z.string().max(240)).max(12).optional(),
    validation_status: promptQualityStatusSchema.optional(),
    validation_reasons: z.array(z.string().max(240)).max(20).optional(),
    prompt_mode: z.enum(['user_like', 'operator_probe']).optional(),
    offer_anchor: z.string().max(240).optional(),
    user_visible_offering: z.string().max(240).optional(),
    target_audience: z.string().max(120).optional(),
    primary_use_case: z.string().max(240).optional(),
    differentiation_angle: z.string().max(240).optional(),
    prompt_metadata: z.record(z.any()).optional(),
});

export const trackedQueryUpdateSchema = z.object({
    id: z.string().uuid(),
    query_text: z.string().min(1).max(2000).optional(),
    category: trackedQueryCategorySchema.optional(),
    discovery_mode: discoveryModeSchema.optional(),
    locale: z.string().max(20).optional(),
    query_type: trackedQueryCategorySchema.optional(),
    is_active: z.boolean().optional(),
    prompt_origin: z.string().max(120).optional(),
    intent_family: z.string().max(120).optional(),
    query_type_v2: z.string().max(120).optional(),
    funnel_stage: z.string().max(120).optional(),
    geo_scope: z.string().max(120).optional(),
    brand_scope: z.string().max(120).optional(),
    comparison_scope: z.string().max(120).optional(),
    quality_status: promptQualityStatusSchema.optional(),
    quality_score: z.number().min(0).max(100).optional(),
    quality_reasons: z.array(z.string().max(240)).max(12).optional(),
    validation_status: promptQualityStatusSchema.optional(),
    validation_reasons: z.array(z.string().max(240)).max(20).optional(),
    prompt_mode: z.enum(['user_like', 'operator_probe']).optional(),
    offer_anchor: z.string().max(240).optional(),
    user_visible_offering: z.string().max(240).optional(),
    target_audience: z.string().max(120).optional(),
    primary_use_case: z.string().max(240).optional(),
    differentiation_angle: z.string().max(240).optional(),
    prompt_metadata: z.record(z.any()).optional(),
});

export const trackedQueryIdSchema = z.object({
    id: z.string().uuid(),
});

export const trackedQueryToggleSchema = z.object({
    id: z.string().uuid(),
    is_active: z.boolean(),
});
