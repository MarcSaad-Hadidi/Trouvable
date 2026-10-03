import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { clientIdSchema } from '@/lib/admin-schemas';
import { restoreClient as dbRestoreClient } from '@/lib/db/clients';
import { logAction as dbLogAction } from '@/lib/db/actions';
import { validateTransition } from '@/lib/lifecycle';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const v = clientIdSchema.safeParse(body);
    if (!v.success) {
        return NextResponse.json({ error: 'Validation', details: v.error.issues }, { status: 400 });
    }

    try {
        const supabase = getAdminSupabase();
        const { data: current, error: fetchErr } = await supabase
            .from('client_geo_profiles')
            .select('lifecycle_status')
            .eq('id', v.data.clientId)
            .single();
        if (fetchErr || !current) {
            return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
        }
        const fromState = current.lifecycle_status || 'archived';
        try {
            validateTransition(fromState, 'active');
        } catch (transitionErr) {
            return NextResponse.json({ error: transitionErr.message }, { status: 422 });
        }
        const client = await dbRestoreClient(v.data.clientId);
        await dbLogAction({
            client_id: v.data.clientId,
            action_type: 'client_restored',
            details: { from: fromState, to: 'active' },
            performed_by: admin.email,
        });
        return NextResponse.json({ success: true, client });
    } catch (err) {
        console.error('[clients/restore]', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
