import 'server-only';
import { getAdminSupabase } from './supabase-admin.js';
import { syncClientProfileCompatibilityFields } from './client-profile.js';
import { flattenSnapshotToLegacy } from './operator-intelligence/kpi-core.js';
import { getGeoWorkspaceSnapshot } from './operator-intelligence/snapshot.js';
import { getLatestAudit as _getLatestAudit } from './db/audits.js';

// Domain modules — canonical implementations live here.
// Callers can import directly from lib/db/<domain> for focused imports,
// or keep using lib/db for backward-compatible namespace imports.
export { getLatestAudit, getLatestAuditByUrl, createAuditRun, updateAuditRun, getRecentAudits } from './db/audits.js';
export { logAction, getActions } from './db/actions.js';
export { getCompetitorAliases, upsertCompetitorAliases } from './db/competitors.js';
export { createBenchmarkSession, updateBenchmarkSession, getBenchmarkSessionById, getBenchmarkSessionsForClient } from './db/benchmarks.js';
export { isTrackedQueryConstraintDrift } from './db/query-support.js';
export { getTrackedQueries, createTrackedQuery, getTrackedQueriesAll, updateTrackedQuery, deleteTrackedQuery } from './db/tracked-queries.js';
export {
    createQueryRun,
    updateQueryRun,
    getQueryRuns,
    countQueryRunsForClientSince,
    getQueryRunById,
    getQueryRunMentions,
    getQueryRunsHistory,
    getQueryRunsResponseBrowser,
    getCompletedQueryRuns,
    createQueryMentions,
    deleteQueryMentionsByRunId,
    getBenchmarkRunsBySession,
    getRecentQueryRuns,
    getLastRunPerTrackedQuery,
} from './db/query-runs.js';

// TODO: migrate remaining usages progressively toward lib/db/* domain modules,
// then remove this facade once all call sites are switched.

const sb = () => getAdminSupabase();

