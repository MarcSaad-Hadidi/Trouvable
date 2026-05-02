import 'server-only';

import { getOverviewSlice } from '@/lib/operator-intelligence/overview';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

function buildEmptyState({ hasRuns, hasPrompts }) {
    if (hasRuns) return null;
    if (!hasPrompts) {
        return {
            title: 'Visibilité agentique indisponible',
            description:
                'Aucun prompt suivi pour ce mandat. '
                + 'Configurez des prompts dans Visibilité IA › Prompts pour activer la lecture de visibilité agentique.',
        };
    }
    return {
        title: 'Aucune exécution moteur',
        description:
            'Des prompts sont suivis mais aucune exécution moteur n’a encore été enregistrée. '
            + 'Lancez une exécution dans Visibilité IA › Exécutions.',
    };
}

export async function getAgentVisibilitySlice(clientId) {
    const overviewSlice = await getOverviewSlice(clientId).catch((error) => {
        console.error(`[agent-visibility-slice] overview ${clientId}`, error);
        return null;
    });

    const kpis = overviewSlice?.kpis || {};
    const visibility = overviewSlice?.visibility || {};
    const competitors = overviewSlice?.competitors || {};
    const sources = overviewSlice?.sources || {};

    const completedRunsTotal = Number(kpis.completedRunsTotal || 0);
    const trackedPromptsTotal = Number(kpis.trackedPromptsTotal || 0);

    return {
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        kpis: {
            mentionRatePercent: kpis.mentionRatePercent ?? null,
            visibilityProxyPercent: kpis.visibilityProxyPercent ?? null,
            citationCoveragePercent: kpis.citationCoveragePercent ?? null,
            competitorMentionsCount: kpis.competitorMentionsCount ?? 0,
            genericMentionsCount: kpis.genericMentionsCount ?? 0,
            completedRunsTotal,
            trackedPromptsTotal,
            visibilityProxyReliability: kpis.visibilityProxyReliability || null,
            avgParseConfidence: kpis.avgParseConfidence ?? null,
            parseFailureRate: kpis.parseFailureRate ?? null,
        },
        promptCoverage: visibility.promptCoverage || {
            total: trackedPromptsTotal,
            active: 0,
            withTargetFound: 0,
            withRunNoTarget: 0,
            noRunYet: 0,
            mentionRatePercent: kpis.mentionRatePercent ?? null,
        },
        topModels: (visibility.topProvidersModels || []).slice(0, 8),
        topCompetitors: (competitors.topCompetitors || []).slice(0, 6),
        topSources: (sources.topHosts || []).slice(0, 6),
        freshness: {
            lastAuditAt: visibility.lastAuditAt || null,
            lastRunAt: visibility.lastGeoRunAt || null,
        },
        links: {
            prompts: `/admin/clients/${clientId}/geo/prompts`,
            runs: `/admin/clients/${clientId}/geo/runs`,
            models: `/admin/clients/${clientId}/geo/models`,
            continuous: `/admin/clients/${clientId}/geo/continuous`,
        },
        emptyState: buildEmptyState({
            hasRuns: completedRunsTotal > 0,
            hasPrompts: trackedPromptsTotal > 0,
        }),
    };
}

