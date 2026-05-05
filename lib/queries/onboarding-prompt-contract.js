function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
}

function uniqueList(values = []) {
    const seen = new Set();
    const output = [];
    for (const rawValue of values) {
        const value = normalizeText(rawValue);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(value);
    }
    return output;
}

function wordCount(text) {
    return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function countIntentSeparators(text) {
    const lowered = normalizeLower(text);
    const separators = lowered.match(/,|;|\/| et | puis | ensuite | tandis que | ainsi que | \+ /g) || [];
    return separators.length;
}

function hasInternalOfferLabel(text) {
    const lowered = normalizeLower(text);
    return (
        /(^|\s)\d+\.\s*[a-z]/i.test(text)
        || /diagnostic\s*&\s*strategie|strat[ée]gie\s*&\s*diagnostic|phase\s*\d+/i.test(text)
        || /offre\s*#?\d+|pack\s*\d+/i.test(text)
        || /local_business|schema\.org|service local|entreprise g[ée]n[ée]rique/i.test(lowered)
    );
}

function hasQuestionSignal(text) {
    const lowered = normalizeLower(text);
    return /\?|quel|quelle|quels|quelles|comment|pourquoi|dans quels cas|quels criteres|quels critères/.test(lowered);
}

export function normalizeOnboardingIntentFamily(rawValue, queryText = '') {
    const value = normalizeLower(rawValue).replace(/\s+/g, '_').replace(/-/g, '_');
    if (value) return value;
    const query = normalizeLower(queryText);
    if (/(implementation|onboarding|deploiement|déploiement|post-signature|mise en oeuvre|mise en œuvre|prerequis|prérequis)/.test(query)) return 'implementation';
    if (/(competitor|concurrent direct|concurrents directs|alternatives?|compar|vs|versus)/.test(query)) return 'competitor';
    if (/(prix|tarif|pricing|cout|cost)/.test(query)) return 'pricing';
    if (/(comment choisir|guide|buyer|achat|crit[èe]res?|preuves?)/.test(query)) return 'buyer_guidance';
    if (/(marque|nom officiel|site officiel|cas d usage|cas d’usage)/.test(query)) return 'brand';
    return 'discovery';
}

export function normalizePromptMode(rawValue = '') {
    return String(rawValue || '').trim().toLowerCase() === 'operator_probe' ? 'operator_probe' : 'user_like';
}

function evaluateByIntentFamily({ text, intentFamily, brandName }) {
    const lowered = normalizeLower(text);
    const reasons = [];

    const hasBrand = brandName ? lowered.includes(normalizeLower(brandName)) : false;
    const hasComparison = /(compar|vs|versus|alternative|alternatives|diff[ée]renc|shortlist|options?|meilleures?|meilleur|lequel|laquelle|entre)/.test(lowered);
    const hasPricingSignals = /(prix|tarif|frais|inclus|delais|d[ée]lais|conditions?|co[uû]t|combien|budget|cher|abordable)/.test(lowered);
    const hasImplementationSignals = /(pr[ée]requis|[ée]tapes?|indicateurs?|kpi|d[ée]lais|mise en (?:oeuvre|œuvre)|onboarding|post-signature|processus|comment (?:ça |ca )?(?:se passe|fonctionne|marche|proc[ée]d))/.test(lowered);

    if (intentFamily === 'brand') {
        if (!hasBrand) reasons.push('La famille brand doit mentionner la marque cliente.');
        if (!hasQuestionSignal(text)) reasons.push('La famille brand doit poser une vraie question métier.');
    } else if (intentFamily === 'competitor' || intentFamily === 'competitor_comparison' || intentFamily === 'alternatives') {
        if (!hasComparison) reasons.push('La famille competitor doit demander comparaison, shortlist ou alternatives.');
    } else if (intentFamily === 'pricing') {
        if (!hasPricingSignals) reasons.push('La famille pricing doit couvrir prix/coûts/tarifs/budget.');
    } else if (intentFamily === 'implementation' || intentFamily === 'use_case') {
        if (!hasImplementationSignals) reasons.push('La famille implementation doit couvrir prérequis, étapes, délais ou processus.');
    }

    return reasons;
}

export function evaluateOnboardingPromptContract({
    queryText,
    intentFamily,
    promptMode,
    clientName = '',
}) {
    const text = normalizeText(queryText);
    const reasons = [];
    const words = wordCount(text);
    const separators = countIntentSeparators(text);

    if (!text) reasons.push('Prompt vide.');
    if (words < 6) reasons.push('Prompt trop court.');
    if (words > 28) reasons.push('Prompt trop long.');
    if (separators >= 4) reasons.push('Prompt trop combiné (multi-angles).');
    if (hasInternalOfferLabel(text)) reasons.push('Prompt non naturel (label interne ou terme technique interdit).');

    if (promptMode === 'user_like' && /^(liste|donne|fais|compare|classe|n[ée]num[èe]re)\b/i.test(text)) {
        reasons.push('Le mode user_like doit rester naturel (éviter une commande opérateur brute).');
    }

    if (promptMode === 'operator_probe' && !/(donne|liste|compare|classe|[ée]value|justifie|explique)/i.test(text)) {
        reasons.push('Le mode operator_probe doit expliciter une consigne vérifiable.');
    }

    const familyReasons = evaluateByIntentFamily({
        text,
        intentFamily: normalizeOnboardingIntentFamily(intentFamily, text),
        brandName: clientName,
    });
    reasons.push(...familyReasons);

    const uniqueReasons = uniqueList(reasons);
    let status = 'strong';
    if (uniqueReasons.length > 0) status = 'review';
    if (
        uniqueReasons.some((reason) => /vide|trop court|trop long|interdit|non naturel|multi-angles/.test(normalizeLower(reason)))
        || uniqueReasons.length >= 3
    ) {
        status = 'weak';
    }

    return {
        status,
        is_valid: status !== 'weak',
        is_selected_default: status === 'strong',
        reasons: uniqueReasons,
    };
}

function inferFunnelStage(intentFamily, queryText = '') {
    const query = normalizeLower(queryText);
    if (intentFamily === 'discovery' || intentFamily === 'local_recommendation') return 'awareness';
    if (intentFamily === 'alternatives' || intentFamily === 'competitor_comparison' || intentFamily === 'competitor') return 'consideration';
    if (intentFamily === 'pricing' || /(prix|tarif|devis|quote|cost)/.test(query)) return 'decision';
    if (intentFamily === 'buyer_guidance') return 'consideration';
    if (intentFamily === 'implementation') return 'post_decision';
    return 'consideration';
}

function inferComparisonScope(intentFamily, queryText = '') {
    if (intentFamily === 'competitor' || intentFamily === 'competitor_comparison' || intentFamily === 'alternatives') return 'explicit';
    if (/(vs|versus|alternatives?|compare|compar)/.test(normalizeLower(queryText))) return 'explicit';
    return 'none';
}

function inferBrandScope(queryText = '', clientName = '') {
    const query = normalizeLower(queryText);
    const brand = normalizeLower(clientName);
    if (brand && query.includes(brand)) return 'brand_explicit';
    if (/(marque|nom officiel|site officiel)/.test(query)) return 'brand_explicit';
    return 'market_generic';
}

function inferGeoScope(queryText = '', city = '', region = '') {
    const query = normalizeLower(queryText);
    if (city && query.includes(normalizeLower(city))) return 'city';
    if (region && query.includes(normalizeLower(region))) return 'region';
    if (/(pres de moi|near me|proche|quartier|ville)/.test(query)) return 'local';
    return 'market';
}

function inferQueryTypeMeta(intentFamily, queryText = '') {
    const query = normalizeLower(queryText);
    if (/(quel|quelle|quels|which|what|comment|pourquoi)/.test(query)) return 'question';
    if (/(meilleur|best|top|top 10)/.test(query)) return 'ranking';
    if (intentFamily === 'pricing') return 'transactional';
    if (intentFamily === 'buyer_guidance') return 'guidance';
    if (intentFamily === 'implementation') return 'implementation';
    return 'informational';
}

function computeQualityScore(status, reasons = []) {
    const penalties = Math.min(20, Math.max(0, reasons.length * 4));
    if (status === 'strong') return Math.max(75, 92 - penalties);
    if (status === 'review') return Math.max(50, 68 - penalties);
    return Math.max(10, 42 - penalties);
}

export function buildCanonicalPromptContract({
    queryText,
    clientName = '',
    city = '',
    region = '',
    locale = 'fr-CA',
    promptOrigin = 'manual_operator',
    intentFamily = null,
    promptMode = 'user_like',
    offerAnchor = null,
    userVisibleOffering = null,
    targetAudience = null,
    primaryUseCase = null,
    differentiationAngle = null,
}) {
    const resolvedIntentFamily = normalizeOnboardingIntentFamily(intentFamily, queryText);
    const resolvedPromptMode = normalizePromptMode(promptMode);
    const validation = evaluateOnboardingPromptContract({
        queryText,
        intentFamily: resolvedIntentFamily,
        promptMode: resolvedPromptMode,
        clientName,
    });

    const qualityScore = computeQualityScore(validation.status, validation.reasons);

    return {
        query_text: normalizeText(queryText),
        intent_family: resolvedIntentFamily,
        prompt_mode: resolvedPromptMode,
        quality_status: validation.status,
        quality_score: qualityScore,
        quality_reasons: validation.reasons,
        validation_status: validation.status,
        validation_reasons: validation.reasons,
        prompt_origin: promptOrigin || 'manual_operator',
        query_type_v2: inferQueryTypeMeta(resolvedIntentFamily, queryText),
        funnel_stage: inferFunnelStage(resolvedIntentFamily, queryText),
        geo_scope: inferGeoScope(queryText, city, region),
        brand_scope: inferBrandScope(queryText, clientName),
        comparison_scope: inferComparisonScope(resolvedIntentFamily, queryText),
        locale: locale || 'fr-CA',
        offer_anchor: normalizeText(offerAnchor) || null,
        user_visible_offering: normalizeText(userVisibleOffering) || null,
        target_audience: normalizeText(targetAudience) || null,
        primary_use_case: normalizeText(primaryUseCase) || null,
        differentiation_angle: normalizeText(differentiationAngle) || null,
        is_valid: validation.is_valid,
        is_selected_default: validation.is_selected_default,
        activation_blocked: validation.status === 'weak',
    };
}
