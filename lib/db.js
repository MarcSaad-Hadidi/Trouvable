// Temporary import bridge. Removed by integration after every consumer migrates.
export { getLatestAudit, getLatestAuditByUrl, createAuditRun, updateAuditRun, getRecentAudits } from '@/lib/db/audits';
export { logAction, getActions } from '@/lib/db/actions';
export { getCompetitorAliases, upsertCompetitorAliases } from '@/lib/db/competitors';
export { createBenchmarkSession, updateBenchmarkSession, getBenchmarkSessionById, getBenchmarkSessionsForClient } from '@/lib/db/benchmarks';
export { isTrackedQueryConstraintDrift } from '@/lib/db/query-support';
export { getTrackedQueries, createTrackedQuery, getTrackedQueriesAll, updateTrackedQuery, deleteTrackedQuery } from '@/lib/db/tracked-queries';
export { createQueryRun, updateQueryRun, getQueryRuns, countQueryRunsForClientSince, getQueryRunById, getQueryRunMentions, getQueryRunsHistory, getQueryRunsResponseBrowser, getCompletedQueryRuns, createQueryMentions, deleteQueryMentionsByRunId, getBenchmarkRunsBySession, getRecentQueryRuns, getLastRunPerTrackedQuery } from '@/lib/db/query-runs';
export { getClientById, getClientBySlug, listClients, createClient, updateClient, archiveClient, restoreClient, deleteClientHard } from '@/lib/db/clients';
export { getOpportunities, getOpportunitiesBySource, archiveOldOpportunities, archiveOldOpportunitiesExceptAudit, createOpportunities, updateOpportunity, getLatestOpportunities } from '@/lib/db/opportunities';
export { getMergeSuggestions, archiveOldMergeSuggestions, archiveOldMergeSuggestionsExceptAudit, createMergeSuggestions, getMergeSuggestionById, updateMergeSuggestion } from '@/lib/db/merge-suggestions';
export { getClientGeoMetrics } from '@/lib/operator-intelligence/snapshot';
