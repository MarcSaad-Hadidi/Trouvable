import 'server-only';

import { db } from '@/lib/db/core';
import {
    QUERY_RUN_TRACKED_QUERY_SELECT,
    createDbError,
    extractMissingSchemaCacheColumn,
    normalizeQueryRunRow,
    normalizeQueryRunRows,
} from '@/lib/db/query-support';

const OPTIONAL_QUERY_RUN_DRIFT_COLUMNS = new Set([
    'benchmark_session_id',
    'discovery_mode',
    'engine_variant',
    'error_class',
    'extraction_version',
    'latency_ms',
    'normalized_response',
    'parse_confidence',
    'parse_status',
    'parse_warnings',
    'prompt_payload',
    'raw_response_full',
    'retry_count',
    'run_mode',
    'target_detection',
    'usage_tokens',
]);

async function executeQueryRunWriteWithCompat(context, payload, executor) {
    const strippedColumns = [];
    const writePayload = { ...payload };

    while (true) {
        const { data, error } = await executor(writePayload);
        if (!error) {
            if (strippedColumns.length > 0) {
                console.warn(
                    `[DB] ${context}: query_runs schema drift detected. Retried without columns: ${strippedColumns.join(', ')}`
                );
            }
            return data;
        }

        const missingColumn = extractMissingSchemaCacheColumn(error, 'query_runs');
        if (!missingColumn || !OPTIONAL_QUERY_RUN_DRIFT_COLUMNS.has(missingColumn) || !Object.prototype.hasOwnProperty.call(writePayload, missingColumn)) {
            throw createDbError(context, error, strippedColumns.length > 0 ? { queryRunSchemaDriftColumns: strippedColumns } : {});
        }

        delete writePayload[missingColumn];
        strippedColumns.push(missingColumn);
    }
}

export async function createQueryRun(runData) {
    const normalizedRunData = {
        ...runData,
        provider: runData.provider || 'unknown',
        model: runData.model || 'unknown',
        status: runData.status || 'completed',
        run_mode: runData.run_mode || 'standard',
        engine_variant: runData.engine_variant || 'tavily_orchestrated',
        locale: runData.locale || 'fr-CA',
        target_found: runData.target_found ?? false,
        total_mentioned: runData.total_mentioned ?? 0,
        raw_analysis: runData.raw_analysis ?? {},
        parsed_response: runData.parsed_response ?? {},
        prompt_payload: runData.prompt_payload ?? {},
        raw_response_full: runData.raw_response_full ?? runData.response_text ?? null,
        normalized_response: runData.normalized_response ?? runData.parsed_response ?? {},
        parse_status: Object.prototype.hasOwnProperty.call(runData, 'parse_status') ? (runData.parse_status ?? null) : null,
        parse_warnings: runData.parse_warnings ?? [],
        usage_tokens: runData.usage_tokens ?? {},
        retry_count: runData.retry_count ?? 0,
        extraction_version: runData.extraction_version || 'v2',
        target_detection: runData.target_detection ?? {},
    };

    return executeQueryRunWriteWithCompat('createQueryRun', normalizedRunData, (payload) => (
        db().from('query_runs').insert(payload).select().single()
    ));
}

export async function updateQueryRun(id, updates) {
    const normalizedUpdates = {
        ...updates,
        ...(Object.prototype.hasOwnProperty.call(updates, 'provider') ? { provider: updates.provider || 'unknown' } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'model') ? { model: updates.model || 'unknown' } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'raw_analysis') ? { raw_analysis: updates.raw_analysis ?? {} } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'parsed_response') ? { parsed_response: updates.parsed_response ?? {} } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'prompt_payload') ? { prompt_payload: updates.prompt_payload ?? {} } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'normalized_response') ? { normalized_response: updates.normalized_response ?? {} } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'parse_warnings') ? { parse_warnings: updates.parse_warnings ?? [] } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'usage_tokens') ? { usage_tokens: updates.usage_tokens ?? {} } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'target_detection') ? { target_detection: updates.target_detection ?? {} } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'total_mentioned') ? { total_mentioned: updates.total_mentioned ?? 0 } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'target_found') ? { target_found: updates.target_found ?? false } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'run_mode') ? { run_mode: updates.run_mode || 'standard' } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'engine_variant') ? { engine_variant: updates.engine_variant || 'tavily_orchestrated' } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'locale') ? { locale: updates.locale || 'fr-CA' } : {}),
    };

    return executeQueryRunWriteWithCompat(`updateQueryRun ${id}`, normalizedUpdates, (payload) => (
        db().from('query_runs').update(payload).eq('id', id).select().single()
    ));
}

