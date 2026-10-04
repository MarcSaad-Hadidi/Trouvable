import 'server-only';

import { LIFECYCLE_SERVICEABLE_STATES } from '@/lib/lifecycle';
import { syncClientProfileCompatibilityFields } from '@/lib/client-profile';
import { db } from '@/lib/db/core';

export async function getClientById(id) {
    const { data, error } = await db().from('client_geo_profiles').select('*').eq('id', id).single();
    if (error?.code === 'PGRST116') throw new Error(`[DB/clients] Client introuvable: ${id}`);
    if (error) throw new Error(`[DB/clients] getClientById ${id}: ${error.message}`);
    return data;
}

/** Identity used to resolve search properties and distinguish brand queries. */
export async function getClientSearchIdentity(id) {
    const { data, error } = await db()
        .from('client_geo_profiles')
        .select('client_name, website_url')
        .eq('id', id)
        .maybeSingle();
    if (error) throw new Error(`[DB/clients] getClientSearchIdentity ${id}: ${error.message}`);
    return {
        clientName: String(data?.client_name || '').trim(),
        websiteUrl: String(data?.website_url || '').trim(),
    };
}

export async function listClientsWithSiteUrl({ includeArchived = false } = {}) {
    let query = db()
        .from('client_geo_profiles')
        .select('id, client_name, client_slug, website_url, archived_at, updated_at')
        .not('website_url', 'is', null)
        .neq('website_url', '')
        .order('updated_at', { ascending: false });

    if (!includeArchived) {
        query = query.is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[DB/clients] listClientsWithSiteUrl: ${error.message}`);
    return data || [];
}

export async function listActiveClientIds() {
    const { data, error } = await db()
        .from('client_geo_profiles')
        .select('id')
        .in('lifecycle_status', LIFECYCLE_SERVICEABLE_STATES)
        .order('updated_at', { ascending: false });

    if (error) throw new Error(`[DB/clients] listActiveClientIds: ${error.message}`);
    return (data || []).map((row) => row.id).filter(Boolean);
}

export async function updateClient(id, updates) {
    const normalizedUpdates = syncClientProfileCompatibilityFields(updates);
    const { data, error } = await db().from('client_geo_profiles').update(normalizedUpdates).eq('id', id).select().single();
    if (error) throw new Error(`[DB/clients] updateClient ${id}: ${error.message}`);
    return data;
}

export async function getClientBySlug(slug) {
    const { data, error } = await db().from('client_geo_profiles').select('*').eq('client_slug', slug).single();
    if (error && error.code !== 'PGRST116') throw new Error(`[DB] Client slug ${slug}: ${error.message}`);
    return data || null;
}

export async function listClients(options = {}) {
    const { includeArchived = false } = options;
    let q = db().from('client_geo_profiles').select('*').order('updated_at', { ascending: false });
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
    const { data, error } = await db().from('client_geo_profiles').insert(row).select().single();
    if (error) throw new Error(`[DB] createClient: ${error.message}`);
    return data;
}

export async function archiveClient(id) {
    const { data, error } = await db()
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
    const { data, error } = await db()
        .from('client_geo_profiles')
        .update({ archived_at: null, lifecycle_status: 'active' })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(`[DB] restoreClient: ${error.message}`);
    return data;
}

export async function deleteClientHard(id) {
    const { error } = await db().from('client_geo_profiles').delete().eq('id', id);
    if (error) throw new Error(`[DB] deleteClientHard: ${error.message}`);
}
