import 'server-only';

import { listRemediationSuggestionsForClient } from '@/lib/db/remediation';
import { filterSeoRelevant } from './seo-categories';
import { getLatestAudit } from '@/lib/db/audits';
import { getSourceStatus, loadIndependentSources } from './source-availability';

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
export async function getSeoActionsSlice(clientId, { audit: providedAudit } = {}) {
    const { values, dataSources, errors } = await loadIndependentSources({
        audit: () => (providedAudit === undefined ? getLatestAudit(clientId) : providedAudit),
        remediation: () => listRemediationSuggestionsForClient(clientId),
    });
    const audit = values.audit;
    const suggestions = (values.remediation || []).filter((item) => SEO_RELEVANT_PROBLEM_TYPES.has(item.problem_type));
    const availability = { status: getSourceStatus(dataSources), dataSources, errors };

    // Extract SEO-relevant audit issues
    const allIssues = Array.isArray(audit?.issues) ? audit.issues : [];
    const auditIssues = filterSeoRelevant(allIssues);

    const hasData = suggestions.length > 0 || auditIssues.length > 0;

    return {
        ...availability,
        available: hasData,
        emptyState: hasData
            ? null
            : {
                  title:
                      errors.length > 0 ? 'Actions SEO temporairement indisponibles' : 'Aucune action SEO identifiée',
                  description:
                      errors.length > 0
                          ? 'Données temporairement indisponibles pour cette lecture SEO.'
                          : "Aucune suggestion de remédiation SEO et aucun problème d'audit détecté. Lancez un audit ou attendez le suivi continu.",
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
            totalSuggestions: dataSources.remediation === 'unavailable' ? null : suggestions.length,
            draftSuggestions:
                dataSources.remediation === 'unavailable'
                    ? null
                    : suggestions.filter((s) => s.status === 'draft').length,
            approvedSuggestions:
                dataSources.remediation === 'unavailable'
                    ? null
                    : suggestions.filter((s) => s.status === 'approved').length,
            totalAuditIssues: Array.isArray(audit?.issues) ? auditIssues.length : null,
        },
    };
}
