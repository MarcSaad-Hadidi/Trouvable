import 'server-only';

import { finiteNumberOrNull } from '@/lib/numbers';

import {
    getRecentQueryRuns as dbGetRecentQueryRuns,
    getBenchmarkRunsBySession as dbGetBenchmarkRunsBySession,
} from '@/lib/db/query-runs';
import { getBenchmarkSessionsForClient as dbGetBenchmarkSessionsForClient } from '@/lib/db/benchmarks';
import { normalizeRunParseStatus } from '@/lib/operator-intelligence/run-lifecycle';
import { listBenchmarkVariants } from '@/lib/queries/engine-variants';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { getGeoWorkspaceSnapshot } from '@/lib/operator-intelligence/snapshot';

function summarizeBenchmarkSession(session, runs = []) {
    const rows = (runs || []).map((run) => ({
        run_id: run.id,
        engine_variant: run.engine_variant || 'unknown',
        provider: run.provider || 'unknown',
        model: run.model || 'unknown',
        target_found: run.target_found === true,
        target_position: run.target_position ?? null,
        parse_status: normalizeRunParseStatus(run),
        parse_confidence: run.parse_confidence ?? null,
        latency_ms: run.latency_ms ?? null,
        citations: finiteNumberOrNull(
            run.normalized_response?.external_source_mentions ?? run.normalized_response?.source_mentions,
        ),
        competitors: Number(run.normalized_response?.competitor_mentions || 0),
        cost_estimate_usd: run.raw_analysis?.benchmark?.cost_estimate_usd ?? null,
        error_class: run.error_class || null,
        created_at: run.created_at,
    }));

    // Group rows by variant, prioritizing the latest successful variant run
    const grouped = new Map();
    for (const row of rows) {
        const key = row.engine_variant;
        if (!grouped.has(key)) {
            grouped.set(key, { ...row, attempts: 1, history: [row] });
        } else {
            const existing = grouped.get(key);
            existing.attempts += 1;
            existing.history.push(row);
            // Replace primary if the new one looks more complete or successful
            if (row.parse_status && row.parse_status !== 'parsed_failed' && !row.error_class) {
                Object.assign(existing, row);
                existing.attempts = existing.history.length;
            }
        }
    }

    return {
        id: session.id,
        status: session.status,
        created_at: session.created_at,
        tracked_query_id: session.tracked_query_id || null,
        variants: session.requested_variants || [],
        rows: Array.from(grouped.values()),
    };
}

export async function getModelsSlice(clientId) {
    const results = await Promise.allSettled([
        getGeoWorkspaceSnapshot(clientId),
        dbGetRecentQueryRuns(clientId, 120, { includeAllModes: true }),
        dbGetBenchmarkSessionsForClient(clientId, 6),
    ]);

    if (results[0].status === 'rejected') throw new Error('Données temporairement indisponibles.');
    const ws = results[0].value;
    const recentQueryRuns = results[1].status === 'fulfilled' ? results[1].value : [];
    const benchmarkSessions = results[2].status === 'fulfilled' ? results[2].value : [];
    const dataSources = {
        ...ws.snapshot.sources,
        recentRuns:
            results[1].status === 'fulfilled' ? (recentQueryRuns.length ? 'available' : 'empty') : 'unavailable',
        benchmarks:
            results[2].status === 'fulfilled' ? (benchmarkSessions.length ? 'available' : 'empty') : 'unavailable',
    };
    const errors = [...ws.snapshot.errors];
    for (const source of ['recentRuns', 'benchmarks'])
        if (dataSources[source] === 'unavailable')
            errors.push({ source, message: 'Données temporairement indisponibles.' });
    const sessionDetails = [];
    for (const session of benchmarkSessions || []) {
        try {
            const runs = await dbGetBenchmarkRunsBySession(session.id);
            sessionDetails.push({ ...summarizeBenchmarkSession(session, runs), dataStatus: 'available' });
        } catch {
            dataSources.benchmarks = 'unavailable';
            errors.push({ source: 'benchmarks', message: 'Données temporairement indisponibles.' });
            sessionDetails.push({ ...summarizeBenchmarkSession(session, []), dataStatus: 'unavailable' });
        }
    }

    const { runMetrics, modelPerformance } = ws;

    // Merge compare-mode runs into modelPerformance.
    // The snapshot only includes standard/null run_mode; compare runs come via recentQueryRuns.
    const compareRuns = (recentQueryRuns || []).filter((r) => r.run_mode === 'compare');
    const mpMap = new Map();
    for (const row of modelPerformance || []) {
        mpMap.set(`${row.provider}|||${row.model}`, { ...row });
    }
    for (const r of compareRuns) {
        const key = `${r.provider || 'unknown'}|||${r.model || 'unknown'}`;
        if (!mpMap.has(key)) {
            mpMap.set(key, {
                provider: r.provider || 'unknown',
                model: r.model || 'unknown',
                runs: 0,
                targetFound: 0,
                sources: 0,
                targetRatePercent: 0,
            });
        }
        const row = mpMap.get(key);
        row.runs += 1;
        if (r.target_found) row.targetFound += 1;
        row.targetRatePercent = row.runs > 0 ? Math.round((row.targetFound / row.runs) * 100) : 0;
    }
    const mergedModelPerformance = [...mpMap.values()].sort((a, b) => b.runs - a.runs);

    return {
        status: errors.length > 0 ? 'partial' : ws.snapshot.status,
        dataSources,
        errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
            inferred: getProvenanceMeta('inferred'),
        },
        providerCounts: Object.entries(runMetrics.runsByProvider || {})
            .sort((a, b) => b[1] - a[1])
            .map(([provider, count]) => ({ provider, count })),
        modelPerformance: mergedModelPerformance,
        recentQueryRuns,
        summary: {
            totalRuns: runMetrics.totalQueryRuns.value ?? null,
            totalProviders:
                ws.snapshot.sources.runs === 'unavailable' ? null : Object.keys(runMetrics.runsByProvider || {}).length,
        },
        benchmark: {
            variantsCatalog: listBenchmarkVariants(),
            sessions: sessionDetails,
        },
        emptyState: {
            title: 'Aucune execution pour le moment',
            description:
                'Lancez d abord les prompts suivis. Les performances provider/modele sont calculees sur les exécutions observées.',
        },
    };
}
