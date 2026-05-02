import 'server-only';

import * as db from '@/lib/db';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

function excerptFromRun(run) {
    const raw = String(run.response_text || run.raw_response_full || '').trim();
    if (raw) return raw.length > 380 ? `${raw.slice(0, 380)}…` : raw;
    const pr = run.parsed_response;
    if (pr && typeof pr === 'object') {
        for (const key of ['answer_excerpt', 'summary', 'answer', 'text', 'snippet']) {
            const v = pr[key];
            if (typeof v === 'string' && v.trim()) {
                const t = v.trim();
                return t.length > 380 ? `${t.slice(0, 380)}…` : t;
            }
        }
    }
    return null;
}

export async function getGeoResponsesSlice(clientId) {
    const runs = await db.getQueryRunsResponseBrowser(clientId, 120).catch((err) => {
        console.error(`[geo-responses] ${clientId}`, err);
        return [];
    });

    const items = (runs || []).map((run) => ({
        id: run.id,
        tracked_query_id: run.tracked_query_id ?? null,
        query_text: run.query_text || '—',
        provider: run.provider,
        model: run.model,
        status: run.status,
        parse_status: run.parse_status,
        target_found: run.target_found === true,
        created_at: run.created_at,
        excerpt: excerptFromRun(run),
        has_response_body: Boolean(String(run.response_text || run.raw_response_full || '').trim()),
    }));

    return {
        provenance: {
            observed: getProvenanceMeta('observed'),
        },
        items,
        links: {
            runs: `/admin/clients/${clientId}/geo/runs`,
            prompts: `/admin/clients/${clientId}/geo/prompts`,
        },
        emptyState: items.length === 0 ? {
            title: 'Aucune réponse exploitable',
            description:
                'Les exécutions avec texte de réponse apparaîtront ici. Lancez des runs depuis Prompts ou Exécutions.',
        } : null,
    };
}
