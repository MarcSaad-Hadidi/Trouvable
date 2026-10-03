import 'server-only';

import { getOverviewSlice } from '@/lib/operator-intelligence/overview';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { finiteNumberOrNull } from '@/lib/numbers';

function buildEmptyState({ hasRuns, hasPrompts }) {
    if (hasRuns === null || hasPrompts === null) return {
        title: 'Visibilité agentique temporairement indisponible',
        description: 'Les données nécessaires à cette lecture ne sont pas toutes disponibles.',
    };
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
    const overviewSlice = await getOverviewSlice(clientId).catch(() => null);
    const status = overviewSlice?.status || (overviewSlice ? 'available' : 'unavailable');
    const dataSources = overviewSlice?.dataSources || { overview: overviewSlice ? 'available' : 'unavailable' };
    const errors = overviewSlice ? overviewSlice.errors || [] : [{ source: 'overview', message: 'Données temporairement indisponibles.' }];
    const kpis = overviewSlice?.kpis || {};
    const visibility = overviewSlice?.visibility || {};
    const competitors = overviewSlice?.competitors || {};
    const sources = overviewSlice?.sources || {};

    const completedRunsTotal = dataSources.totalQueryRuns === 'unavailable' ? null : finiteNumberOrNull(kpis.completedRunsTotal);
    const trackedPromptsTotal = dataSources.trackedQueries === 'unavailable' ? null : finiteNumberOrNull(kpis.trackedPromptsTotal);

    return {
        status, dataSources, errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        kpis: {
            mentionRatePercent: kpis.mentionRatePercent ?? null,
            visibilityProxyPercent: kpis.visibilityProxyPercent ?? null,
            citationCoveragePercent: kpis.citationCoveragePercent ?? null,
            competitorMentionsCount: finiteNumberOrNull(kpis.competitorMentionsCount),
            genericMentionsCount: finiteNumberOrNull(kpis.genericMentionsCount),
            completedRunsTotal,
            trackedPromptsTotal,
            visibilityProxyReliability: kpis.visibilityProxyReliability || null,
            avgParseConfidence: kpis.avgParseConfidence ?? null,
            parseFailureRate: kpis.parseFailureRate ?? null,
        },
        promptCoverage: visibility.promptCoverage || {
            total: trackedPromptsTotal,
            active: trackedPromptsTotal === 0 ? 0 : null,
            withTargetFound: trackedPromptsTotal === 0 ? 0 : null,
            withRunNoTarget: trackedPromptsTotal === 0 ? 0 : null,
            noRunYet: trackedPromptsTotal === 0 ? 0 : null,
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
            hasRuns: completedRunsTotal === null ? null : completedRunsTotal > 0,
            hasPrompts: trackedPromptsTotal === null ? null : trackedPromptsTotal > 0,
        }),
    };
}

