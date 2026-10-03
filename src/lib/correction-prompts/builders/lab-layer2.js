import 'server-only';

import { buildSeoHealthCorrectionPromptContext } from '../seo-health-context';

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

const MODULE_TO_DIMENSION = {
    llms_txt_deep: 'ai_answerability',
    ai_discovery_endpoints: 'ai_answerability',
    brand_entity: 'identity_completeness',
    trust_stack: 'trust_signals',
    negative_signals: 'trust_signals',
};

const MODULE_LABELS = {
    llms_txt_deep: 'llms.txt — qualité du fichier IA',
    ai_discovery_endpoints: 'Découverte IA',
    brand_entity: 'Marque et entité',
    trust_stack: 'Signaux de confiance',
    negative_signals: 'Signaux négatifs',
};

function severityToPriority(severity) {
    const normalized = String(severity || '').toLowerCase();
    if (normalized === 'critical' || normalized === 'high') return 'critical';
    if (normalized === 'medium' || normalized === 'warn' || normalized === 'warning') return 'high';
    if (normalized === 'low') return 'medium';
    return 'medium';
}

/**
 * Un finding L2 est identifié par `moduleKey:findingId` dans l'URL.
 * On cherche ensuite dans audit.extracted_data.layered_v1.subsystem_scores.layer2_*
 * la structure du module + la liste `findings`.
 */
function findLayer2Finding(audit, findingRef) {
    if (!findingRef) return null;
    const [moduleKey, rawFindingId] = String(findingRef).split(':');
    if (!moduleKey || !rawFindingId) return null;

    const canonical = audit?.extracted_data?.layered_v1 || null;
    const subsystem = canonical?.subsystem_scores || {};
    // Les modules L2 peuvent être exposés sous plusieurs clés suivant les versions.
    const moduleData = subsystem[`layer2_${moduleKey}`] || subsystem[moduleKey] || null;
    if (!moduleData) return null;

    const findings = toArray(moduleData?.findings);
    const finding = findings.find((entry) => compactString(entry?.id) === rawFindingId)
        || findings.find((entry) => compactString(entry?.check_id) === rawFindingId)
        || null;

    return finding ? { moduleKey, finding, moduleData } : null;
}

/**
 * Construit le contexte de correction pour un finding Layer 2.
 * On crée une pseudo-issue orientée « lisibilité IA / confiance / entité »
 * et on réutilise `buildSeoHealthCorrectionPromptContext`.
 */
export function buildLayer2CorrectionPromptContext({ client, audit, ref }) {
    const hit = findLayer2Finding(audit, ref.findingId);

    if (!hit) {
        throw new Error('Finding Layer 2 introuvable dans le dernier audit.');
    }

    const { moduleKey, finding, moduleData } = hit;
    const moduleLabel = MODULE_LABELS[moduleKey] || moduleKey;
    const dimension = MODULE_TO_DIMENSION[moduleKey] || 'ai_answerability';
    const severity = compactString(finding?.severity);
    const priority = severityToPriority(severity);
    const findingMessage = compactString(finding?.message)
        || compactString(finding?.title)
        || compactString(finding?.label)
        || `Point ${finding?.id || 'non renseigné'} détecté sur ${moduleLabel}.`;
    const recommendedFix = compactString(finding?.recommendation)
        || compactString(finding?.fix)
        || 'Corriger le point technique concerné en s\'appuyant sur le diagnostic Layer 2 exposé.';

    const pseudoIssue = {
        id: `l2:${moduleKey}:${finding?.id || 'finding'}`,
        title: `Layer 2 · ${moduleLabel} — ${finding?.id || 'finding'}`,
        description: findingMessage,
        priority,
        category: moduleKey,
        dimension,
        truth_class: 'observed',
        confidence: 'high',
        evidence: findingMessage,
        recommendedFix,
        sourceUrl: compactString(ref.pageUrl)
            || compactString(finding?.url)
            || compactString(moduleData?.url)
            || compactString(audit?.resolved_url)
            || compactString(audit?.source_url),
        affectedScope: 'sitewide',
    };

    return buildSeoHealthCorrectionPromptContext({
        client,
        audit,
        issue: pseudoIssue,
    });
}
