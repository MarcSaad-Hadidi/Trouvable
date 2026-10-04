import 'server-only';

import { db as sb } from '@/lib/db/core';
import { validateClientAuditReferences } from './reference-validation.js';

export async function getMergeSuggestions(clientId, status = null) {
    let q = sb().from('merge_suggestions').select('*').eq('client_id', clientId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new Error(`[DB] mergeSuggestions ${clientId}: ${error.message}`);
    return data || [];
}

export async function archiveOldMergeSuggestionsExceptAudit(clientId, auditId) {
    let query = sb()
        .from('merge_suggestions')
        .update({ status: 'rejected' })
        .eq('client_id', clientId)
        .eq('status', 'pending');

    if (auditId) {
        query = query.or(`audit_id.is.null,audit_id.neq.${auditId}`);
    }

    const { error } = await query;
    if (error) console.error(`[DB] archiveOldMergeSuggestionsExceptAudit: ${error.message}`);
}

export async function createMergeSuggestions(suggestions) {
    if (!suggestions.length) return [];
    await validateClientAuditReferences(suggestions, 'createMergeSuggestions');
    const { data, error } = await sb().from('merge_suggestions').insert(suggestions).select();
    if (error) {
        if (error.code === '23503' && typeof error.details === 'string' && error.details.includes('table "clients"')) {
            throw new Error(
                '[DB] createMergeSuggestions: live merge_suggestions.client_id foreign key still points to legacy table "clients". Apply the foreign-key repair migration before rerunning the audit.',
            );
        }
        throw new Error(`[DB] createMergeSuggestions: ${error.message}`);
    }
    return data || [];
}

export async function getMergeSuggestionById(id) {
    const { data, error } = await sb().from('merge_suggestions').select('*').eq('id', id).single();
    if (error) throw new Error(`[DB] mergeSuggestion ${id}: ${error.message}`);
    return data;
}

export async function updateMergeSuggestion(id, updates) {
    const { data, error } = await sb().from('merge_suggestions').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`[DB] updateMergeSuggestion ${id}: ${error.message}`);
    return data;
}
