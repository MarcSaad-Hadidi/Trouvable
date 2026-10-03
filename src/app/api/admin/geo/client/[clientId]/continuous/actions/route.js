import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { logAction as dbLogAction } from '@/lib/db/actions';
import {
    getRecurringJobHealthSlice,
    processContinuousTick,
    processContinuousWorkerTick,
    queueRecurringRunNow,
    setRecurringJobActive,
    updateRecurringJobCadence,
    upsertVisibilitySnapshotForClient,
} from '@/lib/continuous/jobs';
import { connectorProviderSchema, connectorStoredStateSchema } from '@/lib/continuous/schemas';
import { updateConnectorState } from '@/lib/connectors/repository';

const actionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('run_now'),
        jobId: z.string().uuid(),
    }),
    z.object({
        action: z.literal('toggle_job'),
        jobId: z.string().uuid(),
        is_active: z.boolean(),
    }),
    z.object({
        action: z.literal('update_cadence'),
        jobId: z.string().uuid(),
        cadence_minutes: z.number().int().min(15).max(10080),
        retry_limit: z.number().int().min(0).max(10).optional(),
        retry_backoff_minutes: z.number().int().min(5).max(1440).optional(),
    }),
    z.object({
        action: z.literal('dispatch_tick'),
        maxJobsToQueue: z.number().int().min(1).max(100).optional(),
    }),
    z.object({
        action: z.literal('worker_tick'),
        maxRunsToExecute: z.number().int().min(1).max(40).optional(),
    }),
    z.object({
        action: z.literal('capture_snapshot'),
    }),
    z.object({
        action: z.literal('connector_state'),
        provider: connectorProviderSchema,
        status: connectorStoredStateSchema,
        config: z.record(z.any()).optional(),
        last_error: z.string().max(1000).nullable().optional(),
    }),
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

async function resolveJobForClient(clientId, jobId) {
    const health = await getRecurringJobHealthSlice(clientId);
    const job = (health.jobs || []).find((item) => item.id === jobId);
    if (!job) {
        throw new Error('Recurring job not found for this client.');
    }
    return job;
}

export async function POST(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId } = await params;
    if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
        return noStoreJson({ error: 'ID client invalide' }, { status: 400 });
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
        const input = parsed.data;
        let result = null;

        if (input.action === 'run_now') {
            const job = await resolveJobForClient(clientId, input.jobId);
            result = await queueRecurringRunNow(job.id, 'manual');
        } else if (input.action === 'toggle_job') {
            const job = await resolveJobForClient(clientId, input.jobId);
            result = await setRecurringJobActive(job.id, input.is_active);
        } else if (input.action === 'update_cadence') {
            const job = await resolveJobForClient(clientId, input.jobId);
            result = await updateRecurringJobCadence({
                jobId: job.id,
                cadenceMinutes: input.cadence_minutes,
                retryLimit: input.retry_limit,
                retryBackoffMinutes: input.retry_backoff_minutes,
            });
        } else if (input.action === 'dispatch_tick') {
            result = await processContinuousTick({
                source: 'manual',
                maxJobsToQueue: input.maxJobsToQueue ?? 20,
            });
        } else if (input.action === 'worker_tick') {
            result = await processContinuousWorkerTick({
                source: 'manual',
                maxRunsToExecute: input.maxRunsToExecute ?? 8,
            });
        } else if (input.action === 'capture_snapshot') {
            result = await upsertVisibilitySnapshotForClient({
                clientId,
                source: 'manual',
                metadata: {
                    reason: 'operator_manual_capture',
                    triggered_by: admin.email || null,
                },
            });
        } else if (input.action === 'connector_state') {
            result = await updateConnectorState({
                clientId,
                provider: input.provider,
                status: input.status,
                config: input.config ?? null,
                lastError: input.last_error ?? null,
            });
        }

        await dbLogAction({
            client_id: clientId,
            action_type: 'continuous_operator_action',
            details: {
                action: input.action,
                ...(input.jobId ? { job_id: input.jobId } : {}),
                ...(input.provider ? { provider: input.provider, connector_status: input.status } : {}),
            },
            performed_by: admin.email || null,
        });

        return noStoreJson({ success: true, result });
    } catch (error) {
        console.error(`[api/admin/geo/client/${clientId}/continuous/actions]`, error);
        return noStoreJson({ error: error?.message || 'Action failed' }, { status: 500 });
    }
}

