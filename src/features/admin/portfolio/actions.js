'use server';

import { getAdminSupabase } from '@/lib/supabase-admin';
import { syncClientProfileCompatibilityFields } from '@/lib/client-profile';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { logAction } from '@/lib/db/actions';
import { z } from 'zod';
import { validateTransition, LIFECYCLE_META, LIFECYCLE_SERVICEABLE_STATES } from '@/lib/lifecycle';

export async function togglePublishAction(id, currentStatus) {
    // 0. Input validation
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
        console.error('[Admin TogglePublish Error] Invalid UUID.');
        return { error: 'Invalid profile ID.' };
    }

    // 1. Mandatory Security Check
    const admin = await requireAdmin();
    if (!admin) {
        console.error('[Admin TogglePublish Error] Unauthorized action attempt.');
        return { error: 'Non autorisé.' };
    }

    // 2. Database Action — use sync function for consistency
    const supabase = getAdminSupabase();
    const nextPublished = !currentStatus;

    // Server-side lifecycle guard: only active/paused clients can be published.
    // Unpublishing is always allowed (safety valve).
    if (nextPublished) {
        const { data: client, error: fetchErr } = await supabase
            .from('client_geo_profiles')
            .select('lifecycle_status')
            .eq('id', id)
            .single();
        if (fetchErr || !client) return { error: 'Client introuvable.' };
        const lifecycle = client.lifecycle_status || 'prospect';
        if (!LIFECYCLE_SERVICEABLE_STATES.includes(lifecycle)) {
            return { error: `Publication bloquée : état du cycle de vie « ${lifecycle} ».` };
        }
    }

    const payload = syncClientProfileCompatibilityFields({
        publication_status: nextPublished ? 'published' : 'draft',
    });

    const { error } = await supabase.from('client_geo_profiles').update(payload).eq('id', id);

    if (error) {
        console.error('[Admin TogglePublish Error]', error);
        return { error: 'Failed to update publish status.' };
    }

    await logAction({
        client_id: id,
        action_type: 'publication_state_changed',
        details: {
            is_published: nextPublished,
            publication_status: nextPublished ? 'published' : 'draft',
            source: 'clients_list_toggle',
        },
        performed_by: admin.email,
    });

    // Refresh the table UI
    revalidatePath('/admin/clients');
    revalidatePath('/admin/clients');
    return { success: true };
}

const lifecycleTransitionSchema = z.object({
    clientId: z.string().uuid(),
    targetState: z.string().min(1),
});

export async function transitionLifecycleAction(clientId, targetState) {
    const parsed = lifecycleTransitionSchema.safeParse({ clientId, targetState });
    if (!parsed.success) {
        return { error: 'Paramètres invalides.' };
    }

    const admin = await requireAdmin();
    if (!admin) {
        return { error: 'Non autorisé.' };
    }

    const supabase = getAdminSupabase();

    // Fetch current lifecycle_status
    const { data: client, error: fetchErr } = await supabase
        .from('client_geo_profiles')
        .select('id, lifecycle_status')
        .eq('id', parsed.data.clientId)
        .single();

    if (fetchErr || !client) {
        return { error: 'Client introuvable.' };
    }

    const currentState = client.lifecycle_status || 'prospect';

    // Validate transition via canonical state machine
    try {
        validateTransition(currentState, parsed.data.targetState);
    } catch {
        return { error: `Transition refusée : ${currentState} → ${parsed.data.targetState}` };
    }

    // Build update payload
    const updates = { lifecycle_status: parsed.data.targetState };

    // Sync archived_at for archive/restore coherence
    if (parsed.data.targetState === 'archived') {
        updates.archived_at = new Date().toISOString();
    } else if (currentState === 'archived') {
        updates.archived_at = null;
    }

    const { error: updateErr } = await supabase
        .from('client_geo_profiles')
        .update(updates)
        .eq('id', parsed.data.clientId);

    if (updateErr) {
        console.error('[transitionLifecycleAction]', updateErr);
        return { error: 'Erreur lors de la mise à jour.' };
    }

    const fromLabel = LIFECYCLE_META[currentState]?.label || currentState;
    const toLabel = LIFECYCLE_META[parsed.data.targetState]?.label || parsed.data.targetState;

    await logAction({
        client_id: parsed.data.clientId,
        action_type: 'lifecycle_transition',
        details: {
            from: currentState,
            to: parsed.data.targetState,
            fromLabel,
            toLabel,
        },
        performed_by: admin.email,
    });

    revalidatePath('/admin/clients');
    revalidatePath(`/admin/clients/${parsed.data.clientId}`);
    return { success: true, from: currentState, to: parsed.data.targetState };
}
