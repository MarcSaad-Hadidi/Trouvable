import 'server-only';

import { buildSeoHealthCorrectionPromptContext } from '../seo-health-context';

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function categoryToDimension(category) {
    const normalized = String(category || '').toLowerCase();
    if (normalized === 'technical') return 'technical_seo';
    if (normalized === 'content') return 'technical_seo';
    if (normalized === 'geo') return 'local_readiness';
    if (normalized === 'ai_readiness') return 'ai_answerability';
    if (normalized === 'trust') return 'trust_signals';
    return 'technical_seo';
}

function statusToPriority(status, weight) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'fail') {
        return (weight && weight >= 2) ? 'critical' : 'high';
    }
    if (normalized === 'warn') {
        return (weight && weight >= 2) ? 'high' : 'medium';
    }
    return 'low';
}

function findLayer1Check(audit, { checkId, pageUrl }) {
    const canonical = audit?.extracted_data?.layered_v1 || null;
    const scanner = audit?.extracted_data?.layered_v1_layer1 || null;

    const pages = canonical?.page_level_checks?.length
        ? canonical.page_level_checks
        : toArray(scanner?.page_level_checks);

    const normalizedTargetUrl = compactString(pageUrl);

    // Scope by URL first if provided, otherwise search all pages.
    const candidatePages = normalizedTargetUrl
        ? pages.filter((entry) => compactString(entry?.page_url) === normalizedTargetUrl)
        : pages;

    for (const page of candidatePages) {
        for (const check of toArray(page?.checks)) {
            if (compactString(check?.check_id) === checkId) {
                return { page, check };
            }
        }
    }

    // Fallback: search all pages ignoring the URL filter.
    if (normalizedTargetUrl) {
        for (const page of pages) {
            for (const check of toArray(page?.checks)) {
                if (compactString(check?.check_id) === checkId) {
                    return { page, check };
                }
            }
        }
    }

    return null;
}

/**
 * Extrait un check Layer 1 depuis l'audit et le transforme en pseudo-issue
 * compatible avec `buildSeoHealthCorrectionPromptContext`, afin de réutiliser
 * la logique d'inspection repo, targets et validation déjà bien rodée.
 */
export function buildLayer1CorrectionPromptContext({ client, audit, ref }) {
    const hit = findLayer1Check(audit, {
        checkId: ref.checkId,
        pageUrl: ref.pageUrl,
    });

    if (!hit) {
        throw new Error('Check Layer 1 introuvable dans le dernier audit.');
    }

    const { page, check } = hit;
    const pageUrl = compactString(page?.page_url) || compactString(ref.pageUrl) || null;
    const category = compactString(check?.category) || 'technical';
    const status = compactString(check?.status) || 'fail';
    const weight = Number.isFinite(check?.weight) ? check.weight : 1;
    const evidence = compactString(check?.evidence)
        || `Check ${check?.check_id} a renvoyé le statut ${status} avec un poids ${weight}.`;
    const title = `Layer 1 · ${check?.check_id || 'check'} (${status}) sur ${pageUrl || 'le scan global'}`;
    const dimension = categoryToDimension(category);
    const priority = statusToPriority(status, weight);

    // Shape pseudo-issue aligné avec la normalisation SEO Health.
    const pseudoIssue = {
        id: `l1:${check?.check_id}:${pageUrl || 'site'}`,
        title,
        description: `Vérification Layer 1 ${check?.check_id} (${category}) en statut ${status}.`,
        priority,
        category,
        dimension,
        truth_class: 'observed',
        confidence: 'high',
        evidence,
        recommendedFix: 'Corriger la cause technique à l\'origine du statut fail/warn de ce check Layer 1 après inspection du code concerné.',
        sourceUrl: pageUrl,
        affectedScope: pageUrl ? 'page' : 'sitewide',
    };

    return buildSeoHealthCorrectionPromptContext({
        client,
        audit,
        issue: pseudoIssue,
    });
}
