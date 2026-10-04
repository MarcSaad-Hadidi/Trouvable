import 'server-only';

import { z } from 'zod';

import { CONNECTOR_PROVIDERS, CONNECTOR_STORED_STATES, RECURRING_TRIGGER_SOURCES } from '@/lib/continuous/constants';

const recurringTriggerSourceSchema = z.enum(RECURRING_TRIGGER_SOURCES);

export const connectorProviderSchema = z.enum(CONNECTOR_PROVIDERS);

/** Schema restricted to states the DB CHECK constraint accepts. */
export const connectorStoredStateSchema = z.enum(CONNECTOR_STORED_STATES);

export const cronDispatchOptionsSchema = z.object({
    maxJobsToQueue: z.number().int().min(1).max(100).default(24),
    source: recurringTriggerSourceSchema.default('cron'),
});

export const cronWorkerOptionsSchema = z.object({
    maxRunsToExecute: z.number().int().min(1).max(40).default(8),
    source: recurringTriggerSourceSchema.default('cron'),
});
