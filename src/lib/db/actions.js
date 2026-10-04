import 'server-only';

import { db } from '@/lib/db/core';

export async function logAction({ client_id, action_type, details, performed_by }) {
    const { error } = await db().from('actions').insert({ client_id, action_type, details, performed_by });
    if (error) console.error(`[DB] logAction: ${error.message}`);
}

export async function getActions(clientId, actionTypes = [], limit = 25) {
    let query = db()
        .from('actions')
        .select('id, client_id, action_type, details, performed_by, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (Array.isArray(actionTypes) && actionTypes.length > 0) {
        query = query.in('action_type', actionTypes);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[DB] getActions ${clientId}: ${error.message}`);
    return data || [];
}
