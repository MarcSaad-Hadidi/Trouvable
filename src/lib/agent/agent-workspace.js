import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getReadinessSlice } from '@/lib/operator-intelligence/geo-readiness';
import { getOpportunitySlice } from '@/lib/operator-intelligence/opportunities';
import { getOverviewSlice } from '@/lib/operator-intelligence/overview';

import { buildActionabilityReport } from './actionability';
import { buildProtocolsReport } from './protocols';
import { buildAgentRemediationPipeline } from './remediation-pipeline';
import { computeAgentScore, deriveAgentInputs } from './score';

/** Shared read preparation for the AGENT overview and fixes projections. */
export async function loadAgentWorkspace(clientId) {
    const results = await Promise.allSettled([
        getOverviewSlice(clientId),
        getReadinessSlice(clientId),
        getOpportunitySlice(clientId),
        dbGetClientById(clientId),
        dbGetLatestAudit(clientId),
    ]);
    const [overviewSlice, readinessSlice, opportunitySlice, clientRow, latestAudit] = results.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
    );
    const dataSources = { ...overviewSlice?.dataSources };
    const errors = [...(overviewSlice?.errors || [])];
    ['overview', 'readiness', 'opportunities', 'client', 'latestAudit'].forEach((source, index) => {
        const result = results[index];
        dataSources[source] =
            result.status === 'rejected'
                ? 'unavailable'
                : result.value?.status || (result.value ? 'available' : 'empty');
        if (dataSources[source] === 'unavailable')
            errors.push({ source, message: 'Données temporairement indisponibles.' });
        if (source !== 'overview')
            for (const error of result.value?.errors || [])
                errors.push({ source: `${source}.${error.source}`, message: 'Données temporairement indisponibles.' });
        if (source !== 'overview')
            for (const [key, value] of Object.entries(result.value?.dataSources || {}))
                dataSources[`${source}.${key}`] = value;
    });
    const sourceStates = Object.values(dataSources);
    const status = sourceStates.every((state) => state === 'unavailable')
        ? 'unavailable'
        : sourceStates.some((state) => ['partial', 'unavailable'].includes(state))
          ? 'partial'
          : 'available';
    const client = clientRow ? normalizeClientProfileShape(clientRow) : null;
    const actionabilityReport =
        results[3].status === 'rejected' || results[4].status === 'rejected'
            ? null
            : buildActionabilityReport({ client, audit: latestAudit });
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

    return {
        status,
        dataSources,
        errors,
        overviewSlice,
        readinessSlice,
        opportunitySlice,
        actionabilityReport,
        protocolsReport,
        inputs,
        score,
        remediation,
    };
}
