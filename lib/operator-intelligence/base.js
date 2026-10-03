import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import { readGeoScore, readSeoScore } from '@/lib/audit/scores-facade';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { finiteNumberOrNull } from '@/lib/numbers';

function latestIso(values) {
    return values
        .filter(Boolean)
        .sort((a, b) => String(b).localeCompare(String(a)))[0] || null;
}

export async function getOperatorWorkspaceShell(clientId) {
    let supabase;

    let clientResult;
    try {
        supabase = getAdminSupabase();
        clientResult = await supabase.from('client_geo_profiles').select('*').eq('id', clientId).maybeSingle();
    } catch {
        clientResult = { error: true };
    }
    if (clientResult.error) {
        const error = new Error('Données client temporairement indisponibles.');
        error.code = 'OPERATOR_CLIENT_UNAVAILABLE';
        throw error;
    }
    const clientRow = clientResult.data;
    if (!clientRow) return null;
    const [
        latestAuditResult,
        trackedQueryCountResult,
        activeTrackedQueryCountResult,
        completedRunsResult,
        openOpportunitiesResult,
        pendingMergeResult,
        latestRunResult,
        latestActionResult,
    ] = await Promise.allSettled([
        supabase
            .from('client_site_audits')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('tracked_queries')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId),
        supabase
            .from('tracked_queries')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('is_active', true),
        supabase
            .from('query_runs')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('status', 'completed')
            .or('run_mode.is.null,run_mode.eq.standard'),
        supabase
            .from('opportunities')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('status', 'open'),
        supabase
            .from('merge_suggestions')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('status', 'pending'),
        supabase
            .from('query_runs')
            .select('id, created_at, status')
            .eq('client_id', clientId)
            .or('run_mode.is.null,run_mode.eq.standard')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('actions')
            .select('id, created_at, action_type')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const results = { audit: latestAuditResult, trackedQueries: trackedQueryCountResult,
        activeTrackedQueries: activeTrackedQueryCountResult, totalQueryRuns: completedRunsResult,
        openOpportunities: openOpportunitiesResult, pendingMerge: pendingMergeResult,
        lastRun: latestRunResult, lastAction: latestActionResult };
    const dataSources = { client: 'available' };
    const errors = [];
    const countSources = new Set(['trackedQueries', 'activeTrackedQueries', 'totalQueryRuns', 'openOpportunities', 'pendingMerge']);
    const values = {};
    for (const [source, result] of Object.entries(results)) {
        const loaded = result.status === 'fulfilled' ? result.value : null;
        const count = countSources.has(source) ? finiteNumberOrNull(loaded?.count) : null;
        const invalidCount = countSources.has(source) && (count === null || count < 0 || !Number.isInteger(count));
        if (!loaded || loaded.error || invalidCount) {
            dataSources[source] = 'unavailable';
            errors.push({ source, message: 'Données temporairement indisponibles.' });
            values[source] = null;
        } else {
            values[source] = countSources.has(source) ? count : loaded.data || null;
            dataSources[source] = values[source] === null || values[source] === 0 ? 'empty' : 'available';
        }
    }
    const client = normalizeClientProfileShape(clientRow);
    const audit = values.audit;
    const issueCount = dataSources.audit === 'unavailable' ? null : Array.isArray(audit?.issues) ? audit.issues.length : 0;
    const refreshMarker = latestIso([
        client.updated_at, audit?.created_at, values.lastRun?.created_at, values.lastAction?.created_at,
    ]) || new Date(0).toISOString();
    return {
        status: errors.length ? 'partial' : 'available',
        dataSources,
        errors,
        client,
        audit,
        workspace: {
            trackedPromptCount: values.trackedQueries,
            activeTrackedPromptCount: values.activeTrackedQueries,
            completedRunCount: values.totalQueryRuns,
            openOpportunityCount: values.openOpportunities,
            pendingMergeCount: values.pendingMerge,
            issueCount,
            seoScore: readSeoScore(audit).value,
            geoScore: readGeoScore(audit).value,
            latestAuditAt: audit?.created_at || null,
            latestRunAt: values.lastRun?.created_at || null,
            latestRunStatus: values.lastRun?.status || null,
            latestActivityAt: values.lastAction?.created_at || null,
            refreshMarker,
        },
    };
}
