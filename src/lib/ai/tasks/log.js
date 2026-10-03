import 'server-only';

import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * Inserts a new AI task run log entry.
 * Returns the created row (with id).
 */
export async function insertTaskRun(payload) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('ai_task_runs')
        .insert(payload)
        .select('id, task_id, status, created_at')
        .single();
    if (error) throw new Error(`[AI/TaskLog] insertTaskRun: ${error.message}`);
    return data;
}

/**
 * Updates an existing AI task run log entry.
 */
export async function updateTaskRun(runId, updates) {
    const supabase = getAdminSupabase();
    const { error } = await supabase
        .from('ai_task_runs')
        .update(updates)
        .eq('id', runId);
    if (error) throw new Error(`[AI/TaskLog] updateTaskRun: ${error.message}`);
}

/**
 * Lists recent task runs for a client, optionally filtered by task_id.
 */
export async function listTaskRuns(clientId, { taskId = null, limit = 20 } = {}) {
    const supabase = getAdminSupabase();
    let query = supabase
        .from('ai_task_runs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (taskId) query = query.eq('task_id', taskId);
    const { data, error } = await query;
    if (error) throw new Error(`[AI/TaskLog] listTaskRuns: ${error.message}`);
    return data || [];
}
