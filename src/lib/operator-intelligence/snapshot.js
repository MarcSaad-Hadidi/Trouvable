/**
 * GEO Workspace Snapshot — canonical assembly layer.
 *
 * Single source of truth for all workspace-level GEO metrics.
 * Fetches base data from Supabase once, derives all KPIs via kpi-core,
 * and returns a rich snapshot consumed by overview, legacy compat, models,
 * continuous jobs, and portal.
 *
 * Consumers MUST NOT re-fetch the same base data independently.
 */
import 'server-only';

import { getLatestAudit } from '@/lib/db/audits';
import { getTrackedQueriesAll } from '@/lib/db/tracked-queries';
import {
    buildGeoKpiSnapshot,
    flattenSnapshotToLegacy,
    buildLastRunMap,
    deriveAuditMetrics,
    deriveCitationDiagnosticHistogram,
    deriveMentionMetrics,
    derivePromptMetrics,
    deriveRunMetrics,
    enrichModelPerformanceWithSources,
} from '@/lib/operator-intelligence/kpi-core';
import { getAdminSupabase } from '@/lib/supabase-admin';

const MENTION_SELECT_FULL = [
    'query_run_id', 'business_name', 'normalized_label', 'entity_type',
    'is_target', 'position', 'first_position', 'confidence',
    'mention_kind', 'recommendation_strength', 'co_occurs_with_target',
    'created_at', 'normalized_domain', 'source_confidence', 'source_type',
    'verified_status',
].join(', ');

/**
 * Fetches all base workspace data and derives KPIs in one pass.
 *
 * @param {string} clientId
 * @returns {Promise<GeoWorkspaceSnapshot>}
 */
