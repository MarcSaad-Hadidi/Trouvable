import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { mergeApplyPayloadSchema } from '@/lib/ai/schemas';
import { getMergeSuggestionById as dbGetMergeSuggestionById, updateMergeSuggestion as dbUpdateMergeSuggestion } from '@/lib/db/merge-suggestions';
import { logAction as dbLogAction } from '@/lib/db/actions';

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
        if (suggestion.status !== 'pending') {
            return NextResponse.json({ error: `Suggestion déjà traitée` }, { status: 409 });
        }

        await dbUpdateMergeSuggestion(mergeSuggestionId, { status: 'rejected' });

        await dbLogAction({
            client_id: suggestion.client_id,
            action_type: 'merge_rejected',
            details: { merge_suggestion_id: mergeSuggestionId, field_name: suggestion.field_name },
            performed_by: admin.email,
        });

        return NextResponse.json({ success: true, field: suggestion.field_name });
    } catch (err) {
        console.error('[API/merge/reject] Erreur:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
