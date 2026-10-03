import 'server-only';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toNullableString(value) {
    const text = String(value ?? '').trim();
    return text ? text : null;
}

export const PROMPT_CONTRACT_DB_FIELDS = [
    'prompt_origin',
    'intent_family',
    'query_type_v2',
    'funnel_stage',
    'geo_scope',
    'brand_scope',
    'comparison_scope',
    'quality_status',
    'quality_score',
    'quality_reasons',
    'prompt_mode',
    'validation_status',
    'validation_reasons',
    'offer_anchor',
    'user_visible_offering',
    'target_audience',
    'primary_use_case',
    'differentiation_angle',
];

export function serializePromptContractForDb({
    contract = {},
    existingPromptMetadata = {},
    extraPromptMetadata = {},
}) {
    const metadata = {
        ...asObject(existingPromptMetadata),
        ...asObject(extraPromptMetadata),
    };
    const dbFields = {};

    for (const field of PROMPT_CONTRACT_DB_FIELDS) {
        const value = contract[field];
        if (value === undefined) continue;
        if (field === 'quality_reasons' || field === 'validation_reasons') {
            dbFields[field] = asArray(value);
        } else if (field === 'quality_score') {
            dbFields[field] = Number.isFinite(Number(value)) ? Number(value) : null;
        } else {
            dbFields[field] = value;
        }
        metadata[field] = dbFields[field];
    }

    return {
        dbFields,
        prompt_metadata: metadata,
    };
}

function fromRowOrMetadata(row, key) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
    const metadata = asObject(row?.prompt_metadata);
    if (metadata[key] !== undefined && metadata[key] !== null) return metadata[key];
    return undefined;
}

export function deserializePromptContractFromRow({
    row = {},
    computed = {},
}) {
    const qualityReasons = fromRowOrMetadata(row, 'quality_reasons');
    const validationReasons = fromRowOrMetadata(row, 'validation_reasons');

    return {
        ...computed,
        prompt_origin: fromRowOrMetadata(row, 'prompt_origin') || computed.prompt_origin,
        intent_family: fromRowOrMetadata(row, 'intent_family') || computed.intent_family,
        query_type_v2: fromRowOrMetadata(row, 'query_type_v2') || computed.query_type_v2,
        funnel_stage: fromRowOrMetadata(row, 'funnel_stage') || computed.funnel_stage,
        geo_scope: fromRowOrMetadata(row, 'geo_scope') || computed.geo_scope,
        brand_scope: fromRowOrMetadata(row, 'brand_scope') || computed.brand_scope,
        comparison_scope: fromRowOrMetadata(row, 'comparison_scope') || computed.comparison_scope,
        quality_status: fromRowOrMetadata(row, 'quality_status') || computed.quality_status,
        quality_score: fromRowOrMetadata(row, 'quality_score') ?? computed.quality_score,
        quality_reasons: asArray(qualityReasons).length > 0 ? asArray(qualityReasons) : asArray(computed.quality_reasons),
        prompt_mode: fromRowOrMetadata(row, 'prompt_mode') || computed.prompt_mode || 'user_like',
        validation_status: fromRowOrMetadata(row, 'validation_status') || computed.validation_status || computed.quality_status,
        validation_reasons: asArray(validationReasons).length > 0 ? asArray(validationReasons) : asArray(computed.validation_reasons || computed.quality_reasons),
        offer_anchor: toNullableString(fromRowOrMetadata(row, 'offer_anchor') ?? computed.offer_anchor),
        user_visible_offering: toNullableString(fromRowOrMetadata(row, 'user_visible_offering') ?? computed.user_visible_offering),
        target_audience: toNullableString(fromRowOrMetadata(row, 'target_audience') ?? computed.target_audience),
        primary_use_case: toNullableString(fromRowOrMetadata(row, 'primary_use_case') ?? computed.primary_use_case),
        differentiation_angle: toNullableString(fromRowOrMetadata(row, 'differentiation_angle') ?? computed.differentiation_angle),
    };
}
