/**
 * ProblemRef — contrat unifié « problème → prompt correctif ».
 *
 * Utilisé à travers tout le dashboard admin pour décrire un problème détecté
 * n'importe où (SEO Health, Lab L1/L2, opportunités, alertes GEO, readiness,
 * cohérence, cannibalisation, agent fixes…) et le transporter jusqu'à la
 * génération de prompt correctif, sans perdre le contexte.
 *
 * Shape canonique :
 *
 * {
 *   source: 'seo_health_issue' | 'lab_layer1_check' | 'lab_layer2_finding' |
 *           'seo_opportunity' | 'seo_cannibalization' | 'seo_on_page' |
 *           'geo_opportunity' | 'geo_readiness_blocker' | 'geo_consistency_gap' |
 *           'geo_alert' | 'agent_fix' | 'audit_priority_problem',
 *   clientId: string,
 *   auditId?: string,
 *   issueId?: string,
 *   checkId?: string,        // Layer 1
 *   findingId?: string,      // Layer 2 (format `module:id`)
 *   opportunityId?: string,
 *   pageUrl?: string,
 *   layer?: 'layer1' | 'layer2' | 'layer4' | null,
 *   dimension?: 'technical_seo' | 'local_readiness' | 'ai_answerability'
 *             | 'trust_signals' | 'identity_completeness' | null,
 *   taskType: 'correction' | 'rewrite_content' | 'geo_improvement'
 *           | 'seo_improvement' | 'entity_trust' | 'citation_readability'
 *           | 'prompt_ready_content' | 'page_specific',
 *   presetVariant?: 'standard' | 'strict',
 *   autoGenerate?: boolean,
 *   label?: string,          // Libellé court humain (debug / UI)
 * }
 */

export const PROBLEM_SOURCES = Object.freeze([
    'seo_health_issue',
    'lab_layer1_check',
    'lab_layer2_finding',
    'seo_opportunity',
    'seo_cannibalization',
    'seo_on_page',
    'geo_opportunity',
    'geo_readiness_blocker',
    'geo_consistency_gap',
    'geo_alert',
    'agent_fix',
    'audit_priority_problem',
]);

export const TASK_TYPES = Object.freeze([
    'correction',
    'rewrite_content',
    'geo_improvement',
    'seo_improvement',
    'entity_trust',
    'citation_readability',
    'prompt_ready_content',
    'page_specific',
]);

export const TASK_TYPE_LABELS = Object.freeze({
    correction: 'Correction technique',
    rewrite_content: 'Réécriture de contenu',
    geo_improvement: 'Amélioration GEO',
    seo_improvement: 'Amélioration SEO',
    entity_trust: 'Entité & confiance',
    citation_readability: 'Citabilité & lisibilité IA',
    prompt_ready_content: 'Contenu prompt-ready',
    page_specific: 'Correction ciblée page',
});

export const VARIANTS = Object.freeze(['standard', 'strict']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function compactString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'oui';
    }
    if (typeof value === 'number') return value !== 0;
    return false;
}

/**
 * Déduit un taskType raisonnable à partir de la source + dimension/catégorie.
 * Cette heuristique est conservative : en cas de doute, retombe sur `correction`.
 */
export function inferTaskType({ source, dimension, category } = {}) {
    const normalizedDimension = compactString(dimension);
    const normalizedCategory = compactString(category)?.toLowerCase() || '';

    if (source === 'lab_layer1_check' || source === 'lab_layer2_finding') {
        if (normalizedDimension === 'ai_answerability') return 'citation_readability';
        if (normalizedDimension === 'trust_signals' || normalizedDimension === 'identity_completeness') {
            return 'entity_trust';
        }
        if (normalizedCategory === 'content') return 'rewrite_content';
        return 'correction';
    }

    if (source === 'seo_opportunity' || source === 'seo_cannibalization' || source === 'seo_on_page') {
        return 'seo_improvement';
    }

    if (source === 'geo_opportunity' || source === 'geo_readiness_blocker' || source === 'geo_alert') {
        return 'geo_improvement';
    }

    if (source === 'geo_consistency_gap') {
        return 'entity_trust';
    }

    if (source === 'agent_fix') {
        return 'correction';
    }

    if (source === 'audit_priority_problem') {
        if (normalizedDimension === 'ai_answerability') return 'citation_readability';
        if (normalizedDimension === 'trust_signals') return 'entity_trust';
        if (normalizedDimension === 'local_readiness') return 'geo_improvement';
        return 'correction';
    }

    return 'correction';
}

/**
 * Normalise un objet (possiblement incomplet ou en provenance d'URL) en
 * ProblemRef propre, prêt à être passé au backend. Retourne null si
 * la shape minimale requise n'est pas respectée (source + clientId).
 */
