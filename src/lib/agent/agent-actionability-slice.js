import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { loadIndependentSources, getSourceStatus } from '@/lib/operator-intelligence/source-availability';

import { buildActionabilityReport } from './actionability';

export async function getAgentActionabilitySlice(clientId) {
    const { values, dataSources, errors } = await loadIndependentSources({
        client: () => dbGetClientById(clientId),
        latestAudit: () => dbGetLatestAudit(clientId),
    });
    const latestAudit = values.latestAudit;
    const client = values.client ? normalizeClientProfileShape(values.client) : null;
    const inputsUnavailable = errors.length > 0;
    const report = buildActionabilityReport({ client, audit: inputsUnavailable ? null : latestAudit });
    if (inputsUnavailable) {
        report.emptyState = {
            title: 'Actionnabilité AGENT indisponible',
            description:
                'Les données nécessaires à cette analyse sont temporairement indisponibles. Réessayez ultérieurement.',
        };
    }

    return {
        status: getSourceStatus(dataSources),
        dataSources,
        errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
        },
        available: report.available,
        reliability: report.reliability,
        summary: report.summary,
        dimensions: report.dimensions,
        topFixes: report.topFixes,
        topStrengths: report.topStrengths,
        freshness: {
            auditCreatedAt: latestAudit?.created_at || null,
            scanStatus: latestAudit?.scan_status || null,
        },
        links: {
            audit: `/admin/clients/${clientId}/dossier/audit`,
            opportunities: `/admin/clients/${clientId}/geo/opportunities`,
            profile: `/admin/clients/${clientId}/dossier`,
        },
        emptyState: report.emptyState,
    };
}
