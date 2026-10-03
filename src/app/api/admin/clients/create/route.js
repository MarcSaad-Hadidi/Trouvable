import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { clientCreateSchema } from '@/lib/admin-schemas';
import { LIFECYCLE_DEFAULTS } from '@/lib/lifecycle';
import { createClient as dbCreateClient } from '@/lib/db/clients';
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

    const v = clientCreateSchema.safeParse(body);
    if (!v.success) {
        return NextResponse.json({ error: 'Validation', details: v.error.issues }, { status: 400 });
    }

    const d = v.data;
    try {
        const client = await dbCreateClient({
            client_name: d.client_name,
            client_slug: d.client_slug,
            website_url: d.website_url,
            business_type: d.business_type || '',
            notes: d.notes ?? undefined,
            target_region: d.target_region ?? undefined,
            lifecycle_status: LIFECYCLE_DEFAULTS.quickCreate,
        });
        await dbLogAction({
            client_id: client.id,
            action_type: 'client_created',
            details: { via: 'api' },
            performed_by: admin.email,
        });
        return NextResponse.json({ success: true, client });
    } catch (err) {
        console.error('[clients/create]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