export async function getGeoWorkspaceSnapshot(clientId) {
    const supa = getAdminSupabase();

    const sources = {};
    const errors = [];
    // A failed source is distinct from a successful empty query. Never expose DB errors.
    async function load(source, fetch, field = null) {
        try {
            const result = await fetch();
            if (field && result.error) throw result.error;
            const value = field ? result[field] : result;
            if (field === 'count' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Missing count');
            sources[source] = value === null || value === undefined || (Array.isArray(value) && value.length === 0) ? 'empty' : 'available';
            return value ?? null;
        } catch {
            sources[source] = 'unavailable';
            errors.push({ source, message: 'Données temporairement indisponibles.' });
            return null;
        }
    }
    const [latestAudit, openOpportunities, pendingMerge, activeTrackedQueries, totalTrackedQueries, totalQueryRuns, brandRecommendations, completedRuns, lastRunRow, trackedQueries, citationDiagRuns] = await Promise.all([
        load('audit', () => getLatestAudit(clientId)),
        load('openOpportunities', () => supa.from('opportunities').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'open'), 'count'),
        load('pendingMerge', () => supa.from('merge_suggestions').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'pending'), 'count'),
        load('activeTrackedQueries', () => supa.from('tracked_queries').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('is_active', true), 'count'),
        load('totalTrackedQueries', () => supa.from('tracked_queries').select('*', { count: 'exact', head: true }).eq('client_id', clientId), 'count'),
        load('totalQueryRuns', () => supa.from('query_runs').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'completed').or('run_mode.is.null,run_mode.eq.standard'), 'count'),
        load('brandRecommendations', () => supa.from('query_runs').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'completed').or('run_mode.is.null,run_mode.eq.standard').eq('target_found', true), 'count'),
        load('runs', () => supa.from('query_runs').select('id, provider, model, target_found, tracked_query_id, created_at, query_text, parse_confidence, parse_status, status, target_position').eq('client_id', clientId).eq('status', 'completed').or('run_mode.is.null,run_mode.eq.standard'), 'data'),
        load('lastRun', () => supa.from('query_runs').select('created_at').eq('client_id', clientId).or('run_mode.is.null,run_mode.eq.standard').order('created_at', { ascending: false }).limit(1).maybeSingle(), 'data'),
        load('trackedQueries', () => getTrackedQueriesAll(clientId)),
        load('diagnostics', () => supa
            .from('query_runs')
            .select('raw_analysis')
            .eq('client_id', clientId)
            .eq('status', 'completed')
            .or('run_mode.is.null,run_mode.eq.standard')
            .order('created_at', { ascending: false })
            .limit(120), 'data'),
    ]);

    const runIds = (completedRuns || []).map((r) => r.id);
    let mentionRows = [];
    if (sources.runs === 'unavailable') {
        sources.mentions = 'unavailable';
        mentionRows = null;
    } else if (runIds.length > 0) {
        mentionRows = await load('mentions', () => supa.from('query_mentions').select(MENTION_SELECT_FULL).in('query_run_id', runIds), 'data');
    } else {
        sources.mentions = 'empty';
    }

    const counts = {
        openOpportunities,
        pendingMerge,
        activeTrackedQueries,
        totalTrackedQueries,
        totalQueryRuns,
        brandRecommendations,
    };

    const lastRunMap = buildLastRunMap(completedRuns || []);
    const lastRunAt = lastRunRow?.created_at ?? null;

    const auditMetrics = deriveAuditMetrics(latestAudit);
    const runMetrics = deriveRunMetrics(completedRuns || [], counts);
    const mentionMetrics = deriveMentionMetrics(mentionRows, completedRuns || []);
    const promptMetrics = derivePromptMetrics(trackedQueries || [], lastRunMap);
    const citationDiagnosticHistogram = deriveCitationDiagnosticHistogram(citationDiagRuns || []);

    function invalidate(metrics, keys) {
        for (const key of keys) {
            const value = metrics[key];
            metrics[key] = value && typeof value === 'object' && 'value' in value
                ? { ...value, value: null, confidence: 'low', status: 'unavailable', warnings: ['Données temporairement indisponibles.'] }
                : null;
        }
    }
    if (sources.audit === 'unavailable') {
        invalidate(auditMetrics, ['seoScore', 'geoScore', 'lastAuditAt', 'strengths', 'issues']);
        auditMetrics.llmStatus = 'unknown';
    }
    if (sources.totalQueryRuns === 'unavailable') invalidate(runMetrics, ['totalQueryRuns']);
    if (sources.totalQueryRuns === 'unavailable' || sources.brandRecommendations === 'unavailable') {
        invalidate(runMetrics, ['visibilityProxyPercent', 'visibilityProxyReliability', 'sampleSizeWarning']);
    }
    if (sources.runs === 'unavailable') {
        invalidate(runMetrics, ['avgParseConfidence', 'parseFailureRate', 'modelPerformance', 'runsByProvider']);
    }
    if (sources.mentions === 'unavailable') invalidate(mentionMetrics, Object.keys(mentionMetrics));
    if (sources.trackedQueries === 'unavailable') invalidate(promptMetrics, Object.keys(promptMetrics));
    else if (sources.runs === 'unavailable') invalidate(promptMetrics, ['withTargetFound', 'withRunNoTarget', 'noRunYet', 'mentionRatePercent']);

    const snapshot = buildGeoKpiSnapshot({
        audit: auditMetrics,
        runs: runMetrics,
        mentions: mentionMetrics,
        prompts: promptMetrics,
        counts,
        lastRunAt,
        citationDiagnosticHistogram,
    });

    const sourceStates = Object.values(sources);
    snapshot.status = sourceStates.every(state => state === 'unavailable') ? 'unavailable' : sourceStates.includes('unavailable') ? 'partial' : 'available';
    snapshot.sources = sources;
    snapshot.errors = errors;
    if (errors.length > 0) snapshot.guardrails.push({ code: 'DATA_UNAVAILABLE', message: 'Certaines données sont temporairement indisponibles.', severity: 'warning' });

    const modelPerformance = sources.runs === 'unavailable' ? null : sources.mentions === 'unavailable'
        ? runMetrics.modelPerformance.map((row) => ({ ...row, sources: null }))
        : enrichModelPerformanceWithSources(
        runMetrics.modelPerformance, mentionRows, completedRuns || [],
    );

    return {
        latestAudit,
        completedRuns: completedRuns || [],
        mentionRows: mentionRows || [],
        trackedQueries: trackedQueries || [],

        snapshot,
        auditMetrics,
        runMetrics,
        mentionMetrics,
        promptMetrics,
        counts,
        lastRunAt,
        lastRunMap,
        modelPerformance,
    };
}

/** Existing flat contract for jobs and reporting; assembly belongs above the DB layer. */
export async function getClientGeoMetrics(clientId) {
    const ws = await getGeoWorkspaceSnapshot(clientId);
    return { ...flattenSnapshotToLegacy(ws.snapshot, ws.latestAudit), modelPerformance: ws.modelPerformance };
}
