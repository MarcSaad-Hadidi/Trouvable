import 'server-only';

import { z } from 'zod';

import { CONNECTOR_PROVIDERS, CONNECTOR_STATES } from '@/lib/continuous/constants';

export const connectorProviderSchema = z.enum(CONNECTOR_PROVIDERS);
export const connectorStateSchema = z.enum(CONNECTOR_STATES);

export const connectorConnectionSchema = z.object({
    client_id: z.string().uuid(),
    provider: connectorProviderSchema,
    status: connectorStateSchema,
    config: z.record(z.any()).default({}),
    last_synced_at: z.string().nullable().optional(),
    last_error: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
});

export const normalizedTrafficPointSchema = z.object({
    date: z.string(),
    sessions: z.number(),
    users: z.number().optional(),
    conversions: z.number().optional(),
});

export const normalizedLandingPagePointSchema = z.object({
    page: z.string(),
    sessions: z.number(),
    conversions: z.number().optional(),
    period: z.string().optional(),
});

export const normalizedSearchQueryPointSchema = z.object({
    query: z.string(),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number().optional(),
    average_position: z.number().optional(),
});

export const attributionSummarySchema = z.object({
    source: z.string(),
    medium: z.string().optional(),
    sessions: z.number(),
    conversions: z.number().optional(),
});

export function normalizeConnectorRow(row, providerFallback) {
    const safeProvider = CONNECTOR_PROVIDERS.includes(row?.provider) ? row.provider : providerFallback;
    const safeStatus = CONNECTOR_STATES.includes(row?.status) ? row.status : 'not_connected';

    return {
        client_id: row?.client_id,
        provider: safeProvider,
        status: safeStatus,
        config: row?.config && typeof row.config === 'object' ? row.config : {},
        last_synced_at: row?.last_synced_at || null,
        last_error: row?.last_error || null,
        updated_at: row?.updated_at || null,
    };
}
