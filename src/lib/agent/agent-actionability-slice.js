import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import { buildActionabilityReport } from './actionability';

export async function getAgentActionabilitySlice(clientId) {
    const [clientRow, latestAudit] = await Promise.all([
        dbGetClientById(clientId).catch((error) => {
            console.error(`[agent-actionability-slice] client ${clientId}`, error);
            return null;
        }),
        dbGetLatestAudit(clientId).catch((error) => {
            console.error(`[agent-actionability-slice] audit ${clientId}`, error);
            return null;
        }),
    ]);

    const client = clientRow ? normalizeClientProfileShape(clientRow) : null;
    const report = buildActionabilityReport({ client, audit: latestAudit });

    return {
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
