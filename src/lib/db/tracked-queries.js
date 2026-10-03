import 'server-only';

import { db } from '@/lib/db/core';
import { prepareTrackedQueryWrite } from '@/lib/operator-intelligence/prompt-taxonomy';
import {
    createDbError,
    isTrackedQueryConstraintDriftError,
    mapTrackedQueryWriteToLegacy,
} from '@/lib/db/query-support';

export async function getTrackedQueries(clientId, activeOnly = true) {
    let query = db().from('tracked_queries').select('*').eq('client_id', clientId);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error(`[DB] trackedQueries ${clientId}: ${error.message}`);
    return data || [];
}

export async function createTrackedQuery({
    client_id,
    query_text,
    category,
    discovery_mode,
    locale,
    query_type,
    is_active,
    prompt_origin,
    intent_family,
    query_type_v2,
    funnel_stage,
    geo_scope,
    brand_scope,
    comparison_scope,
    quality_status,
    quality_score,
    quality_reasons,
    prompt_metadata,
}) {
    const row = prepareTrackedQueryWrite({
        client_id,
        query_text,
        category,
        ...(discovery_mode !== undefined ? { discovery_mode } : {}),
        locale,
        query_type,
        is_active: is_active !== false,
        ...(prompt_origin !== undefined ? { prompt_origin } : {}),
        ...(intent_family !== undefined ? { intent_family } : {}),
        ...(query_type_v2 !== undefined ? { query_type_v2 } : {}),
        ...(funnel_stage !== undefined ? { funnel_stage } : {}),
        ...(geo_scope !== undefined ? { geo_scope } : {}),
        ...(brand_scope !== undefined ? { brand_scope } : {}),
        ...(comparison_scope !== undefined ? { comparison_scope } : {}),
        ...(quality_status !== undefined ? { quality_status } : {}),
        ...(quality_score !== undefined ? { quality_score } : {}),
        ...(quality_reasons !== undefined ? { quality_reasons } : {}),
        ...(prompt_metadata !== undefined ? { prompt_metadata } : {}),
    });

    const { data, error } = await db().from('tracked_queries').insert(row).select().single();
    if (!error) return data;

    if (isTrackedQueryConstraintDriftError(error)) {
        const legacyRow = mapTrackedQueryWriteToLegacy(row);
        console.warn(
            '[DB] createTrackedQuery: tracked_queries category/query_type constraint drift detected. Retrying with legacy mapping; apply latest Supabase migrations.'
        );

        const { data: retryData, error: retryError } = await db().from('tracked_queries').insert(legacyRow).select().single();
        if (!retryError) return retryData;

        throw createDbError('createTrackedQuery', retryError, {
            isTrackedQueryConstraintDrift: true,
            trackedQueryConstraintDriftInitialError: error.message,
        });
    }

    throw createDbError('createTrackedQuery', error);
}

export async function getTrackedQueriesAll(clientId) {
    const { data, error } = await db()
        .from('tracked_queries')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`[DB] getTrackedQueriesAll ${clientId}: ${error.message}`);
    return data || [];
}

export async function updateTrackedQuery(id, updates) {
    let normalizedUpdates = updates;

    if (updates.category !== undefined || updates.query_type !== undefined || updates.query_text !== undefined || updates.locale !== undefined) {
        const { data: existing, error: existingError } = await db().from('tracked_queries').select('*').eq('id', id).single();
        if (existingError) throw new Error(`[DB] updateTrackedQuery ${id}: ${existingError.message}`);
        normalizedUpdates = prepareTrackedQueryWrite(updates, existing);
    }

    const { data, error } = await db().from('tracked_queries').update(normalizedUpdates).eq('id', id).select().single();
    if (!error) return data;

    if (isTrackedQueryConstraintDriftError(error)) {
        const legacyUpdates = mapTrackedQueryWriteToLegacy(normalizedUpdates);
        console.warn(
            `[DB] updateTrackedQuery ${id}: tracked_queries category/query_type constraint drift detected. Retrying with legacy mapping; apply latest Supabase migrations.`
        );

        const { data: retryData, error: retryError } = await db().from('tracked_queries').update(legacyUpdates).eq('id', id).select().single();
        if (!retryError) return retryData;

        throw createDbError(`updateTrackedQuery ${id}`, retryError, {
            isTrackedQueryConstraintDrift: true,
            trackedQueryConstraintDriftInitialError: error.message,
        });
    }

    throw createDbError(`updateTrackedQuery ${id}`, error);
}

export async function deleteTrackedQuery(id) {
    const { error } = await db().from('tracked_queries').delete().eq('id', id);
    if (error) throw new Error(`[DB] deleteTrackedQuery ${id}: ${error.message}`);
}
