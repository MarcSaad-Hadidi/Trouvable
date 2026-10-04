import 'server-only';

import { loadOverviewData } from '@/lib/operator-intelligence/overview-data';
import { mapOpportunitySourceToProvenance, getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export async function getOverviewSlice(clientId) {
    const { workspace, latestOpps, activity, recentAudits, recentQueryRuns, status, dataSources, errors } =
        await loadOverviewData(clientId);
    const {
        auditMetrics,
        runMetrics,
        mentionMetrics,
        promptMetrics,
        snapshot,
        modelPerformance,
        latestAudit,
        lastRunAt,
        completedRuns,
    } = workspace;

    const relevantOpps = latestOpps?.active?.filter((o) => o.status === 'open') ?? [];
    const staleOppsCount = latestOpps?.stale?.length ?? 0;

    return {
        status,
        dataSources,
        errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        kpis: {
            seoScore: auditMetrics.seoScore.value,
            geoScore: auditMetrics.geoScore.value,
            trackedPromptsTotal: promptMetrics.total.value,
            completedRunsTotal: runMetrics.totalQueryRuns.value,
            mentionRatePercent: promptMetrics.mentionRatePercent.value,
            citationCoveragePercent: mentionMetrics.citationCoveragePercent.value,
            competitorMentionsCount: mentionMetrics.confirmedCompetitorMentions.value,
            genericMentionsCount: mentionMetrics.genericMentions.value,
            openOpportunitiesCount:
                latestOpps && latestOpps.dataSources?.opportunities !== 'unavailable' ? relevantOpps.length : null,
            staleOpportunitiesCount:
                latestOpps && latestOpps.dataSources?.opportunities !== 'unavailable' ? staleOppsCount : null,
            visibilityProxyPercent: runMetrics.visibilityProxyPercent.value,
            visibilityProxyReliability: runMetrics.visibilityProxyReliability,
            avgParseConfidence: runMetrics.avgParseConfidence.value,
            parseFailureRate: runMetrics.parseFailureRate.value,
        },
        visibility: {
            lastAuditAt: latestAudit?.created_at ?? null,
            lastGeoRunAt: lastRunAt,
            promptCoverage: {
                total: promptMetrics.total.value,
                active: promptMetrics.active,
                withTargetFound: promptMetrics.withTargetFound,
                withRunNoTarget: promptMetrics.withRunNoTarget,
                noRunYet: promptMetrics.noRunYet,
                mentionRatePercent: promptMetrics.mentionRatePercent.value,
            },
            topProvidersModels: (modelPerformance || []).slice(0, 5),
        },
        sources: {
            summary: {
                totalCompletedRuns: snapshot.sources.runs === 'unavailable' ? null : completedRuns.length,
                totalSourceMentions: mentionMetrics.sourceMentions.value,
                externalSourceMentions: mentionMetrics.externalSourceMentions.value,
                uniqueSourceHosts: mentionMetrics.uniqueSourceHosts,
                citationCoveragePercent: mentionMetrics.citationCoveragePercent.value,
            },
            topHosts: (mentionMetrics.topSources || []).slice(0, 6),
        },
        competitors: {
            summary: {
                totalCompletedRuns: snapshot.sources.runs === 'unavailable' ? null : completedRuns.length,
                competitorMentions: mentionMetrics.confirmedCompetitorMentions.value,
                genericNonTargetMentions: mentionMetrics.genericMentions.value,
            },
            topCompetitors: (mentionMetrics.topCompetitors || []).slice(0, 6),
        },
        opportunities: {
            summary: {
                open:
                    latestOpps && latestOpps.dataSources?.opportunities !== 'unavailable' ? relevantOpps.length : null,
                total:
                    latestOpps && latestOpps.dataSources?.opportunities !== 'unavailable' ? relevantOpps.length : null,
            },
            openItems: relevantOpps
                .sort((a, b) => {
                    const pa = PRIORITY_ORDER[a.priority] ?? 99;
                    const pb = PRIORITY_ORDER[b.priority] ?? 99;
                    return pa !== pb ? pa - pb : String(b.created_at || '').localeCompare(String(a.created_at || ''));
                })
                .slice(0, 6)
                .map((o) => ({
                    ...o,
                    provenance: mapOpportunitySourceToProvenance(o.source),
                })),
        },
        guardrails: snapshot.guardrails,
        recentActivity: activity?.items || [],
        recentAudits,
        recentQueryRuns,
    };
}
