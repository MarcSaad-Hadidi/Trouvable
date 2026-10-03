import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getReadinessSlice } from '@/lib/operator-intelligence/geo-readiness';
import { getOpportunitySlice } from '@/lib/operator-intelligence/opportunities';
import { getOverviewSlice } from '@/lib/operator-intelligence/overview';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import { buildActionabilityReport } from './actionability';
import { buildProtocolsReport } from './protocols';
import { buildAgentMajorBlockers, buildAgentRemediationPipeline } from './remediation-pipeline';
import { computeAgentScore, deriveAgentInputs } from './score';

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
    const results = await Promise.allSettled([
        getOverviewSlice(clientId), getReadinessSlice(clientId), getOpportunitySlice(clientId),
        dbGetClientById(clientId), dbGetLatestAudit(clientId),
    ]);
    const [overviewSlice, readinessSlice, opportunitySlice, clientRow, latestAudit] = results.map(result => result.status === 'fulfilled' ? result.value : null);
    const dataSources = { ...overviewSlice?.dataSources };
    const errors = [...(overviewSlice?.errors || [])];
    ['overview', 'readiness', 'opportunities', 'client', 'latestAudit'].forEach((source, index) => {
        const result = results[index];
        dataSources[source] = result.status === 'rejected' ? 'unavailable' : result.value?.status || (result.value ? 'available' : 'empty');
        if (dataSources[source] === 'unavailable') errors.push({ source, message: 'Données temporairement indisponibles.' });
        if (source !== 'overview') for (const error of result.value?.errors || []) errors.push({ source: `${source}.${error.source}`, message: 'Données temporairement indisponibles.' });
        if (source !== 'overview') for (const [key, value] of Object.entries(result.value?.dataSources || {})) dataSources[`${source}.${key}`] = value;
    });
    const sourceStates = Object.values(dataSources);
    const status = sourceStates.every(state => state === 'unavailable') ? 'unavailable'
        : sourceStates.some(state => ['partial', 'unavailable'].includes(state)) ? 'partial' : 'available';
    const client = clientRow ? normalizeClientProfileShape(clientRow) : null;
    const actionabilityReport = results[3].status === 'rejected' || results[4].status === 'rejected' ? null : buildActionabilityReport({ client, audit: latestAudit });
    const protocolsReport = results[4].status === 'rejected' ? null : buildProtocolsReport({ audit: latestAudit });
    const inputs = deriveAgentInputs({
        overviewSlice,
        readinessSlice,
        actionabilityReport,
        protocolsReport,
    });
    const score = computeAgentScore(inputs);

    const remediation = buildAgentRemediationPipeline({
        opportunitySlice,
        readinessSlice,
        actionabilityReport,
        protocolsReport,
        overviewSlice,
        score,
    });

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