export function normalizeProblemRef(input) {
    if (!input || typeof input !== 'object') return null;

    const source = compactString(input.source);
    const clientId = compactString(input.clientId);
    if (!source || !PROBLEM_SOURCES.includes(source)) return null;
    if (!clientId) return null;

    const dimension = compactString(input.dimension);
    const category = compactString(input.category);
    const rawTaskType = compactString(input.taskType);
    const taskType = rawTaskType && TASK_TYPES.includes(rawTaskType)
        ? rawTaskType
        : inferTaskType({ source, dimension, category });

    const presetVariant = compactString(input.presetVariant);

    return {
        source,
        clientId,
        auditId: compactString(input.auditId) || null,
        issueId: compactString(input.issueId) || null,
        checkId: compactString(input.checkId) || null,
        findingId: compactString(input.findingId) || null,
        opportunityId: compactString(input.opportunityId) || null,
        pageUrl: compactString(input.pageUrl) || null,
        layer: compactString(input.layer) || null,
        dimension: dimension || null,
        category: category || null,
        taskType,
        presetVariant: presetVariant && VARIANTS.includes(presetVariant) ? presetVariant : null,
        autoGenerate: toBoolean(input.autoGenerate),
        label: compactString(input.label) || null,
    };
}

/**
 * Construit un ProblemRef depuis URLSearchParams (côté client ou serveur).
 * Accepte les clés principales : source, issueId, checkId, findingId,
 * opportunityId, pageUrl, layer, dimension, category, taskType, variant, auto.
 *
 * Paramètre UI uniquement (ignoré ici) : handoffUi=page — indique une
 * navigation vers la page prompts complète sans rouvrir le drawer (voir
 * buildCorrectionPromptsHref dans IssueHandoffContext).
 */
export function problemRefFromSearchParams(clientId, searchParams) {
    if (!searchParams) return null;
    const get = (key) => {
        try {
            return typeof searchParams.get === 'function' ? searchParams.get(key) : searchParams[key];
        } catch {
            return null;
        }
    };

    const source = compactString(get('source'));
    if (!source) return null;

    return normalizeProblemRef({
        source,
        clientId,
        issueId: get('issueId'),
        checkId: get('checkId'),
        findingId: get('findingId'),
        opportunityId: get('opportunityId'),
        pageUrl: get('pageUrl'),
        layer: get('layer'),
        dimension: get('dimension'),
        category: get('category'),
        taskType: get('taskType'),
        presetVariant: get('variant'),
        autoGenerate: get('auto'),
        label: get('label'),
    });
}

/**
 * Sérialise un ProblemRef en query params URL pour navigation partagée vers
 * la page prompts correctifs.
 */
export function problemRefToQueryString(ref) {
    if (!ref) return '';
    const params = new URLSearchParams();
    const push = (key, value) => {
        if (value === null || value === undefined) return;
        const str = String(value).trim();
        if (!str) return;
        params.set(key, str);
    };

    push('source', ref.source);
    push('issueId', ref.issueId);
    push('checkId', ref.checkId);
    push('findingId', ref.findingId);
    push('opportunityId', ref.opportunityId);
    push('pageUrl', ref.pageUrl);
    push('layer', ref.layer);
    push('dimension', ref.dimension);
    push('category', ref.category);
    push('taskType', ref.taskType);
    if (ref.presetVariant) push('variant', ref.presetVariant);
    if (ref.autoGenerate) push('auto', '1');

    return params.toString();
}

/**
 * Valide uniquement les contraintes nécessaires côté backend avant dispatch
 * vers un builder. Retourne { ok, error } — ne jette pas.
 */
export function validateProblemRef(ref) {
    if (!ref || typeof ref !== 'object') {
        return { ok: false, error: 'ProblemRef manquant ou invalide.' };
    }
    if (!PROBLEM_SOURCES.includes(ref.source)) {
        return { ok: false, error: `ProblemRef.source invalide : ${ref.source}` };
    }
    if (!ref.clientId || !UUID_RE.test(ref.clientId)) {
        return { ok: false, error: 'ProblemRef.clientId invalide.' };
    }
    if (!TASK_TYPES.includes(ref.taskType)) {
        return { ok: false, error: `ProblemRef.taskType invalide : ${ref.taskType}` };
    }

    // Contraintes par source.
    if (ref.source === 'seo_health_issue' && !ref.issueId) {
        return { ok: false, error: 'seo_health_issue nécessite issueId.' };
    }
    if (ref.source === 'lab_layer1_check' && !ref.checkId) {
        return { ok: false, error: 'lab_layer1_check nécessite checkId.' };
    }
    if (ref.source === 'lab_layer2_finding' && !ref.findingId) {
        return { ok: false, error: 'lab_layer2_finding nécessite findingId.' };
    }
    if ((ref.source === 'seo_opportunity' || ref.source === 'geo_opportunity') && !ref.opportunityId) {
        return { ok: false, error: `${ref.source} nécessite opportunityId.` };
    }

    return { ok: true };
}

export default {
    PROBLEM_SOURCES,
    TASK_TYPES,
    TASK_TYPE_LABELS,
    VARIANTS,
    inferTaskType,
    normalizeProblemRef,
    problemRefFromSearchParams,
    problemRefToQueryString,
    validateProblemRef,
};