function uniqueNonEmptyStrings(values) {
    return [...new Set((values || []).filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

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

async function validateClientAuditReferences(rows, context) {
    const payloads = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (payloads.length === 0) return;

    const clientIds = uniqueNonEmptyStrings(payloads.map((row) => row.client_id));
    const auditIds = uniqueNonEmptyStrings(payloads.map((row) => row.audit_id));

    if (clientIds.length === 0) {
        throw new Error(`[DB] ${context}: missing client_id on payload(s)`);
    }

    const { data: clientRows, error: clientError } = await sb()
        .from('client_geo_profiles')
        .select('id')
        .in('id', clientIds);
    if (clientError) {
        throw new Error(`[DB] ${context}: failed to validate client_id references: ${clientError.message}`);
    }

    const existingClientIds = new Set((clientRows || []).map((row) => row.id));
    const missingClientIds = clientIds.filter((id) => !existingClientIds.has(id));
    if (missingClientIds.length > 0) {
        throw new Error(`[DB] ${context}: invalid client_id reference(s): ${missingClientIds.join(', ')}`);
    }

    if (auditIds.length === 0) return;

    const { data: auditRows, error: auditError } = await sb()
        .from('client_site_audits')
        .select('id, client_id')
        .in('id', auditIds);
    if (auditError) {
        throw new Error(`[DB] ${context}: failed to validate audit_id references: ${auditError.message}`);
    }

    const auditsById = new Map((auditRows || []).map((row) => [row.id, row]));
    const missingAuditIds = auditIds.filter((id) => !auditsById.has(id));
    if (missingAuditIds.length > 0) {
        throw new Error(`[DB] ${context}: invalid audit_id reference(s): ${missingAuditIds.join(', ')}`);
    }

    const mismatches = payloads
        .filter((row) => row.audit_id)
        .map((row, index) => {
            const audit = auditsById.get(row.audit_id);
            if (!audit || audit.client_id === row.client_id) return null;
            return `payload[${index}] audit_id=${row.audit_id} belongs to client_id=${audit.client_id}, received client_id=${row.client_id}`;
        })
        .filter(Boolean);

    if (mismatches.length > 0) {
        throw new Error(`[DB] ${context}: audit/client mismatch detected (${mismatches.join(' | ')})`);
    }
}

// ─── Clients (client_geo_profiles) ───────────────────────────────────────────

export async function getClientById(id) {
    const { data, error } = await sb().from('client_geo_profiles').select('*').eq('id', id).single();
    if (error?.code === 'PGRST116') throw new Error(`[DB] Client introuvable: ${id}`);
    if (error) throw new Error(`[DB] Client ${id}: ${error.message}`);
    return data;
}

export async function getClientBySlug(slug) {
    const { data, error } = await sb().from('client_geo_profiles').select('*').eq('client_slug', slug).single();
    if (error && error.code !== 'PGRST116') throw new Error(`[DB] Client slug ${slug}: ${error.message}`);
    return data || null;
}

export async function listClients(options = {}) {
    const { includeArchived = false } = options;
    let q = sb().from('client_geo_profiles').select('*').order('updated_at', { ascending: false });
    if (!includeArchived) {
        q = q.is('archived_at', null);
    }
    const { data, error } = await q;
    if (error) throw new Error(`[DB] listClients: ${error.message}`);
    return data || [];
}

export async function createClient({ client_name, client_slug, website_url, business_type, notes, target_region, lifecycle_status }) {
    const row = syncClientProfileCompatibilityFields({
        client_name,
        client_slug,
        website_url,
        business_type: business_type || '',
        publication_status: 'draft',
        is_published: false,
        lifecycle_status: lifecycle_status || 'prospect',
    });
    if (notes !== null && notes !== undefined) row.notes = notes;
    if (target_region !== null && target_region !== undefined) row.target_region = target_region;
    const { data, error } = await sb().from('client_geo_profiles').insert(row).select().single();
    if (error) throw new Error(`[DB] createClient: ${error.message}`);
    return data;
}

export async function updateClient(id, updates) {
    const normalizedUpdates = syncClientProfileCompatibilityFields(updates);
    const { data, error } = await sb().from('client_geo_profiles').update(normalizedUpdates).eq('id', id).select().single();
    if (error) throw new Error(`[DB] updateClient ${id}: ${error.message}`);
    return data;
}

// ─── Audits (client_site_audits) ── re-exported from lib/db/audits.js ────────

// ─── Query domain ── re-exported from lib/db/tracked-queries.js and query-runs.js

// ─── Opportunities ───────────────────────────────────────────────────────────

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

// ─── Merge Suggestions ──────────────────────────────────────────────────────

export async function getMergeSuggestions(clientId, status = null) {
    let q = sb().from('merge_suggestions').select('*').eq('client_id', clientId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new Error(`[DB] mergeSuggestions ${clientId}: ${error.message}`);
    return data || [];
}

export async function archiveOldMergeSuggestions(clientId) {
    const { error } = await sb()
        .from('merge_suggestions')
        .update({ status: 'rejected' })
        .eq('client_id', clientId)
        .eq('status', 'pending');
    if (error) console.error(`[DB] archiveOldMergeSuggestions: ${error.message}`);
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
            throw new Error('[DB] createMergeSuggestions: live merge_suggestions.client_id foreign key still points to legacy table "clients". Apply the foreign-key repair migration before rerunning the audit.');
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

// ─── Actions Log ── re-exported from lib/db/actions.js ───────────────────────

// ─── Audits / runs history ── getRecentAudits re-exported from lib/db/audits.js

// ─── Client archive / delete ────────────────────────────────────────────────

export async function archiveClient(id) {
    const { data, error } = await sb()
        .from('client_geo_profiles')
        .update({ archived_at: new Date().toISOString(), lifecycle_status: 'archived' })
        .eq('id', id)
        .is('archived_at', null)
        .select()
        .single();
    if (error) throw new Error(`[DB] archiveClient: ${error.message}`);
    return data;
}

export async function restoreClient(id) {
    const { data, error } = await sb()
        .from('client_geo_profiles')
        .update({ archived_at: null, lifecycle_status: 'active' })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(`[DB] restoreClient: ${error.message}`);
    return data;
}

export async function deleteClientHard(id) {
    const { error } = await sb().from('client_geo_profiles').delete().eq('id', id);
    if (error) throw new Error(`[DB] deleteClientHard: ${error.message}`);
}

/**
 * @deprecated Use getGeoWorkspaceSnapshot() for new code.
 * Legacy compat layer — flattens the canonical snapshot into the flat shape
 * consumed by portal-data, continuous/jobs, and getTrendSlice.
 * Will be removed once all consumers migrate to the snapshot API.
 */
export async function getClientGeoMetrics(clientId) {
    const ws = await getGeoWorkspaceSnapshot(clientId);
    const legacy = flattenSnapshotToLegacy(ws.snapshot, ws.latestAudit);
    legacy.modelPerformance = ws.modelPerformance;
    return legacy;
}

/**
 * Opportunities scoped to the latest audit only.
 * Open opportunities from older audits are flagged as stale.
 */
export async function getLatestOpportunities(clientId) {
    const [latestAudit, allOpps] = await Promise.all([
        _getLatestAudit(clientId),
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

// getLastRunPerTrackedQuery re-exported from lib/db/query-runs.js