export async function getQueryRuns(clientId, limit = 20) {
    const { data, error } = await db()
        .from('query_runs')
        .select(`*, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`[DB] queryRuns ${clientId}: ${error.message}`);
    return normalizeQueryRunRows(data);
}

export async function countQueryRunsForClientSince(clientId, sinceIso) {
    let query = db()
        .from('query_runs')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);

    if (typeof sinceIso === 'string' && sinceIso.trim()) {
        query = query.gte('created_at', sinceIso);
    }

    const { count, error } = await query;
    if (error) throw new Error(`[DB] countQueryRunsForClientSince ${clientId}: ${error.message}`);
    return Number(count || 0);
}

export async function getQueryRunById(id) {
    const { data, error } = await db()
        .from('query_runs')
        .select(`*, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('id', id)
        .single();

    if (error) throw new Error(`[DB] getQueryRunById ${id}: ${error.message}`);
    return normalizeQueryRunRow(data);
}

export async function getQueryRunMentions(queryRunId) {
    const { data, error } = await db()
        .from('query_mentions')
        .select('*')
        .eq('query_run_id', queryRunId)
        .order('position', { ascending: true });

    if (error) throw new Error(`[DB] getQueryRunMentions ${queryRunId}: ${error.message}`);
    return data || [];
}

/**
 * Recent runs with response bodies for the « Réponses & preuves » operator surface.
 */
export async function getQueryRunsResponseBrowser(clientId, limit = 120) {
    const withBodies = `id, tracked_query_id, query_text, provider, model, status, discovery_mode, parse_status, parse_confidence, target_found, target_position, created_at, response_text, raw_response_full, parsed_response, prompt_payload, ${QUERY_RUN_TRACKED_QUERY_SELECT}`;

    async function runSelect(selectStr) {
        return db()
            .from('query_runs')
            .select(selectStr)
            .eq('client_id', clientId)
            .or('run_mode.is.null,run_mode.eq.standard,run_mode.eq.compare,run_mode.eq.benchmark')
            .order('created_at', { ascending: false })
            .limit(limit);
    }

    let { data, error } = await runSelect(withBodies);
    if (error) {
        const missing = extractMissingSchemaCacheColumn(error, 'query_runs');
        if (missing === 'raw_response_full' || missing === 'response_text') {
            const fallback = `id, tracked_query_id, query_text, provider, model, status, discovery_mode, parse_status, parse_confidence, target_found, target_position, created_at, parsed_response, prompt_payload, ${QUERY_RUN_TRACKED_QUERY_SELECT}`;
            const second = await runSelect(fallback);
            data = second.data;
            error = second.error;
        }
    }
    if (error) throw new Error(`[DB] getQueryRunsResponseBrowser ${clientId}: ${error.message}`);
    return normalizeQueryRunRows(data);
}

export async function getQueryRunsHistory(clientId, limit = 200) {
    const { data, error } = await db()
        .from('query_runs')
        .select(`id, client_id, tracked_query_id, query_text, provider, model, status, run_mode, engine_variant, discovery_mode, parse_status, parse_confidence, latency_ms, target_found, target_position, total_mentioned, created_at, parsed_response, prompt_payload, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('client_id', clientId)
        .or('run_mode.is.null,run_mode.eq.standard,run_mode.eq.compare,run_mode.eq.benchmark')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`[DB] getQueryRunsHistory ${clientId}: ${error.message}`);
    return normalizeQueryRunRows(data);
}

export async function getCompletedQueryRuns(clientId, limit = null) {
    let query = db()
        .from('query_runs')
        .select(`id, client_id, tracked_query_id, query_text, provider, model, status, run_mode, engine_variant, discovery_mode, parse_status, parse_confidence, latency_ms, target_found, target_position, total_mentioned, created_at, parsed_response, prompt_payload, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .or('run_mode.is.null,run_mode.eq.standard')
        .order('created_at', { ascending: false });

    if (Number.isInteger(limit) && limit > 0) {
        query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[DB] getCompletedQueryRuns ${clientId}: ${error.message}`);
    return normalizeQueryRunRows(data);
}

export async function createQueryMentions(mentions) {
    if (!mentions.length) return [];
    const { data, error } = await db().from('query_mentions').insert(mentions).select();
    if (error) throw new Error(`[DB] createQueryMentions: ${error.message}`);
    return data || [];
}

export async function deleteQueryMentionsByRunId(queryRunId) {
    const { error } = await db()
        .from('query_mentions')
        .delete()
        .eq('query_run_id', queryRunId);

    if (error) throw new Error(`[DB] deleteQueryMentionsByRunId ${queryRunId}: ${error.message}`);
}

export async function deleteProblematicQueryRuns(clientId) {
    const { error, count } = await db()
        .from('query_runs')
        .delete({ count: 'exact' })
        .eq('client_id', clientId)
        .or('status.eq.failed,parse_status.eq.parsed_failed,parse_status.eq.parsed_partial');

    if (error) throw new Error(`[DB] deleteProblematicQueryRuns: ${error.message}`);

    return { deleted: count || 0 };
}

export async function getBenchmarkRunsBySession(sessionId) {
    const { data, error } = await db()
        .from('query_runs')
        .select(`*, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('benchmark_session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`[DB] getBenchmarkRunsBySession ${sessionId}: ${error.message}`);
    return normalizeQueryRunRows(data);
}

export async function getRecentQueryRuns(clientId, limit = 5, { includeAllModes = false } = {}) {
    let query = db()
        .from('query_runs')
        .select(`id, tracked_query_id, query_text, provider, model, status, run_mode, engine_variant, discovery_mode, parse_status, parse_confidence, latency_ms, target_found, total_mentioned, created_at, parsed_response, prompt_payload, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('client_id', clientId);

    if (!includeAllModes) {
        query = query.or('run_mode.is.null,run_mode.eq.standard');
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`[DB] getRecentQueryRuns: ${error.message}`);
    return normalizeQueryRunRows(data);
}

export async function getLastRunPerTrackedQuery(clientId) {
    const { data: runs, error } = await db()
        .from('query_runs')
        .select(`id, tracked_query_id, query_text, provider, model, status, run_mode, engine_variant, discovery_mode, parse_status, parse_confidence, latency_ms, target_found, target_position, total_mentioned, response_text, raw_response_full, created_at, parsed_response, prompt_payload, ${QUERY_RUN_TRACKED_QUERY_SELECT}`)
        .eq('client_id', clientId)
        .or('run_mode.is.null,run_mode.eq.standard')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[DB] getLastRunPerTrackedQuery: ${error.message}`);

    const byTrackedQuery = new Map();
    for (const run of normalizeQueryRunRows(runs)) {
        if (!run.tracked_query_id) continue;
        if (!byTrackedQuery.has(run.tracked_query_id)) byTrackedQuery.set(run.tracked_query_id, run);
    }
    return byTrackedQuery;
}
