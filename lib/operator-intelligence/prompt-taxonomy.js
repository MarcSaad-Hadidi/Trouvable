import 'server-only';

/**
 * Discovery mode determines whether the generation prompt is target-aware or target-blind.
 *
 * - brand_aware: company context IS injected into the generation prompt.
 *   Used for brand queries, comparisons, objections, pricing — questions that
 *   explicitly target the company.
 *
 * - blind_discovery: company context is NOT injected into the generation prompt.
 *   The prompt is sent as a pure market question. Target evaluation still happens
 *   afterward in the extraction/analysis layer. This mode measures spontaneous
 *   mention / true visibility.
 */
export const DISCOVERY_MODE_META = {
    blind_discovery: {
        key: 'blind_discovery',
        label: 'Decouverte spontanee',
        description: 'Aucun contexte entreprise dans le prompt de generation. Mesure la visibilite spontanee reelle.',
        visibility_eligible: true,
        bias_risk: 'no_context',
        evidence_level: 'none',
        answer_type: 'discovery',
    },
    neutral_brand_check: {
        key: 'neutral_brand_check',
        label: 'Verification marque neutre',
        description: 'Seuls le nom de marque et la zone minimale sont fournis. Aucun pitch business.',
        visibility_eligible: false,
        bias_risk: 'brand_name_only',
        evidence_level: 'none',
        answer_type: 'evaluation',
    },
    skeptical_brand_evaluation: {
        key: 'skeptical_brand_evaluation',
        label: 'Evaluation sceptique',
        description: 'Question dure sur une marque, sans pitch business et avec posture prudente.',
        visibility_eligible: false,
        bias_risk: 'brand_name_only',
        evidence_level: 'none',
        answer_type: 'evaluation',
    },
    competitor_discovery: {
        key: 'competitor_discovery',
        label: 'Decouverte concurrents',
        description: 'Recherche naturelle des alternatives sans forcer la marque cible.',
        visibility_eligible: false,
        bias_risk: 'no_context',
        evidence_level: 'none',
        answer_type: 'comparison',
    },
    source_grounded_evaluation: {
        key: 'source_grounded_evaluation',
        label: 'Evaluation sourcee',
        description: 'Evaluation limitee aux sources fournies par le systeme.',
        visibility_eligible: false,
        bias_risk: 'source_grounded',
        evidence_level: 'source_provided',
        answer_type: 'source_grounded',
    },
    controlled_context_answer: {
        key: 'controlled_context_answer',
        label: 'Contexte controle',
        description: 'Le contexte business est volontairement injecte; utile pour QA/copy, pas pour visibilite naturelle.',
        visibility_eligible: false,
        bias_risk: 'context_injected',
        evidence_level: 'weak',
        answer_type: 'evaluation',
    },
    operator_extraction: {
        key: 'operator_extraction',
        label: 'Extraction operateur',
        description: 'Analyse structuree d une reponse deja produite; ne genere pas de reponse utilisateur.',
        visibility_eligible: false,
        bias_risk: 'no_context',
        evidence_level: 'none',
        answer_type: 'extraction',
    },
    brand_aware: {
        key: 'brand_aware',
        label: 'Marque explicite (legacy)',
        description: 'Mode historique avec contexte entreprise injecte. Conserve pour compatibilite; preferer controlled_context_answer.',
        visibility_eligible: false,
        bias_risk: 'context_injected',
        evidence_level: 'weak',
        answer_type: 'evaluation',
    },
};

const VALID_DISCOVERY_MODES = new Set(Object.keys(DISCOVERY_MODE_META));

/**
 * Normalize a discovery_mode value. Falls back to 'brand_aware' for backward compatibility
 * (all existing prompts/runs are effectively brand_aware).
 */
export function normalizeDiscoveryMode(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if (VALID_DISCOVERY_MODES.has(raw)) return raw;
    return 'brand_aware';
}

/**
 * Whether a given discovery mode qualifies for spontaneous visibility measurement.
 * Only blind_discovery runs should count toward real visibility KPIs.
 */
export function isVisibilityEligible(discoveryMode) {
    return discoveryMode === 'blind_discovery';
}

function includesClientName(queryText = '', clientName = '') {
    const queryLower = String(queryText || '').toLowerCase();
    const nameLower = String(clientName || '').toLowerCase().trim();
    return Boolean(nameLower && nameLower.length >= 2 && queryLower.includes(nameLower));
}

function hasSkepticalBrandIntent(queryText = '') {
    return /(vent|bullshit|arnaque|scam|credible|credibil|cr[eé]dible|fiable|efficace|preuves?|vaut|worth|legitime|l[eé]gitime|promesse|garantie|avis|review)/i
        .test(String(queryText || ''));
}

