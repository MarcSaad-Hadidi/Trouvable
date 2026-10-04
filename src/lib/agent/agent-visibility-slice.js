import 'server-only';

import { loadOverviewData } from '@/lib/operator-intelligence/overview-data';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { finiteNumberOrNull } from '@/lib/numbers';

function buildEmptyState({ hasRuns, hasPrompts }) {
    if (hasRuns === null || hasPrompts === null)
        return {
            title: 'Visibilité agentique temporairement indisponible',
            description: 'Les données nécessaires à cette lecture ne sont pas toutes disponibles.',
        };
    if (hasRuns) return null;
    if (!hasPrompts) {
        return {
            title: 'Visibilité agentique indisponible',
            description:
                'Aucun prompt suivi pour ce mandat. ' +
                'Configurez des prompts dans Visibilité IA › Prompts pour activer la lecture de visibilité agentique.',
        };
    }
    return {
        title: 'Aucune exécution moteur',
        description:
            'Des prompts sont suivis mais aucune exécution moteur n’a encore été enregistrée. ' +
            'Lancez une exécution dans Visibilité IA › Exécutions.',
    };
}

export async function getAgentVisibilitySlice(clientId) {
    const data = await loadOverviewData(clientId).catch(() => null);
    const status = data?.status || (data ? 'available' : 'unavailable');
    const dataSources = data?.dataSources || { overview: data ? 'available' : 'unavailable' };
    const errors = data
        ? data.errors || []
        : [{ source: 'overview', message: 'Données temporairement indisponibles.' }];
    const workspace = data?.workspace;
    const runMetrics = workspace?.runMetrics || {};
    const promptMetrics = workspace?.promptMetrics;
    const mentionMetrics = workspace?.mentionMetrics || {};

    const completedRunsTotal =
        dataSources.totalQueryRuns === 'unavailable' ? null : finiteNumberOrNull(runMetrics.totalQueryRuns?.value);
    const trackedPromptsTotal =
        dataSources.trackedQueries === 'unavailable' ? null : finiteNumberOrNull(promptMetrics?.total?.value);

    return {
        status,
        dataSources,
        errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        kpis: {
            mentionRatePercent: promptMetrics?.mentionRatePercent?.value ?? null,
            visibilityProxyPercent: runMetrics.visibilityProxyPercent?.value ?? null,
            citationCoveragePercent: mentionMetrics.citationCoveragePercent?.value ?? null,
            competitorMentionsCount: finiteNumberOrNull(mentionMetrics.confirmedCompetitorMentions?.value),
            genericMentionsCount: finiteNumberOrNull(mentionMetrics.genericMentions?.value),
            completedRunsTotal,
            trackedPromptsTotal,
            visibilityProxyReliability: runMetrics.visibilityProxyReliability || null,
            avgParseConfidence: runMetrics.avgParseConfidence?.value ?? null,
            parseFailureRate: runMetrics.parseFailureRate?.value ?? null,
        },
        promptCoverage: promptMetrics
            ? {
                  total: promptMetrics.total?.value,
                  active: promptMetrics.active,
                  withTargetFound: promptMetrics.withTargetFound,
                  withRunNoTarget: promptMetrics.withRunNoTarget,
                  noRunYet: promptMetrics.noRunYet,
                  mentionRatePercent: promptMetrics.mentionRatePercent?.value,
              }
            : {
                  total: trackedPromptsTotal,
                  active: trackedPromptsTotal === 0 ? 0 : null,
                  withTargetFound: trackedPromptsTotal === 0 ? 0 : null,
                  withRunNoTarget: trackedPromptsTotal === 0 ? 0 : null,
                  noRunYet: trackedPromptsTotal === 0 ? 0 : null,
                  mentionRatePercent: null,
              },
        topModels: (workspace?.modelPerformance || []).slice(0, 5),
        topCompetitors: (mentionMetrics.topCompetitors || []).slice(0, 6),
        topSources: (mentionMetrics.topSources || []).slice(0, 6),
        freshness: {
            lastAuditAt: workspace?.latestAudit?.created_at || null,
            lastRunAt: workspace?.lastRunAt || null,
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
