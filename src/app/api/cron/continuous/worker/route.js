import { NextResponse } from 'next/server';

export const maxDuration = 60;

import { assertCronAuthorized } from '@/lib/continuous/cron-auth';
import { processContinuousWorkerTick } from '@/lib/continuous/jobs';

export const dynamic = 'force-dynamic';

function toInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function handleWorker(request) {
    try {
        assertCronAuthorized(request);
    } catch (error) {
        const status = error?.code === 'CRON_UNAUTHORIZED' ? 401 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }

    try {
        const { searchParams } = new URL(request.url);
        let maxRunsToExecute = toInteger(searchParams.get('maxRunsToExecute'), 8);
        maxRunsToExecute = Math.min(maxRunsToExecute, 40);

        const summary = await processContinuousWorkerTick({
            source: 'cron',
            maxRunsToExecute,
        });

        return NextResponse.json({
            ok: true,
            summary,
        });
    } catch (error) {
        console.error('[cron/continuous/worker]', error);
        return NextResponse.json({ error: error?.message || 'Continuous worker failed' }, { status: 500 });
    }
}

export async function GET(request) {
    return handleWorker(request);
}

export async function POST(request) {
    return handleWorker(request);
}
