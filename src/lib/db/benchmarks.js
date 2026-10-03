import 'server-only';

import { db } from '@/lib/db/core';

export async function createBenchmarkSession(payload) {
    const { data, error } = await db()
        .from('benchmark_sessions')
        .insert(payload)
        .select('*')
        .single();
    if (error) throw new Error(`[DB] createBenchmarkSession: ${error.message}`);
    return data;
}

export async function updateBenchmarkSession(id, updates) {
    const { data, error } = await db()
        .from('benchmark_sessions')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw new Error(`[DB] updateBenchmarkSession ${id}: ${error.message}`);
    return data;
}

export async function getBenchmarkSessionById(id) {
    const { data, error } = await db()
        .from('benchmark_sessions')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw new Error(`[DB] getBenchmarkSessionById ${id}: ${error.message}`);
    return data;
}

export async function getBenchmarkSessionsForClient(clientId, limit = 8) {
    const { data, error } = await db()
        .from('benchmark_sessions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`[DB] getBenchmarkSessionsForClient ${clientId}: ${error.message}`);
    return data || [];
}
