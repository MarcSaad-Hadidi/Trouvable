import 'server-only';

import { db as sb } from '@/lib/db/core';
import { validateClientAuditReferences, uniqueNonEmptyStrings } from './reference-validation.js';
import { getLatestAudit } from './audits.js';

function compactOpportunityDebugRow(row) {
    if (!row || typeof row !== 'object') return null;
    return {
        client_id: row.client_id ?? null,
        audit_id: row.audit_id ?? null,
        title: typeof row.title === 'string' ? row.title.slice(0, 120) : null,
        priority: row.priority ?? null,
        status: row.status ?? null,
    };
}

function findInvalidClientIdRows(rows) {
    return (rows || [])
        .map((row, index) => ({ index, row }))
        .filter(({ row }) => typeof row?.client_id !== 'string' || row.client_id.trim().length === 0)
        .map(({ index, row }) => ({
            index,
            ...compactOpportunityDebugRow(row),
        }));
}

export async function getOpportunities(clientId) {
    const { data, error } = await sb()
        .from('opportunities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(`[DB] opportunities ${clientId}: ${error.message}`);
    return data || [];
}

export async function getOpportunitiesBySource(clientId, source) {
    const { data, error } = await sb()
        .from('opportunities')
        .select('id, title, status, source')
        .eq('client_id', clientId)
        .eq('source', source);
    if (error) throw new Error(`[DB] getOpportunitiesBySource ${clientId} ${source}: ${error.message}`);
    return data || [];
}

export async function archiveOldOpportunities(clientId) {
    const { error } = await sb()
        .from('opportunities')
        .update({ status: 'dismissed' })
        .eq('client_id', clientId)
        .eq('status', 'open');
    if (error) console.error(`[DB] archiveOldOpportunities: ${error.message}`);
}

export async function archiveOldOpportunitiesExceptAudit(clientId, auditId) {
    let query = sb()
        .from('opportunities')
        .update({ status: 'dismissed' })
        .eq('client_id', clientId)
        .eq('status', 'open');

    if (auditId) {
        query = query.or(`audit_id.is.null,audit_id.neq.${auditId}`);
    }

    const { error } = await query;
    if (error) console.error(`[DB] archiveOldOpportunitiesExceptAudit: ${error.message}`);
}

export async function createOpportunities(opps) {
    if (!opps.length) return [];
    const distinctClientIds = uniqueNonEmptyStrings(opps.map((row) => row.client_id));
    const invalidClientIdRows = findInvalidClientIdRows(opps);
    const compactRows = opps.slice(0, 5).map((row) => compactOpportunityDebugRow(row));

    if (invalidClientIdRows.length > 0) {
        throw new Error(`[DB] createOpportunities: invalid opportunity payload(s) missing client_id: ${JSON.stringify(invalidClientIdRows)}`);
    }

    await validateClientAuditReferences(opps, 'createOpportunities');
    const { data, error } = await sb().from('opportunities').insert(opps).select();
    if (error) {
        console.error('[DB-debug] createOpportunities insert failed', {
            distinctClientIds,
            firstRows: compactRows,
            invalidClientIdRows,
            error: {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
            },
        });
        if (error.code === '23503' && typeof error.details === 'string' && error.details.includes('table "clients"')) {
            throw new Error('[DB] createOpportunities: live opportunities.client_id foreign key still points to legacy table "clients". Apply the foreign-key repair migration before rerunning the audit.');
        }
        throw new Error(`[DB] createOpportunities: ${error.message}`);
    }
    return data || [];
}

export async function updateOpportunity(id, updates) {
    const { data, error } = await sb().from('opportunities').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`[DB] updateOpportunity ${id}: ${error.message}`);
    return data;
}

export async function getLatestOpportunities(clientId) {
    const [latestAudit, allOpps] = await Promise.all([
        getLatestAudit(clientId),
        getOpportunities(clientId),
    ]);

    const latestAuditId = latestAudit?.id ?? null;
    const active = [];
    const stale = [];

    for (const o of allOpps) {
        if (o.status !== 'open') {
            active.push(o);
        } else if (!latestAuditId || o.audit_id === latestAuditId || !o.audit_id) {
            active.push(o);
        } else {
            stale.push(o);
        }
    }

    return { active, stale, latestAuditId };
}
