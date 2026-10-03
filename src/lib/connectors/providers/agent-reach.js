import 'server-only';

import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * Returns the persisted community snapshot for a client from DB tables.
 * Used by the connector overview to surface agent_reach status alongside ga4/gsc.
 */
export async function getAgentReachSnapshotFromDb({ connection, clientId }) {
    const status = connection?.status || 'not_connected';

    if (status === 'not_connected') {
        return {
            provider: 'agent_reach',
            status: 'not_connected',
            hasRealData: false,
            mode: 'not_connected',
            message: 'Agent Reach non connecté.',
            documents_count: 0,
            clusters_count: 0,
            opportunities_count: 0,
            last_run: null,
        };
    }

    try {
        const supabase = getAdminSupabase();

        const [docsResult, clustersResult, opportunitiesResult, lastRunResult] = await Promise.all([
            supabase
                .from('community_documents')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', clientId),
            supabase
                .from('community_clusters')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', clientId),
            supabase
                .from('community_opportunities')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', clientId)
                .eq('status', 'open'),
            supabase
                .from('community_collection_runs')
                .select('id, source, status, started_at, finished_at, documents_collected, documents_persisted')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        const documents_count = docsResult.count || 0;
        const clusters_count = clustersResult.count || 0;
        const opportunities_count = opportunitiesResult.count || 0;
        const hasRealData = documents_count > 0 || clusters_count > 0;

        let message;
        if (status === 'disabled') {
            message = 'Agent Reach désactivé.';
        } else if (status === 'sample_mode') {
            message = 'Agent Reach en mode échantillon.';
        } else if (status === 'error') {
            message = connection?.last_error || 'Agent Reach en erreur.';
        } else if (hasRealData) {
            message = `${documents_count} documents, ${clusters_count} clusters, ${opportunities_count} opportunités.`;
        } else {
            message = 'Agent Reach configuré. Aucune donnée collectée.';
        }

        return {
            provider: 'agent_reach',
            status,
            hasRealData,
            mode: hasRealData ? 'real' : status,
            message,
            documents_count,
            clusters_count,
            opportunities_count,
            last_run: lastRunResult.data || null,
        };
    } catch (err) {
        return {
            provider: 'agent_reach',
            status: 'error',
            hasRealData: false,
            mode: 'error',
            message: err?.message || 'Erreur lors de la lecture Agent Reach.',
            documents_count: 0,
            clusters_count: 0,
            opportunities_count: 0,
            last_run: null,
        };
    }
}
