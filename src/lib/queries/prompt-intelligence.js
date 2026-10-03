import 'server-only';
import {
    buildCanonicalPromptContract,
    evaluateOnboardingPromptContract,
    normalizeOnboardingIntentFamily,
} from '@/lib/queries/onboarding-prompt-contract';

const INTENT_FAMILIES = [
    'brand',
    'competitor',
    'alternatives',
    'competitor_comparison',
    'pricing',
    'discovery',
    'local_recommendation',
    'service_intent',
    'buyer_guidance',
    'trust_reviews',
    'use_case',
    'implementation',
];

const INTENT_SET = new Set(INTENT_FAMILIES);

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
}

export function getPromptIntentFamilies() {
    return [...INTENT_FAMILIES];
}

export function normalizeIntentFamily(rawValue, queryText = '') {
    const value = normalizeLower(rawValue).replace(/\s+/g, '_').replace(/-/g, '_');
    if (INTENT_SET.has(value)) return value;
    return normalizeOnboardingIntentFamily(rawValue, queryText);
}

export function evaluatePromptQuality({
    queryText,
    clientName = '',
    city = '',
    category = '',
    services = [],
    knownCompetitors = [],
    intentFamily,
}) {
    const contract = buildCanonicalPromptContract({
        queryText,
        clientName,
        city,
        region: '',
        locale: 'fr-CA',
        promptOrigin: 'quality_evaluation',
        intentFamily,
        promptMode: 'user_like',
        offerAnchor: String(category || ''),
        userVisibleOffering: Array.isArray(services) && services.length > 0 ? String(services[0]) : '',
        targetAudience: '',
        primaryUseCase: '',
        differentiationAngle: Array.isArray(knownCompetitors) && knownCompetitors.length > 0 ? 'competitive' : '',
    });
    return {
        quality_status: contract.quality_status,
        quality_score: contract.quality_score,
        quality_reasons: contract.quality_reasons,
    };
}

export function buildPromptMetadata({
    queryText,
    clientName = '',
    city = '',
    region = '',
    locale = 'fr-CA',
    category = '',
    services = [],
    knownCompetitors = [],
    promptOrigin = 'manual_operator',
    intentFamily = null,
    promptMode = 'user_like',
    offerAnchor = '',
    userVisibleOffering = '',
    targetAudience = '',
    primaryUseCase = '',
    differentiationAngle = '',
}) {
    const resolvedIntentFamily = normalizeIntentFamily(intentFamily, queryText);
    const primaryService = Array.isArray(services) && services.length > 0 ? String(services[0] || '') : '';
    const contract = buildCanonicalPromptContract({
        queryText,
        clientName,
        city,
        region,
        locale,
        promptOrigin,
        intentFamily: resolvedIntentFamily,
        promptMode,
        offerAnchor: String(offerAnchor || category || primaryService || ''),
        userVisibleOffering: String(userVisibleOffering || primaryService || category || ''),
        targetAudience: String(targetAudience || ''),
        primaryUseCase: String(primaryUseCase || ''),
        differentiationAngle: String(differentiationAngle || (Array.isArray(knownCompetitors) && knownCompetitors.length > 0 ? 'competitive' : '')),
    });

    return {
        prompt_origin: contract.prompt_origin,
        intent_family: contract.intent_family,
        prompt_mode: contract.prompt_mode,
        query_type_v2: contract.query_type_v2,
        funnel_stage: contract.funnel_stage,
        geo_scope: contract.geo_scope,
        brand_scope: contract.brand_scope,
        comparison_scope: contract.comparison_scope,
        quality_status: contract.quality_status,
        quality_score: contract.quality_score,
        quality_reasons: contract.quality_reasons,
        validation_status: contract.validation_status,
        validation_reasons: contract.validation_reasons,
        offer_anchor: contract.offer_anchor,
        user_visible_offering: contract.user_visible_offering,
        target_audience: contract.target_audience,
        primary_use_case: contract.primary_use_case,
        differentiation_angle: contract.differentiation_angle,
        locale: contract.locale,
    };
}

export { evaluateOnboardingPromptContract };

export function shouldSoftBlockPromptActivation(metadata) {
    return metadata?.quality_status === 'weak';
}
