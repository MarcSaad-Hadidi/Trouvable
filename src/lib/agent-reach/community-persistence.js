import 'server-only';
import {
    getOpportunitiesBySource as dbGetOpportunitiesBySource,
    createOpportunities as dbCreateOpportunities,
} from '@/lib/db/opportunities';
import { upsertOpportunities } from '@/lib/db/community';

// ──────────────────────────────────────────────────────────────
// Internal helper — fetch all mentions for re-clustering
// ──────────────────────────────────────────────────────────────

export async function listMentionsForClustering(clientId) {
    const { getAdminSupabase } = await import('@/lib/supabase-admin');
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_mentions')
        .select('mention_type, label, snippet, source')
        .eq('client_id', clientId);
    if (error) throw new Error(`[Community] listMentionsForClustering: ${error.message}`);
    return data || [];
}

export async function persistCommunityOpportunities(opportunities, clientId) {
    if (opportunities.length > 0) {
        await upsertOpportunities(opportunities);

        // Bridge: insert/update into main opportunities table so they appear
        // in the operator action queue (GeoAmeliorerView / File d'actions).
        // Dedup: use title + client_id + source=community to avoid duplicates.
        const mainOpps = opportunities.map((o) => ({
            client_id: o.client_id,
            title: o.title,
            description: o.rationale || '',
            category: o.opportunity_type || 'community',
            priority: o.evidence_level === 'strong' ? 'high' : o.evidence_level === 'medium' ? 'medium' : 'low',
            status: 'open',
            source: 'community',
            confidence: o.evidence_level || 'low',
            truth_class: o.provenance || 'inferred',
        }));

        // Fetch existing community opportunities for this client to avoid fire-and-forget duplication
        try {
            const existingOpps = await dbGetOpportunitiesBySource(clientId, 'community').catch(() => []);
            const existingTitles = new Set((existingOpps || []).map((e) => e.title));
            const newOpps = mainOpps.filter((o) => !existingTitles.has(o.title));

            if (newOpps.length > 0) {
                await dbCreateOpportunities(newOpps).catch((bridgeErr) => {
                    console.error(
                        '[Community→Opportunities bridge] Failed to insert into main opportunities table:',
                        bridgeErr?.message,
                    );
                });
            }
        } catch {
            // Fallback: if dedup check fails, insert all (backward compatible)
            await dbCreateOpportunities(mainOpps).catch((bridgeErr) => {
                console.error(
                    '[Community→Opportunities bridge] Failed to insert into main opportunities table:',
                    bridgeErr?.message,
                );
            });
        }
    }
}
