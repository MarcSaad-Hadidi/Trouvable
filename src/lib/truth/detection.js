import { resolveBusinessType } from '@/lib/ai/business-type-resolver';

import {
    TRUTH_ENGINE_VERSION,
    defaultReviewStatusForTruthClass,
    normalizeConfidenceBand,
    uniqueTruthyStrings,
} from './definitions';

function buildFact({ key, label, value, truthClass, confidence, reviewStatus, provenance = [], evidence = [], metadata = {} }) {
    return {
        key,
        label,
        value,
        truth_class: truthClass,
        confidence,
        review_status: reviewStatus,
        provenance,
        evidence,
        metadata,
    };
}

function normalizePageFact(page, index) {
    const pageType = String(page?.page_type || '').trim() || 'page';
    const url = String(page?.url || '').trim();
    const title = String(page?.title || '').trim();
    const evidence = uniqueTruthyStrings([title, url]);

    return buildFact({
        key: `key_page_${index + 1}`,
        label: 'Key page',
        value: {
            page_type: pageType,
            url,
            title,
        },
        truthClass: 'observed',
        confidence: 'high',
        reviewStatus: 'auto_accepted',
        provenance: [{ source_type: 'audit_crawl', field: 'page_summaries', truth_class: 'observed' }],
        evidence,
        metadata: { page_type: pageType },
    });
}

function buildLocalityFact({ address = {}, targetRegion = '', localSignals = {} }) {
    const primaryCity = String(address?.city || localSignals?.cities?.[0] || '').trim();
    const primaryRegion = String(address?.region || localSignals?.regions?.[0] || targetRegion || '').trim();
    const serviceArea = uniqueTruthyStrings([
        ...(Array.isArray(localSignals?.cities) ? localSignals.cities : []),
        ...(Array.isArray(localSignals?.regions) ? localSignals.regions : []),
        ...(Array.isArray(localSignals?.area_served) ? localSignals.area_served : []),
    ]).slice(0, 8);
    const addressLines = uniqueTruthyStrings(localSignals?.address_lines || []).slice(0, 4);
    const evidence = uniqueTruthyStrings([primaryCity, primaryRegion, ...serviceArea, ...addressLines]).slice(0, 8);

    if (!primaryCity && !primaryRegion && serviceArea.length === 0 && addressLines.length === 0) {
        return buildFact({
            key: 'locality',
            label: 'Local footprint',
            value: null,
            truthClass: 'uncertain',
            confidence: 'low',
            reviewStatus: 'blocked',
            provenance: [{ source_type: 'audit_crawl', field: 'local_signals', truth_class: 'uncertain' }],
            evidence: [],
            metadata: { service_area_count: 0 },
        });
    }

    return buildFact({
        key: 'locality',
        label: 'Local footprint',
        value: {
            primary_city: primaryCity || null,
            primary_region: primaryRegion || null,
            service_area: serviceArea,
            address_lines: addressLines,
        },
        truthClass: 'observed',
        confidence: evidence.length >= 3 ? 'high' : 'medium',
        reviewStatus: 'auto_accepted',
        provenance: [{ source_type: 'audit_crawl', field: 'local_signals', truth_class: 'observed' }],
        evidence,
        metadata: { service_area_count: serviceArea.length },
    });
}

function buildBusinessTypeFact({ rawBusinessType, resolvedBusiness, siteClassification }) {
    const rawType = String(rawBusinessType || '').trim();
    const hasObservedType = rawType.length > 0 && !/^(localbusiness|organization|business|company|service)$/i.test(rawType);
    const fallbackValue = String(resolvedBusiness?.offering_anchor || siteClassification?.label || '').trim();
    const value = hasObservedType ? rawType : fallbackValue || null;
    const truthClass = value
        ? (hasObservedType ? 'observed' : resolvedBusiness?.needs_review ? 'uncertain' : 'inferred')
        : 'uncertain';
    const confidence = hasObservedType
        ? 'high'
        : normalizeConfidenceBand(resolvedBusiness?.category_confidence, resolvedBusiness?.needs_review ? 'low' : 'medium');

    return buildFact({
        key: 'business_type',
        label: 'Business type',
        value,
        truthClass,
        confidence,
        reviewStatus: defaultReviewStatusForTruthClass(truthClass),
        provenance: [
            hasObservedType
                ? { source_type: 'client_profile', field: 'business_type', truth_class: 'observed' }
                : { source_type: 'audit_classification', field: 'offering_anchor', truth_class: truthClass },
        ],
        evidence: uniqueTruthyStrings([rawType, resolvedBusiness?.offering_anchor, siteClassification?.label]).slice(0, 4),
        metadata: {
            raw_input: rawType || null,
            site_type: siteClassification?.type || null,
        },
    });
}

