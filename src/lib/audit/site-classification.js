function uniqueStrings(values = []) {
    return [...new Set(
        values
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
    )];
}

function pushReason(reasons, type, score, label, evidence) {
    if (score <= 0) return;
    reasons[type].push({ label, score, evidence });
}

function clampConfidence(value) {
    if (value >= 7) return 'high';
    if (value >= 4) return 'medium';
    return 'low';
}

function getWeightProfile(type) {
    switch (type) {
        case 'local_business':
            return {
                technical_seo: 0.24,
                local_readiness: 0.26,
                ai_answerability: 0.2,
                trust_signals: 0.17,
                identity_completeness: 0.13,
            };
        case 'saas_software':
            return {
                technical_seo: 0.3,
                local_readiness: 0.08,
                ai_answerability: 0.28,
                trust_signals: 0.18,
                identity_completeness: 0.16,
            };
        case 'hybrid_business':
            return {
                technical_seo: 0.25,
                local_readiness: 0.2,
                ai_answerability: 0.22,
                trust_signals: 0.18,
                identity_completeness: 0.15,
            };
        case 'content_led':
            return {
                technical_seo: 0.24,
                local_readiness: 0.08,
                ai_answerability: 0.34,
                trust_signals: 0.18,
                identity_completeness: 0.16,
            };
        default:
            return {
                technical_seo: 0.26,
                local_readiness: 0.14,
                ai_answerability: 0.24,
                trust_signals: 0.18,
                identity_completeness: 0.18,
            };
    }
}

function getApplicability(type) {
    switch (type) {
        case 'local_business':
            return {
                local_schema: 'high',
                service_area: 'high',
                physical_location: 'high',
                public_contact: 'high',
            };
        case 'hybrid_business':
            return {
                local_schema: 'medium',
                service_area: 'medium',
                physical_location: 'medium',
                public_contact: 'high',
            };
        case 'saas_software':
            return {
                local_schema: 'low',
                service_area: 'low',
                physical_location: 'low',
                public_contact: 'medium',
            };
        case 'content_led':
            return {
                local_schema: 'low',
                service_area: 'low',
                physical_location: 'low',
                public_contact: 'medium',
            };
        default:
            return {
                local_schema: 'medium',
                service_area: 'medium',
                physical_location: 'medium',
                public_contact: 'medium',
            };
    }
}

