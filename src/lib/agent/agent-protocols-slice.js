import 'server-only';

import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { loadIndependentSources, getSourceStatus } from '@/lib/operator-intelligence/source-availability';

import { buildProtocolsReport } from './protocols';

export async function getAgentProtocolsSlice(clientId) {
    const { values, dataSources, errors } = await loadIndependentSources({
        latestAudit: () => dbGetLatestAudit(clientId),
    });
    const latestAudit = values.latestAudit;
    const report = buildProtocolsReport({ audit: latestAudit });
    if (dataSources.latestAudit === 'unavailable') {
        report.emptyState = {
            title: 'Protocoles AGENT indisponibles',
            description: 'Les données d’audit sont temporairement indisponibles. Réessayez ultérieurement.',
        };
    }

    return {
        status: getSourceStatus(dataSources),
        dataSources,
        errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
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
        },
        emptyState: report.emptyState,
    };
}