function buildCanonicalCategoryFact({ rawBusinessType, resolvedBusiness, siteClassification }) {
    const rawType = String(rawBusinessType || '').trim();
    const hasObservedType = rawType.length > 0 && !/^(localbusiness|organization|business|company|service)$/i.test(rawType);
    const value = String(resolvedBusiness?.canonical_category || '').trim() || 'unknown';
    const weakSiteClassification = !siteClassification?.type
        || siteClassification.type === 'generic_business'
        || normalizeConfidenceBand(siteClassification?.confidence, 'low') === 'low';
    const truthClass = value === 'unknown'
        ? 'uncertain'
        : resolvedBusiness?.needs_review
            ? 'uncertain'
            : weakSiteClassification && !hasObservedType
                ? 'uncertain'
            : hasObservedType
                ? 'derived'
                : 'inferred';
    const confidence = normalizeConfidenceBand(resolvedBusiness?.category_confidence, truthClass === 'uncertain' ? 'low' : 'medium');

    return buildFact({
        key: 'canonical_category',
        label: 'Canonical category',
        value,
        truthClass,
        confidence,
        reviewStatus: defaultReviewStatusForTruthClass(truthClass),
        provenance: [{ source_type: 'business_type_resolver', field: 'canonical_category', truth_class: truthClass }],
        evidence: uniqueTruthyStrings([
            rawType,
            resolvedBusiness?.offering_anchor,
            resolvedBusiness?.category_resolution_reason,
            siteClassification?.label,
        ]).slice(0, 4),
        metadata: {
            business_model: resolvedBusiness?.business_model_detected || null,
            target_audience: resolvedBusiness?.target_audience || null,
        },
    });
}

function buildBusinessModelFact({ resolvedBusiness, siteClassification }) {
    const value = String(resolvedBusiness?.business_model_detected || '').trim() || String(siteClassification?.type || '').trim() || null;
    const weakSiteClassification = !siteClassification?.type
        || siteClassification.type === 'generic_business'
        || normalizeConfidenceBand(siteClassification?.confidence, 'low') === 'low';
    const truthClass = value
        ? (resolvedBusiness?.needs_review || weakSiteClassification ? 'uncertain' : siteClassification?.type ? 'derived' : 'inferred')
        : 'uncertain';

    return buildFact({
        key: 'business_model',
        label: 'Business model',
        value,
        truthClass,
        confidence: normalizeConfidenceBand(resolvedBusiness?.category_confidence, truthClass === 'uncertain' ? 'low' : 'medium'),
        reviewStatus: defaultReviewStatusForTruthClass(truthClass),
        provenance: [{ source_type: 'business_type_resolver', field: 'business_model_detected', truth_class: truthClass }],
        evidence: uniqueTruthyStrings([resolvedBusiness?.category_resolution_reason, siteClassification?.label]).slice(0, 3),
    });
}

export function buildCanonicalBusinessDetection({
    clientName = '',
    rawBusinessType = '',
    siteClassification = {},
    servicesPreview = [],
    shortDescription = '',
    seoTeaser = '',
    address = {},
    targetRegion = '',
    localSignals = {},
    pageSummaries = [],
}) {
    const mergedClassification = {
        ...(siteClassification || {}),
        services_preview: Array.isArray(servicesPreview) ? servicesPreview : [],
        short_description_preview: String(shortDescription || '').trim().slice(0, 400),
        seo_teaser: String(seoTeaser || '').trim().slice(0, 220),
    };

    const resolvedBusiness = resolveBusinessType(String(rawBusinessType || '').trim(), mergedClassification, String(clientName || '').trim());
    const facts = {
        business_type: buildBusinessTypeFact({ rawBusinessType, resolvedBusiness, siteClassification: mergedClassification }),
        canonical_category: buildCanonicalCategoryFact({ rawBusinessType, resolvedBusiness, siteClassification: mergedClassification }),
        business_model: buildBusinessModelFact({ resolvedBusiness, siteClassification: mergedClassification }),
        locality: buildLocalityFact({ address, targetRegion, localSignals }),
        key_pages: (Array.isArray(pageSummaries) ? pageSummaries : []).slice(0, 6).map(normalizePageFact),
    };

    const reviewQueue = [
        facts.business_type,
        facts.canonical_category,
        facts.business_model,
        facts.locality,
    ]
        .filter((fact) => fact.review_status !== 'auto_accepted')
        .map((fact) => fact.key);

    return {
        version: TRUTH_ENGINE_VERSION,
        generated_at: new Date().toISOString(),
        facts,
        review_queue: reviewQueue,
        resolved_business: {
            ...resolvedBusiness,
            truth_class: facts.canonical_category.truth_class,
            confidence: facts.canonical_category.confidence,
            review_status: facts.canonical_category.review_status,
            provenance_entries: facts.canonical_category.provenance,
        },
        diagnostics: {
            needs_review: reviewQueue.length > 0,
            review_item_count: reviewQueue.length,
            has_observed_locality: facts.locality.truth_class === 'observed',
            key_page_count: facts.key_pages.length,
        },
    };
}