import { NextResponse } from 'next/server';

export const maxDuration = 60;

import { assertCronAuthorized } from '@/lib/continuous/cron-auth';
import { processContinuousTick } from '@/lib/continuous/jobs';

export const dynamic = 'force-dynamic';

function toInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function handleDispatch(request) {
    try {
        assertCronAuthorized(request);
    } catch (error) {
        const status = error?.code === 'CRON_UNAUTHORIZED' ? 401 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }

    try {
        const { searchParams } = new URL(request.url);
        let maxJobsToQueue = toInteger(searchParams.get('maxJobsToQueue'), 24);

        maxJobsToQueue = Math.min(maxJobsToQueue, 100);

        const summary = await processContinuousTick({
            source: 'cron',
            maxJobsToQueue,
        });

        return NextResponse.json({
            ok: true,
            summary,
        });
    } catch (error) {
        console.error('[cron/continuous/dispatch]', error);
        return NextResponse.json({ error: error?.message || 'Continuous dispatch failed' }, { status: 500 });
    }
}

export async function GET(request) {
    return handleDispatch(request);
}

export async function POST(request) {
    return handleDispatch(request);
}
