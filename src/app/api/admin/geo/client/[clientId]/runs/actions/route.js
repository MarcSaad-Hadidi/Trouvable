import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { deleteProblematicQueryRuns } from '@/lib/db/query-runs';

const actionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('clear_errors') }),
]);

function noStoreJson(payload, init = {}) {
    return NextResponse.json(payload, {
        ...init,
        headers: {
            'Cache-Control': 'no-store',
            ...(init.headers || {}),
        },
    });
}

export async function POST(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId } = await params;
    if (!clientId) {
        return noStoreJson({ error: 'Parametres invalides' }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return noStoreJson({ error: 'JSON invalide' }, { status: 400 });
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
        return noStoreJson({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    try {
        if (parsed.data.action === 'clear_errors') {
            const result = await deleteProblematicQueryRuns(clientId);
            return noStoreJson({ success: true, action: 'clear_errors', deleted: result.deleted });
        }

        return noStoreJson({ error: 'Action inconnue' }, { status: 400 });
    } catch (error) {
        console.error(`[api/admin/geo/client/${clientId}/runs/actions]`, error);
        return noStoreJson({ error: error.message }, { status: 500 });
    }
}

