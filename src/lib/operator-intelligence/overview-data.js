import 'server-only';

import { getLatestOpportunities as dbGetLatestOpportunities } from '@/lib/db/opportunities';
import { getRecentAudits as dbGetRecentAudits } from '@/lib/db/audits';
import { getRecentQueryRuns as dbGetRecentQueryRuns } from '@/lib/db/query-runs';
import { getRecentSafeActivity } from '@/lib/operator-intelligence/activity';
import { getGeoWorkspaceSnapshot } from '@/lib/operator-intelligence/snapshot';

/** Shared acquisition and source diagnostics for the GEO overview and AGENT visibility projections. */
export async function loadOverviewData(clientId) {
    // AGENT visibility retains diagnostics from all five sources, including the overview's independent branches.
    const results = await Promise.allSettled([
        getGeoWorkspaceSnapshot(clientId),
        dbGetLatestOpportunities(clientId),
        getRecentSafeActivity(clientId),
        dbGetRecentAudits(clientId, 24),
        dbGetRecentQueryRuns(clientId, 120),
    ]);

    if (results[0].status === 'rejected') throw new Error('Données temporairement indisponibles.');
    const workspace = results[0].value;
    const latestOpps = results[1].status === 'fulfilled' ? results[1].value : null;
    const activity = results[2].status === 'fulfilled' ? results[2].value : null;
    const recentAudits = results[3].status === 'fulfilled' ? results[3].value : [];
    const recentQueryRuns = results[4].status === 'fulfilled' ? results[4].value : [];
    const dataSources = { ...workspace.snapshot.sources };
    const errors = [...workspace.snapshot.errors];
    for (const [index, source] of ['opportunities', 'activity', 'auditHistory', 'runHistory'].entries()) {
        const failed = results[index + 1].status === 'rejected';
        const value = failed ? null : results[index + 1].value;
        dataSources[source] = failed ? 'unavailable' : value?.status || 'available';
        if (failed) errors.push({ source, message: 'Données temporairement indisponibles.' });
        for (const [key, status] of Object.entries(value?.dataSources || {})) dataSources[`${source}.${key}`] = status;
        for (const error of value?.errors || [])
            errors.push({ source: `${source}.${error.source}`, message: 'Données temporairement indisponibles.' });
    }

    return {
        workspace,
        latestOpps,
        activity,
        recentAudits,
        recentQueryRuns,
        status:
            errors.length > 0 || Object.values(dataSources).some((state) => ['partial', 'unavailable'].includes(state))
                ? 'partial'
                : workspace.snapshot.status,
        dataSources,
        errors,
    };
}