/**
 * Infer the correct discovery_mode from prompt metadata.
 *
 * Resolution order:
 * 1. Explicit category or intent that inherently implies brand context
 * 2. Query text containing the client name → brand_aware
 * 3. Generic discovery / local / service categories without brand → blind_discovery
 * 4. Safe default: brand_aware (conservative — won't inflate spontaneous metrics)
 */
function inferDiscoveryModeLegacy({ category, intentFamily, queryText = '', clientName = '' }) {
    // Explicit brand or competitor categories are always brand_aware
    if (category === 'brand' || category === 'competitor_comparison') return 'brand_aware';
    if (intentFamily === 'brand' || intentFamily === 'competitor' || intentFamily === 'competitor_comparison') return 'brand_aware';

    // Brand-adjacent intent families that involve the company context
    if (intentFamily === 'buyer_guidance' || intentFamily === 'pricing' || intentFamily === 'implementation') return 'brand_aware';

    // If the query text explicitly contains the client name, it's brand_aware
    if (clientName) {
        const queryLower = String(queryText || '').toLowerCase();
        const nameLower = String(clientName).toLowerCase().trim();
        if (nameLower && nameLower.length >= 2 && queryLower.includes(nameLower)) return 'brand_aware';
    }

    // Discovery, local_intent, service_intent without brand reference → blind_discovery
    if (category === 'discovery' || category === 'local_intent' || category === 'service_intent') {
        return 'blind_discovery';
    }

    // Conservative default: brand_aware (will not falsely inflate spontaneous metrics)
    return 'brand_aware';
}

export function inferDiscoveryMode({ category, intentFamily, queryText = '', clientName = '' }) {
    const hasBrand = includesClientName(queryText, clientName);
    if (hasBrand) {
        return hasSkepticalBrandIntent(queryText) ? 'skeptical_brand_evaluation' : 'neutral_brand_check';
    }

    if (category === 'brand' || intentFamily === 'brand') {
        return hasSkepticalBrandIntent(queryText) ? 'skeptical_brand_evaluation' : 'neutral_brand_check';
    }

    if (category === 'competitor_comparison' || intentFamily === 'competitor' || intentFamily === 'competitor_comparison') {
        return 'competitor_discovery';
    }

    if (category === 'discovery' || category === 'local_intent' || category === 'service_intent') {
        return 'blind_discovery';
    }

    return inferDiscoveryModeLegacy({ category, intentFamily, queryText, clientName });
}

export function getDiscoveryModeMeta(mode) {
    return DISCOVERY_MODE_META[normalizeDiscoveryMode(mode)] || DISCOVERY_MODE_META.brand_aware;
}

export function getDiscoveryModeOptions() {
    return Object.values(DISCOVERY_MODE_META);
}

/**
 * Measurement outcome classification for a single run.
 * Encodes what the run actually produced from a visibility measurement perspective.
 */
export const MEASUREMENT_OUTCOMES = {
    /** Target was spontaneously mentioned in a blind discovery run — strongest visibility signal. */
    spontaneous_mention: {
        key: 'spontaneous_mention',
        label: 'Mention spontanee',
        description: 'La cible a ete mentionnee sans injection de contexte.',
        counts_as_visibility: true,
    },
    /** Target was mentioned in a brand-aware run — expected, not a spontaneous signal. */
    assisted_mention: {
        key: 'assisted_mention',
        label: 'Mention assistee',
        description: 'La cible a ete mentionnee avec contexte injecte (pas une mesure de visibilite spontanee).',
        counts_as_visibility: false,
    },
    /** Target was NOT mentioned — competitors dominated the response. */
    competitor_dominated: {
        key: 'competitor_dominated',
        label: 'Dominance concurrentielle',
        description: 'La cible n\'a pas ete mentionnee. Les concurrents dominent la reponse.',
        counts_as_visibility: false,
    },
    /** Target was NOT mentioned — no strong answer from the model. */
    not_mentioned: {
        key: 'not_mentioned',
        label: 'Non mentionnee',
        description: 'La cible n\'a pas ete mentionnee dans la reponse.',
        counts_as_visibility: false,
    },
    /** The response was too weak / empty / unparseable to count as a measurement. */
    low_quality: {
        key: 'low_quality',
        label: 'Signal insuffisant',
        description: 'La reponse est trop faible ou non exploitable pour constituer une mesure valide.',
        counts_as_visibility: false,
    },
};

/**
 * Whether a given measurement outcome counts as real (spontaneous) visibility.
 * Uses MEASUREMENT_OUTCOMES as source of truth — no hardcoded string checks needed.
 *
 * @param {string|null|undefined} outcome - One of MEASUREMENT_OUTCOMES keys
 * @returns {boolean}
 */
