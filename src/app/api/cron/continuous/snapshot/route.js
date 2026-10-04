import { NextResponse } from 'next/server';

export const maxDuration = 60;

import { assertCronAuthorized } from '@/lib/continuous/cron-auth';
import { ensureDefaultRecurringJobsForAllClients } from '@/lib/continuous/recurring-jobs';
import { captureDailySnapshotsForAllClients } from '@/lib/continuous/snapshots';

export const dynamic = 'force-dynamic';

async function handleSnapshot(request) {
    try {
        assertCronAuthorized(request);
    } catch (error) {
        const status = error?.code === 'CRON_UNAUTHORIZED' ? 401 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }

    try {
        const seededJobsForClients = await ensureDefaultRecurringJobsForAllClients();
        const snapshotSummary = await captureDailySnapshotsForAllClients();

        return NextResponse.json({
            ok: true,
            seededJobsForClients,
            snapshotSummary,
        });
    } catch (error) {
        console.error('[cron/continuous/snapshot]', error);
        return NextResponse.json({ error: error?.message || 'Snapshot capture failed' }, { status: 500 });
    }
}

export async function GET(request) {
    return handleSnapshot(request);
}

export async function POST(request) {
    return handleSnapshot(request);
}
