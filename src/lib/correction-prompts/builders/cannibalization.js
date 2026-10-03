import 'server-only';

import { buildSeoHealthCorrectionPromptContext } from '../seo-health-context';

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * Lookup un groupe de cannibalisation dans l'audit.
 * Les groupes vivent habituellement sous :
 *   - extracted_data.layered_v1.cannibalization.groups
 *   - extracted_data.cannibalization.groups (legacy)
 *   - audit.cannibalization_groups (rare)
 */
function findCannibalizationGroup(audit, groupId) {
    const normalizedId = compactString(groupId);
    if (!normalizedId) return null;

    const candidates = [
        audit?.extracted_data?.layered_v1?.cannibalization?.groups,
        audit?.extracted_data?.cannibalization?.groups,
        audit?.cannibalization?.groups,
        audit?.cannibalization_groups,
    ];

    for (const candidate of candidates) {
        const list = toArray(candidate);
        if (list.length === 0) continue;
        const match = list.find((group) => compactString(group?.id) === normalizedId)
            || list.find((group) => compactString(group?.group_id) === normalizedId);
        if (match) return match;
    }

    return null;
}

function formatPagesSummary(group) {
    const pages = toArray(group?.pages);
    if (pages.length === 0) return 'Aucune page rattachée explicitement au groupe.';
    return pages
        .slice(0, 6)
        .map((page, index) => {
            const url = compactString(page?.url) || compactString(page?.page_url);
            const label = compactString(page?.label) || compactString(page?.title) || `Page ${index + 1}`;
            const role = compactString(page?.role);
            const position = Number(page?.position);
            const parts = [label];
            if (role) parts.push(`rôle: ${role}`);
            if (Number.isFinite(position)) parts.push(`position moyenne: ${position.toFixed(1)}`);
            if (url) parts.push(`url: ${url}`);
            return `• ${parts.join(' | ')}`;
        })
        .join('\n');
}

export function buildCannibalizationCorrectionPromptContext({ client, audit, ref }) {
    const group = findCannibalizationGroup(audit, ref.groupId);

    if (!group) {
        throw new Error('Groupe de cannibalisation introuvable dans le dernier audit.');
    }

    const pages = toArray(group.pages);
    const primaryPage = pages.find((page) => compactString(page?.role)?.toLowerCase() === 'winner')
        || pages[0]
        || null;
    const title = compactString(group.title) || compactString(group.label) || 'Groupe de cannibalisation';
    const action = compactString(group.action_label) || compactString(group.recommended_action) || null;
    const rationale = compactString(group.summary) || compactString(group.why) || null;

    const evidence = [
        rationale ? `Analyse: ${rationale}` : null,
        formatPagesSummary(group),
        action ? `Action recommandée UI: ${action}` : null,
    ]
        .filter(Boolean)
        .join('\n\n');

    const pseudoIssue = {
        id: `cannib:${compactString(ref.groupId)}`,
        title: `Cannibalisation — ${title}`,
        description: rationale
            || 'Plusieurs pages se positionnent sur un même intent et se cannibalisent.',
        priority: 'high',
        category: 'cannibalization',
        dimension: 'technical_seo',
        truth_class: 'observed',
        confidence: compactString(group.confidenceLabel) === 'Confiance élevée' ? 'high' : 'medium',
        evidence,
        recommendedFix: action
            ? `Appliquer la décision opérateur: ${action}. Décrire ensuite l'implémentation (redirection 301 / consolidation / repositionnement / différenciation) sans modifier l'intent des pages gardées.`
            : 'Décider fusion, repositionnement ou différenciation. Justifier la décision sur l’intent de recherche et les signaux observés avant toute réécriture.',
        sourceUrl: compactString(primaryPage?.url)
            || compactString(primaryPage?.page_url)
            || compactString(audit?.resolved_url)
            || compactString(audit?.source_url),
        affectedScope: pages.length > 1 ? 'multi_page' : 'single_page',
    };

    return buildSeoHealthCorrectionPromptContext({
        client,
        audit,
        issue: pseudoIssue,
    });
}
