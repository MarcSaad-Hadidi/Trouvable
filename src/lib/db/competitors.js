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
