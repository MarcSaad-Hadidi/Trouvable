import 'server-only';

import { listVisibilityMetricSnapshots } from '@/lib/db/snapshots';
import { getRecurringJobHealthSlice } from '@/lib/continuous/recurring-jobs';
import { buildMetricTrendSummary, classifyFreshness, splitImprovingDeclining } from '@/lib/continuous/metrics-core';
import { getContinuousModeLabelFr, isDailyFirstMode } from '@/lib/continuous/mode';
import { flattenSnapshotToLegacy } from '@/lib/operator-intelligence/kpi-core';
import { getGeoWorkspaceSnapshot } from '@/lib/operator-intelligence/snapshot';
import { getConnectorOverviewForClient } from '@/lib/connectors';

export async function getTrendSlice(clientId) {
    const [ws, jobHealth, snapshots, connectors] = await Promise.all([
        getGeoWorkspaceSnapshot(clientId),
        getRecurringJobHealthSlice(clientId),
        listVisibilityMetricSnapshots(clientId, 120),
        getConnectorOverviewForClient(clientId),
    ]);

    const metricDefinitions = [
        { key: 'seo_score', label: 'Score SEO' },
        { key: 'geo_score', label: 'Score GEO' },
        { key: 'visibility_proxy_percent', label: 'Visibilite IA' },
        { key: 'mention_rate_percent', label: 'Taux de mention des prompts' },
        { key: 'citation_coverage_percent', label: 'Couverture des citations' },
        { key: 'competitor_visibility_count', label: 'Visibilite des concurrents' },
    ];

    const metricRows = metricDefinitions.map((metric) => {
        const d7 = buildMetricTrendSummary({ snapshots, metricKey: metric.key, days: 7 });
        const d30 = buildMetricTrendSummary({ snapshots, metricKey: metric.key, days: 30 });
        const d90 = buildMetricTrendSummary({ snapshots, metricKey: metric.key, days: 90 });

        return {
            key: metric.key,
            label: metric.label,
            ...d30,
            windows: {
                d7,
                d30,
                d90,
            },
        };
    });

    const board = splitImprovingDeclining(metricRows);

    const metrics = flattenSnapshotToLegacy(ws.snapshot, ws.latestAudit);
    metrics.modelPerformance = ws.modelPerformance;

    const dailyFirst = isDailyFirstMode();
    const auditFreshness = classifyFreshness(metrics.lastAuditAt, dailyFirst ? 96 : 72);
    const runFreshness = classifyFreshness(metrics.lastGeoRunAt, dailyFirst ? 72 : 48);

    const actionCenter = [];

    for (const metric of board.declining) {
        if (metric.key === 'seo_score' || metric.key === 'geo_score') {
            actionCenter.push({
                id: `score_drop_${metric.key}`,
                category: 'profile_fixes',
                priority: 'high',
                title: `${metric.label} en baisse (${metric.delta})`,
                rationale:
                    'La tendance recente signale un recul. Relancez un audit et priorisez les corrections en attente.',
                evidence: 'derived_from_snapshots',
            });
        }

        if (metric.key === 'citation_coverage_percent') {
            actionCenter.push({
                id: 'citation_gap',
                category: 'citation_source_opportunities',
                priority: 'high',
                title: 'Couverture des citations en recul',
                rationale:
                    'La couverture des sources observées baisse. Renforcez les prompts qui generent des citations fiables.',
                evidence: 'derived_from_snapshots',
            });
        }

        if (metric.key === 'mention_rate_percent') {
            actionCenter.push({
                id: 'prompt_coverage_gap',
                category: 'prompt_coverage_gaps',
                priority: 'medium',
                title: 'Taux de mention des prompts en baisse',
                rationale:
                    'La visibilite issue des prompts suivis faiblit. Revoyez le pack de prompts avant la prochaine actualisation quotidienne.',
                evidence: 'derived_from_snapshots',
            });
        }
    }

    if ((metrics.trackedPromptStats?.noRunYet || 0) > 0) {
        actionCenter.push({
            id: 'missing_prompt_runs',
            category: 'prompt_coverage_gaps',
            priority: 'medium',
            title: "Des prompts suivis n'ont pas encore d'exécution",
            rationale: `${metrics.trackedPromptStats.noRunYet} prompt(s) n ont pas encore de premiere observation.`,
            evidence: 'observed_prompt_state',
        });
    }

    if (auditFreshness.state === 'stale') {
        actionCenter.push({
            id: 'stale_audit',
            category: 'freshness_rerun_issues',
            priority: 'high',
            title: 'Audit quotidien en retard',
            rationale: `Le dernier audit date de ${auditFreshness.hours}h. Lancez une actualisation quotidienne.`,
            evidence: 'observed_timestamp',
        });
    }

    if (runFreshness.state === 'stale') {
        actionCenter.push({
            id: 'stale_runs',
            category: 'freshness_rerun_issues',
            priority: 'high',
            title: 'Exécutions quotidiennes en retard',
            rationale: `La derniere execution date de ${runFreshness.hours}h. Lancez le cycle quotidien des prompts.`,
            evidence: 'observed_timestamp',
        });
    }

    if (
        Number.isFinite(metrics.competitorMentions) &&
        Number.isFinite(metrics.brandRecommendationRuns) &&
        metrics.competitorMentions > Math.max(10, metrics.brandRecommendationRuns)
    ) {
        actionCenter.push({
            id: 'competitor_pressure',
            category: 'competitor_pressure_alerts',
            priority: 'medium',
            title: 'Pression concurrentielle elevee',
            rationale: 'Les mentions concurrentes sont elevees par rapport aux recommandations de marque.',
            evidence: 'derived_from_runs',
        });
    }

    const dedupedActionCenter = [];
    const seenActionIds = new Set();
    for (const item of actionCenter) {
        if (seenActionIds.has(item.id)) continue;
        seenActionIds.add(item.id);
        dedupedActionCenter.push(item);
    }

    return {
        status: ws.snapshot.status || 'available',
        dataSources: ws.snapshot.sources || {},
        errors: ws.snapshot.errors || [],
        metrics: metricRows,
        improving: board.improving,
        declining: board.declining,
        snapshotCoverage: {
            count: snapshots.length,
            startDate: snapshots[0]?.snapshot_date || null,
            endDate: snapshots[snapshots.length - 1]?.snapshot_date || null,
        },
        freshness: {
            audit: auditFreshness,
            runs: runFreshness,
            latestAuditAt: metrics.lastAuditAt || null,
            latestRunAt: metrics.lastGeoRunAt || null,
            mode: getContinuousModeLabelFr(),
        },
        snapshots,
        jobs: jobHealth,
        connectors,
        actionCenter: dedupedActionCenter.slice(0, 10),
        dailyMode: {
            enabled: dailyFirst,
            cadenceFloorMinutes: 1440,
            label: getContinuousModeLabelFr(),
        },
    };
}
