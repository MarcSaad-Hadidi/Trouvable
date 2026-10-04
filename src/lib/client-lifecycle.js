import 'server-only';

import { clientIdSchema } from '@/lib/admin-schemas';
import { archiveClient, restoreClient } from '@/lib/db/clients';
import { logAction } from '@/lib/db/actions';
import { validateTransition } from '@/lib/lifecycle';
import { getAdminSupabase } from '@/lib/supabase-admin';

const CLIENT_TRANSITIONS = {
    archived: { fallback: 'prospect', persist: archiveClient, action: 'client_archived' },
    active: { fallback: 'archived', persist: restoreClient, action: 'client_restored' },
};

export async function parseClientLifecycleRequest(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return { body: { error: 'JSON invalide' }, status: 400 };
    }
    const validation = clientIdSchema.safeParse(body);
    if (!validation.success) {
        return { body: { error: 'Validation', details: validation.error.issues }, status: 400 };
    }
    return { clientId: validation.data.clientId };
}

export async function changeClientLifecycle(clientId, targetState, performedBy) {
    const transition = CLIENT_TRANSITIONS[targetState];
    const { data: current, error: fetchErr } = await getAdminSupabase()
        .from('client_geo_profiles')
        .select('lifecycle_status')
        .eq('id', clientId)
        .single();
    if (fetchErr || !current) {
        return { body: { error: 'Client introuvable.' }, status: 404 };
    }
    const fromState = current.lifecycle_status || transition.fallback;
    try {
        validateTransition(fromState, targetState);
    } catch (err) {
        return { body: { error: err.message }, status: 422 };
    }
    const client = await transition.persist(clientId);
    await logAction({
        client_id: clientId,
        action_type: transition.action,
        details: { from: fromState, to: targetState },
        performed_by: performedBy,
    });
    return { body: { success: true, client }, status: 200 };
}
