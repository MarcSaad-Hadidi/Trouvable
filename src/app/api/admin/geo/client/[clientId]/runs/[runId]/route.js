import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { getRunInspectorSlice } from '@/lib/operator-intelligence/runs';
import { reparseStoredQueryRun, rerunStoredQueryRun } from '@/lib/queries/run-tracked-queries';

const actionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('rerun') }),
    z.object({ action: z.literal('reparse') }),
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

export async function GET(_, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId, runId } = await params;
    if (!clientId || !runId) {
        return noStoreJson({ error: 'Parametres invalides' }, { status: 400 });
    }

    try {
        const data = await getRunInspectorSlice(clientId, runId);
        return noStoreJson(data);
    } catch (error) {
        console.error(`[api/admin/geo/client/${clientId}/runs/${runId}]`, error);
        return noStoreJson({ error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId, runId } = await params;
    if (!clientId || !runId) {
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
        if (parsed.data.action === 'rerun') {
            const result = await rerunStoredQueryRun({
                clientId,
                runId,
                performedBy: admin.email || null,
            });
            return noStoreJson({ success: true, action: 'rerun', result });
        }

        const result = await reparseStoredQueryRun({
            clientId,
            runId,
            performedBy: admin.email || null,
        });
        return noStoreJson({ success: true, action: 'reparse', result });
    } catch (error) {
        console.error(`[api/admin/geo/client/${clientId}/runs/${runId}]`, error);
        return noStoreJson({ error: error.message }, { status: 500 });
    }
}

