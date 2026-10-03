import 'server-only';

import { db } from '@/lib/db/core';

export async function getCompetitorAliases(clientId, activeOnly = true) {
    let query = db()
        .from('competitor_aliases')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[DB] getCompetitorAliases ${clientId}: ${error.message}`);
    return data || [];
}

export async function upsertCompetitorAliases(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const { data, error } = await db()
        .from('competitor_aliases')
        .upsert(rows, { onConflict: 'client_id,alias' })
        .select('*');
    if (error) throw new Error(`[DB] upsertCompetitorAliases: ${error.message}`);
    return data || [];
}
