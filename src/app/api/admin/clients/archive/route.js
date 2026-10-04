import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { changeClientLifecycle, parseClientLifecycleRequest } from '@/lib/client-lifecycle';

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const input = await parseClientLifecycleRequest(request);
    if (input.body) return NextResponse.json(input.body, { status: input.status });

    try {
        const result = await changeClientLifecycle(input.clientId, 'archived', admin.email);
        return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
        console.error('[clients/archive]', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
