import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 300;

import { requireAdmin } from '@/lib/auth';
import {
    createBenchmarkSession as dbCreateBenchmarkSession,
    updateBenchmarkSession as dbUpdateBenchmarkSession,
} from '@/lib/db/benchmarks';
import { resolveRequestedBenchmarkVariants } from '@/lib/queries/engine-variants';
import { runTrackedQueriesForClient } from '@/lib/queries/run-tracked-queries';

const benchmarkPayloadSchema = z.object({
    clientId: z.string().uuid(),
    trackedQueryId: z.string().uuid().optional(),
    variants: z.array(z.string()).optional(),
    note: z.string().max(400).optional(),
});

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
    }

    const validation = benchmarkPayloadSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: 'Payload invalide', details: validation.error.issues }, { status: 400 });
    }

    const { clientId, trackedQueryId, variants = [], note } = validation.data;
    const resolvedVariants = resolveRequestedBenchmarkVariants(variants);
    if (resolvedVariants.length === 0) {
        return NextResponse.json({ error: 'Aucune variante benchmark valide.' }, { status: 400 });
    }

    try {
        const session = await dbCreateBenchmarkSession({
            client_id: clientId,
            tracked_query_id: trackedQueryId || null,
            status: 'running',
            requested_variants: resolvedVariants,
            initiated_by: admin.email || null,
            notes: note || null,
        });

        const result = await runTrackedQueriesForClient({
            clientId,
            trackedQueryId: trackedQueryId || null,
            performedBy: admin.email || null,
            actionTypeOverride: 'geo_queries_benchmark_run',
            runMode: 'benchmark',
            benchmarkSessionId: session.id,
            benchmarkVariants: resolvedVariants,
        });

        const hasError = (result.runs || []).some((run) => run.error);
        await dbUpdateBenchmarkSession(session.id, {
            status: hasError ? 'failed' : 'completed',
            notes: note || null,
        });

        return NextResponse.json({
            success: true,
            benchmarkSessionId: session.id,
            variants: resolvedVariants,
            result,
        });
    } catch (error) {
        console.error('[api/admin/queries/benchmark]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
