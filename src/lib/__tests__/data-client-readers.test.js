import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ client: {}, calls: [], fetch: vi.fn(), gscRows: [] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: async () => null }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: async () => ({ active: [] }) }));
vi.mock('@/lib/db/gsc', () => ({ getRecentGscRows: async () => io.gscRows }));
vi.mock('@/lib/db/ga4', () => ({ getTrafficDailyRows: async () => [], getTopPagesRows: async () => [] }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: async () => [{ provider: 'gsc', status: 'connected', config: { google_refresh_token: 'fixture-token' } }] }));
vi.mock('@/lib/connectors/providers/gsc', () => ({ hasGscServiceAccountCredentials: () => false, queryGscSearchAnalyticsRaw: io.fetch }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({
    from(table) {
        const call = { table, filters: [] };
        io.calls.push(call);
        const query = {
            select(columns) { call.columns = columns; return query; },
            eq(key, value) { call.filters.push([key, value]); return query; },
            maybeSingle: async () => io.client,
        };
        return query;
    },
}) }));

import { getVisibilitySlice } from '../operator-intelligence/visibility';
import { getSeoCannibalizationSlice } from '../operator-intelligence/seo-cannibalization';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.calls = [];
    io.client = { data: { client_name: 'Atelier Boréal', website_url: 'https://example.test' }, error: null };
    io.gscRows = ['https://example.test/a', 'https://example.test/b'].map(page => ({
        query: 'atelier boreal', page, date: '2026-10-01', clicks: 2, impressions: 40, position: 4,
    }));
    io.fetch.mockReset().mockImplementation(async ({ dimensions }) => ({ rows: [], meta: { complete: true, dimensions } }));
});
afterEach(() => vi.useRealTimers());

describe('client identity read boundary', () => {
    it('discards errored profile data before resolving the GSC property or requesting a provider', async () => {
        io.client.error = { message: 'private SQL failure' };
        const data = await getVisibilitySlice('client-current');
        expect(io.fetch).not.toHaveBeenCalled();
        expect(data.gscSource.property).toBeNull();
        expect(JSON.stringify(data)).not.toContain('private SQL failure');
        expect(JSON.stringify(data)).not.toContain('example.test');
    });

    it('discards an errored client name before classifying overlap queries as brand queries', async () => {
        io.client.error = { message: 'private SQL failure' };
        const data = await getSeoCannibalizationSlice('client-current');
        expect(data.groups[0].measured.nonBrandSharedQueryCount).toBe(1);
        expect(JSON.stringify(data)).not.toContain('private SQL failure');
    });

    it('keeps successful identity reads scoped to the requested client', async () => {
        await getVisibilitySlice('client-current');
        const data = await getSeoCannibalizationSlice('client-current');
        expect(data.groups[0].measured.nonBrandSharedQueryCount).toBe(0);
        expect(io.calls).toHaveLength(2);
        expect(io.calls.every(call => call.table === 'client_geo_profiles' && JSON.stringify(call.filters) === JSON.stringify([['id', 'client-current']]))).toBe(true);
        expect(io.fetch).toHaveBeenCalledTimes(3);
    });

    it('keeps a successfully missing profile separate from a provider request', async () => {
        io.client = { data: null, error: null };
        const data = await getVisibilitySlice('client-missing');
        expect(io.fetch).not.toHaveBeenCalled();
        expect(data.gscSource.property).toBeNull();
    });
});
