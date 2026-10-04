import 'server-only';

import { db } from '@/lib/db/core';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function upsertGscSearchAnalyticsRows(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const { data, error } = await db()
        .from('gsc_search_analytics')
        .upsert(rows, { onConflict: 'client_id,date,query,page' })
        .select('id, client_id, date, query, page, clicks, impressions, ctr, position');

    if (error) {
        throw new Error(`[DB/gsc] upsertGscSearchAnalyticsRows: ${error.message}`);
    }

    return data || [];
}

export async function getRecentGscRows(clientId, { days = 28, limit = 500 } = {}) {
    const supabase = getAdminSupabase();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('gsc_search_analytics')
        .select('query, page, clicks, impressions, ctr, position, date')
        .eq('client_id', clientId)
        .gte('date', since)
        .order('clicks', { ascending: false })
        .limit(limit);

    if (error) {
        throw new Error(`[DB/gsc] getRecentGscRows: ${error.message}`);
    }

    return data || [];
}
