import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { generateRemediationSuggestionsForClient } from '@/lib/remediation/run-remediation';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const { clientId } = await params;
    if (!clientId) {
        return NextResponse.json({ error: 'clientId manquant' }, { status: 400 });
    }

    const url = new URL(_request.url);
    const type = url.searchParams.get('type') || null;

    try {
        const result = await generateRemediationSuggestionsForClient(clientId, {
            problemType: type,
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('[API/admin/remediation/generate] Erreur:', error);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
