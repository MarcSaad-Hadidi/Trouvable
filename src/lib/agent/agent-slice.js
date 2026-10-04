import 'server-only';

import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import { loadAgentWorkspace } from './agent-workspace';
import { buildAgentMajorBlockers } from './remediation-pipeline';

function buildEmptyState({ hasAudit, hasRuns, unavailable }) {
    if (unavailable) return { title: 'AGENT temporairement indisponible', description: 'Les sources nécessaires à cette lecture ne sont pas toutes disponibles.' };
    if (hasAudit || hasRuns) return null;
    return {
        title: 'AGENT indisponible',
        description:
            "Aucun audit et aucune exécution moteur n'ont encore été enregistrés pour ce mandat. "
            + 'Lancez un audit et les prompts suivis pour activer la lecture AGENT.',
    };
}

export async function getAgentSlice(clientId) {
    const { status, dataSources, errors, overviewSlice, readinessSlice, opportunitySlice,
        actionabilityReport, protocolsReport, inputs, score, remediation } = await loadAgentWorkspace(clientId);

    const lastAuditAt = overviewSlice?.visibility?.lastAuditAt || null;
    const lastRunAt = overviewSlice?.visibility?.lastGeoRunAt || null;
    const hasAudit = Boolean(lastAuditAt);
    const hasRuns = Boolean(overviewSlice?.kpis?.completedRunsTotal);

    const topFixes = remediation.topFixes.slice(0, 5);
    const topBlockers = buildAgentMajorBlockers({ readinessSlice, remediation, limit: 4 });

    return {
        status, dataSources, errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        score,
        inputs: {
            visibility: inputs.visibility,
            readiness: inputs.readiness,
            actionability: inputs.actionability,
            advancedProtocols: inputs.advancedProtocols,
        },
        actionabilityTopFixes: actionabilityReport?.topFixes || [],
        protocolsTopFixes: protocolsReport?.topFixes || [],
        snapshot: {
            lastAuditAt,
            lastRunAt,
            completedRunsTotal: overviewSlice?.kpis?.completedRunsTotal ?? null,
            trackedPromptsTotal: overviewSlice?.kpis?.trackedPromptsTotal ?? null,
            openOpportunitiesCount: remediation?.summary?.open ?? null,
            highPriorityOpen: remediation?.summary?.highPriorityOpen ?? null,
            opportunityOpenCount: opportunitySlice?.summary?.open ?? null,
            derivedOpenCount: remediation?.summary?.derivedOpen ?? null,
        },
        topFixes,
        topBlockers,
        remediation: {
            summary: remediation.summary,
            byPriority: remediation.byPriority,
            bySource: remediation.bySource,
            coverage: remediation.coverage,
        },
        links: {
            visibility: `/admin/clients/${clientId}/agent/visibility`,
            readiness: `/admin/clients/${clientId}/agent/readiness`,
            actionability: `/admin/clients/${clientId}/agent/actionability`,
            protocols: `/admin/clients/${clientId}/agent/protocols`,
            competitors: `/admin/clients/${clientId}/agent/competitors`,
            fixes: `/admin/clients/${clientId}/agent/fixes`,
            geoOpportunities: `/admin/clients/${clientId}/geo/opportunities`,
            geoRuns: `/admin/clients/${clientId}/geo/runs`,
        },
        emptyState: buildEmptyState({ hasAudit, hasRuns, unavailable: dataSources.overview === 'unavailable' || dataSources.audit === 'unavailable' || dataSources.latestAudit === 'unavailable' || overviewSlice?.kpis?.completedRunsTotal === null }),
    };
}

