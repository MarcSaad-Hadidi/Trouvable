import 'server-only';

import { getAdminSupabase } from '@/lib/supabase-admin';

export async function upsertGa4TrafficDailyRows(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('ga4_traffic_daily')
        .upsert(rows, { onConflict: 'client_id,date' })
        .select('id, client_id, date, sessions, users, new_users, page_views');

    if (error) {
        throw new Error(`[DB/ga4] upsertGa4TrafficDailyRows: ${error.message}`);
    }

    return data || [];
}

export async function upsertGa4TopPagesRows(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('ga4_top_pages')
        .upsert(rows, { onConflict: 'client_id,period_end,landing_page' })
        .select('id, client_id, period_end, landing_page, sessions, users');

    if (error) {
        throw new Error(`[DB/ga4] upsertGa4TopPagesRows: ${error.message}`);
    }

    return data || [];
}

export async function getTrafficDailyRows(clientId, { days = 28 } = {}) {
    const supabase = getAdminSupabase();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('ga4_traffic_daily')
        .select('date, sessions, users, new_users, page_views')
        .eq('client_id', clientId)
        .gte('date', since)
        .order('date', { ascending: true });

    if (error) {
        throw new Error(`[DB/ga4] getTrafficDailyRows: ${error.message}`);
    }

    return data || [];
}

export async function getTopPagesRows(clientId, { limit = 20 } = {}) {
    const supabase = getAdminSupabase();

    const { data, error } = await supabase
        .from('ga4_top_pages')
        .select('landing_page, sessions, users, period_end')
        .eq('client_id', clientId)
        .order('sessions', { ascending: false })
        .limit(limit);

    if (error) {
        throw new Error(`[DB/ga4] getTopPagesRows: ${error.message}`);
    }

    return data || [];
}