export function countsAsVisibilityOutcome(outcome) {
    return MEASUREMENT_OUTCOMES[outcome]?.counts_as_visibility === true;
}

/**
 * Classify the measurement outcome of a completed run.
 *
 * @param {object} params
 * @param {string} params.discoveryMode - 'blind_discovery' or 'brand_aware'
 * @param {boolean} params.targetFound - whether the target business was found in the response
 * @param {string} params.runSignalTier - 'useful' | 'low_yield' | 'empty_signal'
 * @param {number} params.competitorCount - number of competitors found
 * @param {number} params.totalMentioned - total businesses mentioned
 * @returns {string} One of MEASUREMENT_OUTCOMES keys
 */
export function classifyMeasurementOutcome({ discoveryMode, targetFound, runSignalTier, competitorCount = 0, totalMentioned = 0 }) {
    // If the run produced junk, it's not a valid measurement
    if (runSignalTier === 'empty_signal') return 'low_quality';

    if (targetFound) {
        return discoveryMode === 'blind_discovery' ? 'spontaneous_mention' : 'assisted_mention';
    }

    // Target not found
    if (competitorCount > 0 || totalMentioned > 1) {
        return 'competitor_dominated';
    }

    return 'not_mentioned';
}

export const TRACKED_QUERY_CATEGORY_META = {
    local_intent: {
        key: 'local_intent',
        label: 'Recommandation locale',
        description: 'Prompts avec ville/quartier ou intention locale explicite.',
    },
    service_intent: {
        key: 'service_intent',
        label: 'Intention service',
        description: 'Prompts axes sur un service, une categorie ou un cas d usage.',
    },
    brand: {
        key: 'brand',
        label: 'Marque',
        description: 'Prompts qui ciblent explicitement la marque cliente.',
    },
    competitor_comparison: {
        key: 'competitor_comparison',
        label: 'Comparaison concurrentielle',
        description: 'Prompts de comparaison, alternatives ou concurrence directe.',
    },
    discovery: {
        key: 'discovery',
        label: 'Decouverte',
        description: 'Prompts de decouverte plus larges pour couvrir la visibilite du marche.',
    },
};

const CATEGORY_KEYS = new Set(Object.keys(TRACKED_QUERY_CATEGORY_META));

function normalizeRaw(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
}

function inferFromQueryText(queryText = '') {
    const text = String(queryText || '').trim().toLowerCase();

    if (!text) return 'discovery';
    if (/(versus|vs\.?|alternatives?|compare|compar|competit)/.test(text)) return 'competitor_comparison';
    if (/(pres de|proche de|a |à |dans |montreal|montreal|quebec|quebec city|laval|longueuil|brossard|quartier|rive-sud|rive sud|ville)/.test(text)) {
        return 'local_intent';
    }
    if (/(nom officiel|marque|avis sur|review of|site officiel|telephone|numero de|contact)/.test(text)) return 'brand';
    if (/(plombier|dentiste|restaurant|notaire|courtier|clinique|service|specialiste|meilleur|best )/.test(text)) {
        return 'service_intent';
    }
    return 'discovery';
}

export function normalizeTrackedQueryCategory(value, queryText = '') {
    const raw = normalizeRaw(value);
    if (CATEGORY_KEYS.has(raw)) return raw;
    if (/(competit|compar|versus|vs)/.test(raw)) return 'competitor_comparison';
    if (/(brand|marque)/.test(raw)) return 'brand';
    if (/(local|ville|region|quartier|geo_local)/.test(raw)) return 'local_intent';
    if (/(service|category|categorie|seo|geo|visibility)/.test(raw)) return 'service_intent';
    if (/(discovery|general|research|exploration)/.test(raw)) return 'discovery';
    return inferFromQueryText(queryText);
}

export function prepareTrackedQueryWrite(input, existing = {}) {
    const queryText = input.query_text ?? existing.query_text ?? '';
    const locale = input.locale ?? existing.locale ?? 'fr-CA';
    const category = normalizeTrackedQueryCategory(input.category ?? input.query_type ?? existing.category ?? existing.query_type, queryText);

    return {
        ...input,
        locale,
        category,
        query_type: category,
    };
}

export function getTrackedQueryCategoryMeta(value, queryText = '') {
    return TRACKED_QUERY_CATEGORY_META[normalizeTrackedQueryCategory(value, queryText)] || TRACKED_QUERY_CATEGORY_META.discovery;
}

export function getTrackedQueryCategoryOptions() {
    return Object.values(TRACKED_QUERY_CATEGORY_META);
}
