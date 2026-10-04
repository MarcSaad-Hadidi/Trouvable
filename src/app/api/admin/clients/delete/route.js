import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';
import { getClientById as dbGetClientById, deleteClientHard as dbDeleteClientHard } from '@/lib/db/clients';

const deleteSchema = z.object({
    clientId: z.string().uuid(),
    confirmSlug: z.string().min(1),
});

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const v = deleteSchema.safeParse(body);
    if (!v.success) {
        return NextResponse.json({ error: 'Validation', details: v.error.issues }, { status: 400 });
    }

    try {
        const client = await dbGetClientById(v.data.clientId);
        if (client.client_slug !== v.data.confirmSlug.trim()) {
            return NextResponse.json(
                { error: 'Confirmation invalide : saisissez le slug exact du client pour supprimer définitivement.' },
                { status: 400 },
            );
        }
        await dbDeleteClientHard(v.data.clientId);
        return NextResponse.json({ success: true, deletedId: v.data.clientId });
    } catch (err) {
        console.error('[clients/delete]', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
