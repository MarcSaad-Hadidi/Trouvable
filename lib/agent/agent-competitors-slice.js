import 'server-only';

import { getCompetitorSlice } from '@/lib/operator-intelligence/competitors';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

function buildEmptyState({ runs, competitors }) {
    if (runs === 0) {
        return {
            key: 'no_runs',
            title: 'Aucune exécution pour le moment',
            description: 'Lancez les prompts suivis pour observer les concurrents IA qui s’imposent sur vos requêtes.',
        };
    }
    if (competitors === 0) {
        return {
            key: 'no_competitors',
            title: 'Aucun concurrent confirmé',
            description: 'Aucune mention hors cible n’a atteint le seuil concurrent confirmé. Enrichissez le profil avec des concurrents nommés et utilisez des prompts « vs / shortlist ».',
        };
    }
    return null;
}

/**
 * AGENT competitor gap — read-only wrapper around the operator competitor slice.
 *
 * Reshapes the existing data into a gap-centric payload. Does NOT feed the
 * AGENT score (per spec — competitor pressure is informational only).
 */
export async function getAgentCompetitorsSlice(clientId) {
    const base = await getCompetitorSlice(clientId).catch((error) => {
        console.error(`[agent-competitors-slice] ${clientId}`, error);
        return null;
    });

    if (!base) {
        return {
            provenance: {
                observed: getProvenanceMeta('observed'),
                derived: getProvenanceMeta('derived'),
            },
            available: false,
            summary: null,
            topCompetitors: [],
            promptsLost: [],
            emptyState: {
                key: 'error',
                title: 'Comparatif AGENT indisponible',
                description: 'Impossible de charger les signaux concurrents. Réessayez plus tard.',
            },
            scoreImpact: 'none',
        };
    }

    const runs = base.summary?.totalCompletedRuns || 0;
    const competitorCount = base.topCompetitors?.length || 0;
    const emptyState = buildEmptyState({ runs, competitors: competitorCount });

    const promptsLost = (base.promptsWithCompetitors || [])
        .slice()
        .sort((a, b) => (b.recommended_competitors || 0) - (a.recommended_competitors || 0)
            || (b.competitor_mentions || 0) - (a.competitor_mentions || 0))
        .slice(0, 8)
        .map((prompt) => ({
            id: prompt.id,
            queryText: prompt.query_text,
            category: prompt.category,
            competitorMentions: prompt.competitor_mentions || 0,
            recommendedCompetitors: prompt.recommended_competitors || 0,
            latestRunAt: prompt.latest_run_at || null,
            severity: (prompt.recommended_competitors || 0) > 0 ? 'high' : (prompt.competitor_mentions || 0) > 1 ? 'medium' : 'low',
        }));

    return {
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        available: runs > 0,
        summary: {
            totalCompletedRuns: runs,
            targetMentions: base.summary?.targetMentions || 0,
            competitorMentions: base.summary?.competitorMentions || 0,
            recommendedCompetitors: base.summary?.recommendedCompetitors || 0,
            competitorPressureScore: base.summary?.competitorPressureScore || 0,
            normalizedPressurePerRun: base.summary?.normalizedPressurePerRun || 0,
            runsWithoutTargetButCompetitor: base.summary?.runsWithoutTargetButCompetitor || 0,
            sampleSizeWarning: base.summary?.sampleSizeWarning || null,
        },
        topCompetitors: (base.topCompetitors || []).slice(0, 8),
        genericMentions: (base.genericMentions || []).slice(0, 6),
        promptsLost,
        links: {
            prompts: `/admin/clients/${clientId}/geo/prompts`,
            runs: `/admin/clients/${clientId}/geo/runs`,
            // Map "competitors" intent to the Banc d'essai (GEO compare),
            // which is the canonical competitor-analysis surface. The
            // bare /geo/competitors path is not a real page.
            competitors: `/admin/clients/${clientId}/geo/compare`,
        },
        scoreImpact: 'none',
        emptyState,
    };
}