export function classifySiteForAudit(scanResults) {
    const extracted = scanResults?.extracted_data || {};
    const pageSummaries = extracted.page_summaries || [];
    const schemaTypes = uniqueStrings((extracted.schema_entities || []).map((entity) => entity.type));
    const allText = String((extracted.text_chunks || []).join(' ')).toLowerCase();
    const titles = uniqueStrings(extracted.titles || []).join(' ').toLowerCase();
    const pageTypeList = pageSummaries.map((page) => page.page_type).filter(Boolean);
    const pageUrls = pageSummaries.map((page) => page.url || '').join(' ').toLowerCase();

    const scores = {
        local_business: 0,
        saas_software: 0,
        hybrid_business: 0,
        content_led: 0,
        generic_business: 0,
    };

    const reasons = {
        local_business: [],
        saas_software: [],
        hybrid_business: [],
        content_led: [],
        generic_business: [],
    };

    const localSignals = extracted.local_signals || {};
    const trustSignals = extracted.trust_signals || {};
    const serviceSignals = extracted.service_signals || {};

    if (extracted.has_local_business_schema) {
        scores.local_business += 4;
        pushReason(reasons, 'local_business', 4, 'LocalBusiness schema detected', 'Observed JSON-LD includes LocalBusiness.');
    }

    if ((localSignals.cities || []).length > 0 || (localSignals.regions || []).length > 0) {
        scores.local_business += 3;
        pushReason(
            reasons,
            'local_business',
            3,
            'Local geography mentioned',
            `Observed local signals: ${[...(localSignals.cities || []), ...(localSignals.regions || [])].slice(0, 4).join(', ')}`
        );
    }

    if ((localSignals.address_lines || []).length > 0 || (localSignals.maps_links || []).length > 0) {
        scores.local_business += 2;
        pushReason(reasons, 'local_business', 2, 'Physical location evidence', 'Address-like or map-link evidence was detected.');
    }

    if ((extracted.phones || []).length > 0 && (extracted.emails || []).length > 0) {
        scores.local_business += 1;
        pushReason(reasons, 'local_business', 1, 'Public contact signals', 'Phone and email were both observed.');
    }

    // Strong local-business boost: service keywords + contact + real geographic evidence (not just generic business identity)
    const hasServiceLanguage = (serviceSignals.keywords || []).some(k => ['service', 'services', 'solution', 'solutions', 'expertise', 'specialite'].includes(k));
    const hasStrongContact = (extracted.phones || []).length > 0 && (extracted.emails || []).length > 0;
    const hasRealLocalGeo = (localSignals.cities || []).length > 0 || (localSignals.regions || []).length > 0 || (localSignals.address_lines || []).length > 0;
    if (hasServiceLanguage && hasStrongContact && hasRealLocalGeo && !schemaTypes.some((type) => /softwareapplication/i.test(type))) {
        scores.local_business += 2;
        pushReason(reasons, 'local_business', 2, 'Service-business with public contact and local footprint', 'Service language plus visible contact and local geography suggest a local/service business.');
    }

    // Local terms boost from extraction
    if ((localSignals.local_terms || []).length >= 2) {
        scores.local_business += 2;
        pushReason(reasons, 'local_business', 2, 'Local vocabulary detected',
            `Local terms observed: ${(localSignals.local_terms || []).slice(0, 4).join(', ')}`);
    }

    const saasKeywordMatches = [
        'logiciel', 'software', 'plateforme', 'platform', 'saas', 'demo', 'free trial', 'essai gratuit',
        'signup', 'integrations', 'api', 'dashboard',
    ].filter((keyword) => allText.includes(keyword) || titles.includes(keyword) || pageUrls.includes(keyword));

    // These are ambiguous terms that appear on BOTH local and SaaS sites.
    // Only count them as SaaS signals if at least one strong SaaS-specific keyword is already present.
    const ambiguousSaasMatches = [
        'login', 'connexion', 'sign in', 'pricing', 'tarifs',
    ].filter((keyword) => allText.includes(keyword) || titles.includes(keyword) || pageUrls.includes(keyword));

    if (schemaTypes.some((type) => /softwareapplication/i.test(type))) {
        scores.saas_software += 4;
        pushReason(reasons, 'saas_software', 4, 'Software schema detected', 'Observed JSON-LD includes SoftwareApplication.');
    }

    // Only count ambiguous SaaS terms if there's at least 1 strong SaaS keyword
    const effectiveSaasMatches = saasKeywordMatches.length > 0
        ? [...saasKeywordMatches, ...ambiguousSaasMatches]
        : ambiguousSaasMatches.length >= 3 ? ambiguousSaasMatches : [];

    if (effectiveSaasMatches.length >= 3) {
        scores.saas_software += 4;
        pushReason(reasons, 'saas_software', 4, 'Software/product language', `Observed SaaS/product keywords: ${effectiveSaasMatches.slice(0, 5).join(', ')}`);
    } else if (effectiveSaasMatches.length > 0) {
        scores.saas_software += 2;
        pushReason(reasons, 'saas_software', 2, 'Some software/product language', `Observed keywords: ${effectiveSaasMatches.join(', ')}`);
    }

    if (pageTypeList.some((type) => ['pricing', 'features', 'product', 'docs'].includes(type))) {
        scores.saas_software += 2;
        pushReason(reasons, 'saas_software', 2, 'Product pages detected', 'Pricing/features/docs/product style pages were observed.');
    }

    const contentKeywordMatches = [
        'blog', 'article', 'guide', 'ressource', 'ressources', 'news', 'actualite', 'insights', 'editorial', 'podcast'
    ].filter((keyword) => allText.includes(keyword) || titles.includes(keyword) || pageUrls.includes(keyword));

    if (schemaTypes.some((type) => /(article|blogposting|newsarticle)/i.test(type))) {
        scores.content_led += 4;
        pushReason(reasons, 'content_led', 4, 'Editorial schema detected', 'Observed JSON-LD includes Article/BlogPosting.');
    }

    if (contentKeywordMatches.length >= 2) {
        scores.content_led += 3;
        pushReason(reasons, 'content_led', 3, 'Editorial language', `Observed editorial keywords: ${contentKeywordMatches.slice(0, 4).join(', ')}`);
    }

    const longFormPages = pageSummaries.filter((page) => Number(page.word_count || 0) >= 700).length;
    if (longFormPages >= 2) {
        scores.content_led += 2;
        pushReason(reasons, 'content_led', 2, 'Long-form content detected', `${longFormPages} pages contain substantial text.`);
    }

    const agencyKeywordMatches = ['agence', 'agency', 'studio', 'consulting', 'cabinet', 'services numeriques', 'marketing'].filter(
        (keyword) => allText.includes(keyword) || titles.includes(keyword)
    );

    // Hybrid only when BOTH local and another type have genuinely strong evidence, and neither clearly dominates
    if (scores.local_business >= 6 && scores.saas_software >= 4) {
        scores.hybrid_business += 5;
        pushReason(reasons, 'hybrid_business', 5, 'Strong mixed local and SaaS signals', 'Observed strong local-business signals alongside strong software/product signals.');
    } else if (scores.local_business >= 6 && agencyKeywordMatches.length > 0) {
        scores.hybrid_business += 5;
        pushReason(reasons, 'hybrid_business', 5, 'Mixed local and agency signals', 'Observed strong local-business signals alongside agency signals.');
    }

    if (scores.local_business === 0 && scores.saas_software === 0 && scores.content_led === 0) {
        scores.generic_business = 3;
        pushReason(reasons, 'generic_business', 3, 'No strong specialist profile', 'The site looks like a generic business presence.');
    } else {
        scores.generic_business = 1;
    }

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topType = ranked[0]?.[0] || 'generic_business';
    const topScore = ranked[0]?.[1] || 0;
    const secondScore = ranked[1]?.[1] || 0;

    // No forced hybrid override — let the natural ranking decide.
    // This prevents a dominant SaaS or content-led classification from being overridden.

    const confidenceValue = Math.max(1, topScore - secondScore + topScore);
    const labelMap = {
        local_business: 'Local business',
        saas_software: 'SaaS / software',
        hybrid_business: 'Hybrid business',
        content_led: 'Content-led site',
        generic_business: 'Generic business',
    };

    return {
        type: topType,
        label: labelMap[topType] || 'Generic business',
        confidence: clampConfidence(confidenceValue),
        scores,
        reasons: reasons[topType] || [],
        applicability: getApplicability(topType),
        weight_profile: getWeightProfile(topType),
        evidence_summary: uniqueStrings([
            ...(extracted.business_names || []).slice(0, 2),
            ...schemaTypes.slice(0, 3),
            ...(localSignals.cities || []).slice(0, 2),
            ...saasKeywordMatches.slice(0, 2),
            ...contentKeywordMatches.slice(0, 2),
            ...(serviceSignals.services || []).slice(0, 2),
            ...(trustSignals.proof_terms || []).slice(0, 2),
        ]).slice(0, 8),
    };
}
