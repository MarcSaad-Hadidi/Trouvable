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

function buildEmptyState({ hasAudit, hasRuns }) {
    if (hasAudit || hasRuns) return null;
    return {
        title: 'AGENT indisponible',
        description:
            "Aucun audit et aucune exécution moteur n'ont encore été enregistrés pour ce mandat. "
            + 'Lancez un audit et les prompts suivis pour activer la lecture AGENT.',
    };
}

export async function getAgentSlice(clientId) {
    const [overviewSlice, readinessSlice, opportunitySlice, clientRow, latestAudit] = await Promise.all([
        getOverviewSlice(clientId).catch((error) => {
            console.error(`[agent-slice] overview ${clientId}`, error);
            return null;
        }),
        getReadinessSlice(clientId).catch((error) => {
            console.error(`[agent-slice] readiness ${clientId}`, error);
            return null;
        }),
        getOpportunitySlice(clientId).catch((error) => {
            console.error(`[agent-slice] opportunities ${clientId}`, error);
            return null;
        }),
        dbGetClientById(clientId).catch((error) => {
            console.error(`[agent-slice] client ${clientId}`, error);
            return null;
        }),
        dbGetLatestAudit(clientId).catch((error) => {
            console.error(`[agent-slice] audit ${clientId}`, error);
            return null;
        }),
    ]);

    const client = clientRow ? normalizeClientProfileShape(clientRow) : null;
    const actionabilityReport = buildActionabilityReport({ client, audit: latestAudit });
    const protocolsReport = buildProtocolsReport({ audit: latestAudit });
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
            openOpportunitiesCount: remediation?.summary?.open ?? 0,
            highPriorityOpen: remediation?.summary?.highPriorityOpen ?? 0,
            opportunityOpenCount: opportunitySlice?.summary?.open ?? 0,
            derivedOpenCount: remediation?.summary?.derivedOpen ?? 0,
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
        emptyState: buildEmptyState({ hasAudit, hasRuns }),
    };
}

