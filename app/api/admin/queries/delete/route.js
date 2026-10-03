import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { trackedQueryIdSchema } from '@/lib/admin-schemas';
import { deleteTrackedQuery as dbDeleteTrackedQuery } from '@/lib/db/tracked-queries';
import { logAction as dbLogAction } from '@/lib/db/actions';

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const v = trackedQueryIdSchema.safeParse(body);
    if (!v.success) {
        return NextResponse.json({ error: 'Validation', details: v.error.issues }, { status: 400 });
    }

    try {
        const { getAdminSupabase } = await import('@/lib/supabase-admin');
        const supa = getAdminSupabase();
        const { data: tq } = await supa.from('tracked_queries').select('client_id').eq('id', v.data.id).single();
        await dbDeleteTrackedQuery(v.data.id);
        if (tq?.client_id) {
            await dbLogAction({
                client_id: tq.client_id,
                action_type: 'tracked_query_deleted',
                details: { id: v.data.id },
                performed_by: admin.email,
            });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[queries/delete]', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
