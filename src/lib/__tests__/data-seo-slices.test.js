import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ audit: null, rows: [], connectors: [] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: async () => io.audit }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: async () => ({ active: [] }) }));
vi.mock('@/lib/db/gsc', () => ({ getRecentGscRows: async () => io.rows }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: async () => io.connectors }));
vi.mock('@/lib/operator-intelligence/visibility', () => ({
    getVisibilitySlice: async () => ({ freshness: { gsc: { reliability: 'measured' } } }),
}));
vi.mock('@/lib/operator-intelligence/seo-on-page', () => ({ getSeoOnPageSlice: async () => ({ emptyState: {} }) }));
vi.mock('@/lib/supabase-admin', () => ({
    getAdminSupabase: () => ({
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    }),
}));

import { getSeoContentSlice } from '../operator-intelligence/seo-content';
import { getSeoOpportunitiesSlice } from '../operator-intelligence/seo-opportunities';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.audit = {
        created_at: '2026-10-01T10:00:00Z',
        extracted_data: {
            page_summaries: [
                {
                    url: 'https://example.test/service',
                    page_type: 'services',
                    title: 'Réparation plomberie Montréal',
                    h1: 'Réparation plomberie Montréal',
                    word_count: 500,
                },
            ],
        },
    };
    io.connectors = [{ provider: 'gsc', status: 'connected', last_synced_at: '2026-10-03T09:00:00Z' }];
    io.rows = [
        {
            page: 'https://EXAMPLE.test/service/?q=1',
            date: '2026-10-01',
            query: 'plomberie',
            clicks: 0,
            impressions: 100,
            position: 8,
        },
        {
            page: 'https://example.test/service',
            date: '2026-09-15',
            query: 'réparation',
            clicks: '2',
            impressions: '100',
            position: '12',
        },
        {
            page: 'https://example.test/service',
            date: '2026-08-15',
            query: 'réparation',
            clicks: 50,
            impressions: 400,
            position: 3,
        },
    ];
});
afterEach(() => vi.useRealTimers());

describe('SEO consumers of canonical GSC projection', () => {
    it('keeps opportunity identifiers, audit linkage and weighted metrics', async () => {
        const data = await getSeoOpportunitiesSlice('client-a');
        const item = data.positionBand.items[0];
        expect(item.id).toBe('band_https://example.test/service');
        expect(item.pages[0].role).toBe('Page service');
        expect(item.href).toBe('/admin/clients/client-a/seo/visibility');
        expect(item.metrics).toEqual([
            { label: 'Position', type: 'position', value: 10 },
            { label: 'Impressions', type: 'number', value: 200 },
            { label: 'CTR', type: 'percent', value: 0.01 },
            { label: 'Clics', type: 'number', value: 2 },
        ]);
    });

    it('keeps content decay from the comparison window and source dates independent', async () => {
        const data = await getSeoContentSlice('client-a');
        expect(data.contentDecay.items).toHaveLength(1);
        expect(data.contentDecay.items[0].why).toBe('-96.0% de clics · -50.0% d’impressions · +7.0 positions');
        expect(data.contentDecay.items[0].evidence).toBe(
            'Période actuelle: 200 impressions / 2 clics. Période précédente: 400 impressions / 50 clics.',
        );
        expect(data.freshness.gsc).toMatchObject({
            lastObservedDate: '2026-10-01',
            lastSyncedAt: '2026-10-03T09:00:00Z',
            status: 'ok',
        });
        expect(data.auditMeta.createdAt).toBe('2026-10-01T10:00:00Z');
    });

    it('preserves unavailable GSC without discarding the independently observed audit', async () => {
        io.connectors = [];
        io.rows = [];
        const data = await getSeoContentSlice('client-a');
        expect(data.emptyState).toBeNull();
        expect(data.freshness.gsc).toMatchObject({
            status: 'unavailable',
            reliability: 'unavailable',
            lastObservedDate: null,
            lastSyncedAt: null,
        });
        expect(data.contentDecay).toMatchObject({ status: 'unavailable', items: [] });
        expect(data.auditMeta.createdAt).toBe('2026-10-01T10:00:00Z');
    });
});
