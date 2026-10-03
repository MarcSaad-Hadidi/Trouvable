import 'server-only';

import { db } from '@/lib/db/core';

export async function getLatestAudit(clientId) {
    const { data, error } = await db()
        .from('client_site_audits')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error && error.code !== 'PGRST116') throw new Error(`[DB] latestAudit ${clientId}: ${error.message}`);
    return data || null;
}

export async function getLatestAuditByUrl(sourceUrl) {
    if (!sourceUrl) return null;
    const normalized = sourceUrl.replace(/\/+$/, '').toLowerCase();
    const { data, error } = await db()
        .from('client_site_audits')
        .select('*')
        .or(`source_url.ilike.${normalized},source_url.ilike.${normalized}/,resolved_url.ilike.${normalized},resolved_url.ilike.${normalized}/`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error(`[DB] getLatestAuditByUrl ${sourceUrl}: ${error.message}`);
        return null;
    }
    return data || null;
}

export async function createAuditRun(auditData) {
    const { data, error } = await db().from('client_site_audits').insert(auditData).select().single();
    if (error) throw new Error(`[DB] createAuditRun: ${error.message}`);
    return data;
}

export async function updateAuditRun(id, updates) {
    const { data, error } = await db().from('client_site_audits').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`[DB] updateAuditRun ${id}: ${error.message}`);
    return data;
}

export async function getRecentAudits(clientId, limit = 5) {
    const { data, error } = await db()
        .from('client_site_audits')
        .select('id, scan_status, seo_score, geo_score, created_at, error_message, issues, strengths')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`[DB] getRecentAudits: ${error.message}`);
    return data || [];
}
