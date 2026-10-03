import 'server-only';

import { z } from 'zod';

import {
    CONNECTOR_PROVIDERS,
    CONNECTOR_STATES,
    CONNECTOR_STORED_STATES,
    RECURRING_JOB_TYPES,
    RECURRING_RUN_STATUS,
    RECURRING_TRIGGER_SOURCES,
} from '@/lib/continuous/constants';

export const recurringJobTypeSchema = z.enum(RECURRING_JOB_TYPES);
export const recurringRunStatusSchema = z.enum(RECURRING_RUN_STATUS);
export const recurringTriggerSourceSchema = z.enum(RECURRING_TRIGGER_SOURCES);

export const connectorProviderSchema = z.enum(CONNECTOR_PROVIDERS);
export const connectorStateSchema = z.enum(CONNECTOR_STATES);

/** Schema restricted to states the DB CHECK constraint accepts. */
export const connectorStoredStateSchema = z.enum(CONNECTOR_STORED_STATES);

export const recurringJobToggleSchema = z.object({
    jobId: z.string().uuid(),
    is_active: z.boolean(),
});

export const recurringJobRunNowSchema = z.object({
    jobId: z.string().uuid(),
});

export const recurringJobUpdateCadenceSchema = z.object({
    jobId: z.string().uuid(),
    cadence_minutes: z.number().int().min(15).max(10080),
    retry_limit: z.number().int().min(0).max(10).optional(),
    retry_backoff_minutes: z.number().int().min(5).max(1440).optional(),
});

export const cronDispatchOptionsSchema = z.object({
    maxJobsToQueue: z.number().int().min(1).max(100).default(24),
    source: recurringTriggerSourceSchema.default('cron'),
});

export const cronWorkerOptionsSchema = z.object({
    maxRunsToExecute: z.number().int().min(1).max(40).default(8),
    source: recurringTriggerSourceSchema.default('cron'),
});

export const connectorUpdateSchema = z.object({
    clientId: z.string().uuid(),
    provider: connectorProviderSchema,
    status: connectorStateSchema,
    config: z.record(z.any()).optional(),
});
