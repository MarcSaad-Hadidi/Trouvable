import { NextResponse } from 'next/server';

export const maxDuration = 300;

import { requireAdmin } from '@/lib/auth';
import { queryRunPayloadSchema } from '@/lib/ai/schemas';
import { upsertVisibilitySnapshotForClient } from '@/lib/continuous/jobs';
import { runTrackedQueriesForClient } from '@/lib/queries/run-tracked-queries';

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
    }

    const validation = queryRunPayloadSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: 'Payload invalide', details: validation.error.issues }, { status: 400 });
    }

    const { clientId, trackedQueryId } = validation.data;

    try {
        const result = await runTrackedQueriesForClient({
            clientId,
            trackedQueryId: trackedQueryId || null,
            performedBy: admin.email || null,
        });

        if (result.notFound) {
            return NextResponse.json({ error: result.message }, { status: 404 });
        }

        if ((result.totalQueries || 0) > 0) {
            try {
                await upsertVisibilitySnapshotForClient({
                    clientId,
                    source: 'manual',
                    metadata: {
                        reason: trackedQueryId ? 'manual_single_prompt_run' : 'manual_prompt_batch_run',
                    },
                });
            } catch (snapshotError) {
                console.error('[API/queries/run] snapshot capture failed:', snapshotError.message);
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API/queries/run] Erreur:', error);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
