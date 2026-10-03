import 'server-only';

import { getAdminSupabase } from '@/lib/supabase-admin';

// ──────────────────────────────────────────────────────────────
// Collection runs
// ──────────────────────────────────────────────────────────────

export async function insertCollectionRun(payload) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_collection_runs')
        .insert(payload)
        .select('*')
        .single();
    if (error) throw new Error(`[Community] insertCollectionRun: ${error.message}`);
    return data;
}

export async function updateCollectionRun(runId, updates) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_collection_runs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', runId)
        .select('*')
        .single();
    if (error) throw new Error(`[Community] updateCollectionRun: ${error.message}`);
    return data;
}

export async function getLatestCollectionRun(clientId, source = null) {
    const supabase = getAdminSupabase();
    let query = supabase
        .from('community_collection_runs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1);
    if (source) query = query.eq('source', source);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`[Community] getLatestCollectionRun: ${error.message}`);
    return data;
}

export async function listCollectionRuns(clientId, { limit = 20 } = {}) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_collection_runs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`[Community] listCollectionRuns: ${error.message}`);
    return data || [];
}

// ──────────────────────────────────────────────────────────────
// Documents
// ──────────────────────────────────────────────────────────────

export async function upsertDocuments(documents) {
    if (!documents?.length) return { persisted: 0, skipped: 0 };
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_documents')
        .upsert(documents, { onConflict: 'client_id,source,dedupe_hash', ignoreDuplicates: true })
        .select('id');
    if (error) throw new Error(`[Community] upsertDocuments: ${error.message}`);
    const persisted = data?.length || 0;
    return { persisted, skipped: documents.length - persisted };
}

export async function listDocuments(clientId, { source = null, limit = 100, unprocessedOnly = false } = {}) {
    const supabase = getAdminSupabase();
    let query = supabase
        .from('community_documents')
        .select('*')
        .eq('client_id', clientId)
        .order('collected_at', { ascending: false })
        .limit(limit);
    if (source) query = query.eq('source', source);
    if (unprocessedOnly) query = query.eq('is_processed', false);
    const { data, error } = await query;
    if (error) throw new Error(`[Community] listDocuments: ${error.message}`);
    return data || [];
}

export async function markDocumentsProcessed(documentIds) {
    if (!documentIds?.length) return;
    const supabase = getAdminSupabase();
    const { error } = await supabase
        .from('community_documents')
        .update({ is_processed: true, updated_at: new Date().toISOString() })
        .in('id', documentIds);
    if (error) throw new Error(`[Community] markDocumentsProcessed: ${error.message}`);
}

export async function countDocuments(clientId) {
    const supabase = getAdminSupabase();
    const { count, error } = await supabase
        .from('community_documents')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
    if (error) throw new Error(`[Community] countDocuments: ${error.message}`);
    return count || 0;
}

// ──────────────────────────────────────────────────────────────
// Mentions
// ──────────────────────────────────────────────────────────────

export async function insertMentions(mentions) {
    if (!mentions?.length) return [];
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_mentions')
        .insert(mentions)
        .select('id');
    if (error) throw new Error(`[Community] insertMentions: ${error.message}`);
    return data || [];
}

export async function listMentions(clientId, { mentionType = null, limit = 200 } = {}) {
    const supabase = getAdminSupabase();
    let query = supabase
        .from('community_mentions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (mentionType) query = query.eq('mention_type', mentionType);
    const { data, error } = await query;
    if (error) throw new Error(`[Community] listMentions: ${error.message}`);
    return data || [];
}

export async function deleteMentionsForDocuments(documentIds) {
    if (!documentIds?.length) return;
    const supabase = getAdminSupabase();
    const { error } = await supabase
        .from('community_mentions')
        .delete()
        .in('document_id', documentIds);
    if (error) throw new Error(`[Community] deleteMentionsForDocuments: ${error.message}`);
}

// ──────────────────────────────────────────────────────────────
// Clusters
// ──────────────────────────────────────────────────────────────

export async function upsertClusters(clusters) {
    if (!clusters?.length) return [];
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_clusters')
        .upsert(clusters, { onConflict: 'client_id,cluster_type,label' })
        .select('*');
    if (error) throw new Error(`[Community] upsertClusters: ${error.message}`);
    return data || [];
}

export async function listClusters(clientId, { clusterType = null, limit = 100 } = {}) {
    const supabase = getAdminSupabase();
    let query = supabase
        .from('community_clusters')
        .select('*')
        .eq('client_id', clientId)
        .order('score', { ascending: false })
        .limit(limit);
    if (clusterType) query = query.eq('cluster_type', clusterType);
    const { data, error } = await query;
    if (error) throw new Error(`[Community] listClusters: ${error.message}`);
    return data || [];
}

export async function clearClusters(clientId) {
    const supabase = getAdminSupabase();
    const { error } = await supabase
        .from('community_clusters')
        .delete()
        .eq('client_id', clientId);
    if (error) throw new Error(`[Community] clearClusters: ${error.message}`);
}

// ──────────────────────────────────────────────────────────────
// Opportunities
// ──────────────────────────────────────────────────────────────

export async function upsertOpportunities(opportunities) {
    if (!opportunities?.length) return [];
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_opportunities')
        .upsert(opportunities, { onConflict: 'id' })
        .select('*');
    if (error) throw new Error(`[Community] upsertOpportunities: ${error.message}`);
    return data || [];
}

export async function listOpportunities(clientId, { opportunityType = null, status = 'open', limit = 50 } = {}) {
    const supabase = getAdminSupabase();
    let query = supabase
        .from('community_opportunities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (opportunityType) query = query.eq('opportunity_type', opportunityType);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(`[Community] listOpportunities: ${error.message}`);
    return data || [];
}

export async function updateOpportunityStatus(opportunityId, status) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_opportunities')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', opportunityId)
        .select('*')
        .single();
    if (error) throw new Error(`[Community] updateOpportunityStatus: ${error.message}`);
    return data;
}

// ──────────────────────────────────────────────────────────────
// Aggregate stats for social slice
// ──────────────────────────────────────────────────────────────

export async function getCommunityStats(clientId) {
    const supabase = getAdminSupabase();

    const [docsResult, clustersResult, opportunitiesResult, mentionsResult] = await Promise.all([
        supabase.from('community_documents').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('community_clusters').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('community_opportunities').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'open'),
        supabase.from('community_mentions').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    ]);

    return {
        documents: docsResult.count || 0,
        clusters: clustersResult.count || 0,
        opportunities: opportunitiesResult.count || 0,
        mentions: mentionsResult.count || 0,
    };
}
