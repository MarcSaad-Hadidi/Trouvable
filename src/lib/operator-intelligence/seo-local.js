import 'server-only';

import { filterLocalRelevant } from './seo-categories';

// ──────────────────────────────────────────────────────────────
// SEO Local slice — local readiness from audit geo_score
// Shows SEO-relevant local indicators without contradicting GEO framing.
// ──────────────────────────────────────────────────────────────

/**
 * SEO Local data drawn from audit geo_score + geo_breakdown.
 *
 * This view shows local SEO readiness indicators (NAP, schema, local signals)
 * from an SEO perspective. GEO workspace has its own geo_score framing.
 *
 * Provenance: data from latest client_site_audits row,
 * specifically geo_score and geo_breakdown columns.
 */
export async function getSeoLocalSlice(clientId, { audit } = {}) {
    if (!audit || audit.scan_status === 'failed') {
        return {
            available: false,
            emptyState: {
                title: 'Données de préparation locale non disponibles',
                description: 'Aucun audit n\'a encore été réalisé pour ce client. Lancez un audit depuis le dossier pour voir les indicateurs locaux.',
            },
        };
    }

    const geoBreakdown = audit.geo_breakdown || {};
    const issues = Array.isArray(audit.issues) ? audit.issues : [];

    const localIssues = filterLocalRelevant(issues);

    const siteClassification = geoBreakdown.site_classification || audit.seo_breakdown?.site_classification || null;

    // AI analysis from geo_breakdown (if LLM was used)
    const aiAnalysis = geoBreakdown.ai_analysis || null;

    return {
        available: true,
        localScore: audit.geo_score ?? null,
        localScoreLabel: 'Aptitude locale',
        localScoreProvenance: 'Dimension local_readiness : évalue la préparation du site pour la visibilité locale et IA.',
        siteClassification,
        aiRecommendability: aiAnalysis?.geo_recommendability || null,
        aiRecommendabilityRationale: aiAnalysis?.geo_recommendability_rationale || null,
        answerabilitySummary: aiAnalysis?.answerability_summary || null,
        businessSummary: aiAnalysis?.business_summary || null,
        localIssues: localIssues.slice(0, 20),
        localIssueCount: localIssues.length,
        totalIssueCount: issues.length,
        auditDate: audit.created_at || null,
    };
}
