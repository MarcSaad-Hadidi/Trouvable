import 'server-only';

import { listRemediationSuggestionsForClient } from '@/lib/db/remediation';
import { filterSeoRelevant } from './seo-categories';

// ──────────────────────────────────────────────────────────────
// SEO Actions slice — actionable backlog from remediation
// suggestions and SEO-relevant audit issues.
// ──────────────────────────────────────────────────────────────

const SEO_RELEVANT_PROBLEM_TYPES = new Set([
    'schema_missing_or_incoherent',
    'visibility_declining',
    'ai_crawlers_blocked',
    'llms_txt_missing',
    'weak_local_clarity',
]);

/**
 * SEO Actions data: remediation suggestions + SEO audit issues.
 *
 * Sources:
 * - remediation_suggestions table (filtered to SEO-relevant types)
 * - audit issues from latest audit (SEO categories)
 */
export async function getSeoActionsSlice(clientId, { audit } = {}) {
    // Fetch remediation suggestions
    let suggestions = [];
    try {
        const allSuggestions = await listRemediationSuggestionsForClient(clientId);
        suggestions = allSuggestions.filter(
            (s) => SEO_RELEVANT_PROBLEM_TYPES.has(s.problem_type)
        );
    } catch {
        // Table may not exist yet or be empty — graceful degradation
    }

    // Extract SEO-relevant audit issues
    const allIssues = Array.isArray(audit?.issues) ? audit.issues : [];
    const auditIssues = filterSeoRelevant(allIssues);

    const hasData = suggestions.length > 0 || auditIssues.length > 0;

    return {
        available: hasData,
        emptyState: hasData ? null : {
            title: 'Aucune action SEO identifiée',
            description: 'Aucune suggestion de remédiation SEO et aucun problème d\'audit détecté. Lancez un audit ou attendez le suivi continu.',
        },
        suggestions: suggestions.map((s) => ({
            id: s.id,
            problemType: s.problem_type,
            problemSource: s.problem_source,
            severity: s.severity,
            status: s.status,
            aiOutput: s.ai_output,
            createdAt: s.created_at,
        })),
        auditIssues: auditIssues.slice(0, 25),
        counts: {
            totalSuggestions: suggestions.length,
            draftSuggestions: suggestions.filter((s) => s.status === 'draft').length,
            approvedSuggestions: suggestions.filter((s) => s.status === 'approved').length,
            totalAuditIssues: auditIssues.length,
        },
    };
}
