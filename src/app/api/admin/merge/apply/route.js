import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { mergeApplyPayloadSchema } from '@/lib/ai/schemas';
import {
    getMergeSuggestionById as dbGetMergeSuggestionById,
    updateMergeSuggestion as dbUpdateMergeSuggestion,
} from '@/lib/db/merge-suggestions';
import { getClientById as dbGetClientById, updateClient as dbUpdateClient } from '@/lib/db/clients';
import { logAction as dbLogAction } from '@/lib/db/actions';

const FIELD_TO_COLUMN_MAP = {
    phone: { table: 'contact_info', key: 'phone' },
    public_email: { table: 'contact_info', key: 'public_email' },
    email: { table: 'contact_info', key: 'public_email' },
    short_desc: { table: 'business_details', key: 'short_desc' },
    short_description: { table: 'business_details', key: 'short_desc' },
    services: { table: 'business_details', key: 'services' },
    areas_served: { table: 'business_details', key: 'areas_served' },
    seo_title: { column: 'seo_title' },
    seo_description: { column: 'seo_description' },
    social_profiles: { column: 'social_profiles' },
    address: { column: 'address' },
    client_name: { column: 'client_name' },
    business_type: { column: 'business_type' },
    geo_faqs: { column: 'geo_faqs' },
};

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
    }

    const validation = mergeApplyPayloadSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: 'Payload invalide', details: validation.error.issues }, { status: 400 });
    }

    const { mergeSuggestionId } = validation.data;

    try {
        const suggestion = await dbGetMergeSuggestionById(mergeSuggestionId);
        if (!suggestion) {
            return NextResponse.json({ error: 'Merge suggestion introuvable' }, { status: 404 });
        }
        if (suggestion.status === 'applied') {
            return NextResponse.json({ error: 'Suggestion déjà appliquée' }, { status: 409 });
        }

        const client = await dbGetClientById(suggestion.client_id);
        const mapping = FIELD_TO_COLUMN_MAP[suggestion.field_name];

        let value = suggestion.suggested_value;
        try {
            value = JSON.parse(value);
        } catch {
            /* keep as string */
        }

        const updates = {};

        if (mapping?.table) {
            const jsonb = { ...(client[mapping.table] || {}) };
            jsonb[mapping.key] = value;
            updates[mapping.table] = jsonb;
        } else if (mapping?.column) {
            updates[mapping.column] = value;
        } else {
            return NextResponse.json({ error: `Champ "${suggestion.field_name}" non mappé` }, { status: 400 });
        }

        await dbUpdateClient(suggestion.client_id, updates);

        await dbUpdateMergeSuggestion(mergeSuggestionId, {
            status: 'applied',
            applied_at: new Date().toISOString(),
        });

        await dbLogAction({
            client_id: suggestion.client_id,
            action_type: 'merge_applied',
            details: {
                merge_suggestion_id: mergeSuggestionId,
                field_name: suggestion.field_name,
                applied_value: value,
            },
            performed_by: admin.email,
        });

        return NextResponse.json({
            success: true,
            field: suggestion.field_name,
            applied_value: value,
        });
    } catch (err) {
        console.error('[API/merge/apply] Erreur:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
