import 'server-only';

import { db } from '@/lib/db/core';

export async function upsertVisibilityMetricSnapshot(payload) {
    const { data, error } = await db()
        .from('visibility_metric_snapshots')
        .upsert(payload, { onConflict: 'client_id,snapshot_date' })
        .select('*')
        .single();

    if (error) throw new Error(`[DB/snapshots] upsertVisibilityMetricSnapshot: ${error.message}`);
    return data;
}

export async function listVisibilityMetricSnapshots(clientId, limit = 120) {
    const { data, error } = await db()
        .from('visibility_metric_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .order('snapshot_date', { ascending: true })
        .limit(limit);

    if (error) throw new Error(`[DB/snapshots] listVisibilityMetricSnapshots: ${error.message}`);
    return data || [];
}
