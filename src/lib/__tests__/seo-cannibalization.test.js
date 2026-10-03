import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = {
  audit: null,
  opportunities: { active: [], stale: [], latestAuditId: null },
  connectorRows: [],
  gscRows: [],
  clientName: 'Client Test',
};

vi.mock('@/lib/db/audits', () => ({
  getLatestAudit: vi.fn(async () => state.audit),
  getLatestOpportunities: vi.fn(async () => state.opportunities),
}));
vi.mock('@/lib/db/opportunities', () => ({
  getLatestAudit: vi.fn(async () => state.audit),
  getLatestOpportunities: vi.fn(async () => state.opportunities),
}));

vi.mock('@/lib/db/gsc', () => ({
  getRecentGscRows: vi.fn(async () => state.gscRows),
}));

vi.mock('@/lib/connectors/repository', () => ({
  getClientConnectorRows: vi.fn(async () => state.connectorRows),
}));

vi.mock('@/lib/supabase-admin', () => ({
  getAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { client_name: state.clientName } }),
        }),
      }),
    }),
  }),
}));

describe('getSeoCannibalizationSlice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T12:00:00.000Z'));
    vi.resetModules();
    state.audit = null;
    state.opportunities = { active: [], stale: [], latestAuditId: null };
    state.connectorRows = [];
    state.gscRows = [];
    state.clientName = 'Client Test';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty state when both audit and GSC are missing', async () => {
    const { getSeoCannibalizationSlice } = await import('@/lib/operator-intelligence/seo-cannibalization');
    const result = await getSeoCannibalizationSlice('test-id');

    expect(result.emptyState).toBeDefined();
    expect(result.emptyState.title).toContain('Cannibalisation SEO indisponible');
  });

  it('builds a truthful measured overlap group when two pages share real queries', async () => {
    state.clientName = 'Atelier Boréal';
    state.audit = {
      created_at: '2026-04-10T10:00:00.000Z',
      resolved_url: 'https://example.com',
      extracted_data: {
        page_summaries: [
          {
            url: 'https://example.com/plomberie-urgence',
            page_type: 'services',
            title: 'Plomberie urgence a Montreal',
            h1: 'Plomberie urgence Montreal',
            word_count: 520,
            faq_pairs_count: 2,
            local_signal_count: 2,
            service_signal_count: 3,
            citability: { page_score: 76, block_count: 3 },
          },
          {
            url: 'https://example.com/plombier-urgence-montreal',
            page_type: 'services',
            title: 'Plombier urgence Montreal',
            h1: 'Plombier urgence a Montreal',
            word_count: 250,
            faq_pairs_count: 0,
            local_signal_count: 1,
            service_signal_count: 2,
            citability: { page_score: 42, block_count: 1 },
          },
        ],
      },
    };
    state.connectorRows = [{ provider: 'gsc', status: 'connected', last_synced_at: '2026-04-12T08:00:00.000Z' }];
    state.gscRows = [
      {
        query: 'plomberie urgence montreal',
        page: 'https://example.com/plomberie-urgence',
        clicks: 18,
        impressions: 120,
        ctr: 0.15,
        position: 3.1,
        date: '2026-04-12',
      },
      {
        query: 'plomberie urgence montreal',
        page: 'https://example.com/plombier-urgence-montreal',
        clicks: 5,
        impressions: 40,
        ctr: 0.12,
        position: 7.4,
        date: '2026-04-12',
      },
      {
        query: 'plombier urgence montreal',
        page: 'https://example.com/plomberie-urgence',
        clicks: 12,
        impressions: 90,
        ctr: 0.13,
        position: 3.8,
        date: '2026-04-11',
      },
      {
        query: 'plombier urgence montreal',
        page: 'https://example.com/plombier-urgence-montreal',
        clicks: 7,
        impressions: 60,
        ctr: 0.11,
        position: 6.5,
        date: '2026-04-11',
      },
    ];

    const { getSeoCannibalizationSlice } = await import('@/lib/operator-intelligence/seo-cannibalization');
    const result = await getSeoCannibalizationSlice('test-id');

    expect(result.emptyState).toBeNull();
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].measured.reliability).toBe('measured');
    expect(result.groups[0].calculated.reliability).toBe('calculated');
    expect(result.groups[0].action.label).toBe('Fusionner');
    expect(result.winnerRecommendations[0].page.label).toContain('/plomberie-urgence');
    expect(result.summaryCards.find((card) => card.id === 'measured_count')?.value).toBe(1);
  });
});
