import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ audit: vi.fn(), history: vi.fn(), opportunities: vi.fn(), connectors: vi.fn(), gsc: vi.fn(), client: vi.fn(), visibility: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: io.audit, getRecentAudits: io.history }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: io.opportunities }));
vi.mock('@/lib/db/gsc', () => ({ getRecentGscRows: io.gsc }));
vi.mock('@/lib/db/clients', () => ({ getClientSearchIdentity: io.client }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: io.connectors }));
vi.mock('@/lib/operator-intelligence/visibility', () => ({ getVisibilitySlice: io.visibility }));
import { getSeoContentSlice } from '../operator-intelligence/seo-content';
import { getSeoCannibalizationSlice } from '../operator-intelligence/seo-cannibalization';
import { getSeoHealthSlice } from '../operator-intelligence/seo-health';
import { getSeoOnPageSlice } from '../operator-intelligence/seo-on-page';
import { getSeoOpportunitiesSlice } from '../operator-intelligence/seo-opportunities';

const page = { url: 'https://example.test/service', page_type: 'services', title: 'Court', h1: 'Service', word_count: 100 };
const audit = { id: 'audit-a', created_at: '2026-10-02', scan_status: 'success', seo_score: 0, extracted_data: { page_summaries: [page] }, issues: [] };
const rows = [{ date: '2026-10-02', page: page.url, query: 'réparation', clicks: 0, impressions: 80, position: 8 }];
const loaders = [getSeoContentSlice, getSeoCannibalizationSlice];
const card = (data, id) => data.summaryCards.find(value => value.id === id);
function expectSafeFailure(data, source) {
    expect(data.status).not.toBe('available');
    expect(data.dataSources[source]).toBe('unavailable');
    expect(data.errors).toContainEqual({ source, message: 'Données temporairement indisponibles.' });
    expect(JSON.stringify(data)).not.toContain('private failure');
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.audit.mockReset().mockResolvedValue(audit);
    io.history.mockReset().mockResolvedValue([audit]);
    io.opportunities.mockReset().mockResolvedValue({ active: [] });
    io.connectors.mockReset().mockResolvedValue([{ provider: 'gsc', status: 'connected', last_synced_at: '2026-10-03' }]);
    io.gsc.mockReset().mockResolvedValue(rows);
    io.client.mockReset().mockResolvedValue({ clientName: 'Atelier', websiteUrl: 'https://example.test' });
    io.visibility.mockReset().mockResolvedValue({ status: 'available', dataSources: { gscQueries: 'available' }, errors: [], freshness: { gsc: { status: 'ok', reliability: 'measured', lastObservedDate: '2026-10-02' } } });
});
afterEach(() => vi.useRealTimers());

describe('SEO readings retain independent source availability', () => {
    it.each(loaders)('keeps audit evidence and no false measured zero when GSC fails in %s', async load => {
        io.gsc.mockRejectedValue(new Error('private failure GSC'));
        const data = await load('client-a');
        expectSafeFailure(data, 'gscRows');
        expect(data.auditMeta.createdAt).toBe(audit.created_at);
        expect(data.freshness.gsc).toMatchObject({ status: 'unavailable', reliability: 'unavailable', lastSyncedAt: '2026-10-03' });
        expect(data.actionHooks.some(hook => hook.id === 'connect-gsc')).toBe(false);
        if (load === getSeoContentSlice) {
            expect(data.contentDecay.status).toBe('unavailable');
            expect(data.refreshOpportunities.items.length).toBeGreaterThan(0);
        } else expect(card(data, 'measured_count').value).toBeNull();
    });
    it.each(loaders)('keeps a connector query failure distinct from a missing connection in %s', async load => {
        io.connectors.mockRejectedValue(new Error('private failure connector'));
        const data = await load('client-a');
        expectSafeFailure(data, 'connectors');
        expect(data.freshness.gsc.connectorStatus).toBe('unavailable');
        expect(data.freshness.gsc.lastObservedDate).toBe('2026-10-02');
        expect(data.freshness.gsc.detail).not.toContain('non connectée');
    });
    it.each(loaders)('keeps a genuinely disconnected empty GSC source free from incidents in %s', async load => {
        io.connectors.mockResolvedValue([]);
        io.gsc.mockResolvedValue([]);
        const data = await load('client-a');
        expect(data.status).toBe('available');
        expect(data.dataSources.gscRows).toBe('not_connected');
        expect(data.errors).toEqual([]);
        expect(data.freshness.gsc.connectorStatus).toBe('not_connected');
    });
    it.each(loaders)('distinguishes an unread action queue from a successful empty queue in %s', async load => {
        io.opportunities.mockRejectedValue(new Error('private failure queue'));
        const failed = await load('client-a');
        expectSafeFailure(failed, 'opportunities');
        expect(failed.contentOpportunityCount).toBeNull();
        io.opportunities.mockResolvedValue({ active: [] });
        const empty = await load('client-a');
        expect(empty.contentOpportunityCount).toBe(0);
        expect(empty.errors).toEqual([]);
    });
    it('retains GSC dates in the content early return when its audit read fails', async () => {
        io.audit.mockRejectedValue(new Error('private failure audit'));
        const data = await getSeoContentSlice('client-a');
        expectSafeFailure(data, 'audit');
        expect(data.emptyState.description).toContain('temporairement');
        expect(data.freshness.gsc.lastObservedDate).toBe('2026-10-02');
    });
    it('retains measured overlap with unknown brand classification when identity fails', async () => {
        io.client.mockRejectedValue(new Error('private failure identity'));
        io.gsc.mockResolvedValue([...rows, { ...rows[0], page: 'https://example.test/other', clicks: 0 }]);
        const data = await getSeoCannibalizationSlice('client-a');
        expectSafeFailure(data, 'client');
        expect(data.clientName).toBeNull();
        expect(data.groups[0].measured).toMatchObject({ sharedClicks: 0, sharedQueryCount: 1, nonBrandSharedQueryCount: null });
        expect(data.groups[0].measured.querySamples[0].isBrandLike).toBeNull();
        expect(data.groups[0].action.label).not.toBe('Repositionner');
    });
    it('keeps audit read failure separate from successful absence in on-page', async () => {
        io.audit.mockRejectedValue(new Error('private failure audit'));
        const failed = await getSeoOnPageSlice('client-a');
        expectSafeFailure(failed, 'audit');
        expect(failed.status).toBe('unavailable');
        expect(failed.emptyState.description).toContain('temporairement');
        io.audit.mockResolvedValue(null);
        const empty = await getSeoOnPageSlice('client-a');
        expect(empty.dataSources.audit).toBe('empty');
        expect(empty.errors).toEqual([]);
        expect(empty.emptyState.description).toContain('Aucun audit');
    });
    it('retains zero audit score and checks when history alone fails in health', async () => {
        io.history.mockRejectedValue(new Error('private failure history'));
        const data = await getSeoHealthSlice('client-a');
        expectSafeFailure(data, 'recentAudits');
        expect(data.status).toBe('partial');
        expect(data.seoScore).toBe(0);
        expect(data.checks.length).toBeGreaterThan(0);
        expect(data.history).toEqual([]);
    });
    it('retains independently read history when the health audit read fails', async () => {
        io.audit.mockRejectedValue(new Error('private failure audit'));
        const data = await getSeoHealthSlice('client-a');
        expectSafeFailure(data, 'audit');
        expect(data.history[0]).toMatchObject({ id: 'audit-a', seoScore: 0 });
        expect(data.seoScore).toBeNull();
    });
    it('preserves provided audit, pending grace and partial audit status in health', async () => {
        const pending = await getSeoHealthSlice('client-a', { audit: { ...audit, scan_status: 'pending' } });
        expect(pending.available).toBe(false);
        expect(pending.emptyState.title).toContain('en cours');
        expect(pending.dataSources.audit).toBe('not_observed');
        expect(pending.errors).toEqual([]);
        expect(io.audit).not.toHaveBeenCalled();
        const partial = await getSeoHealthSlice('client-a', { audit: { ...audit, scan_status: 'partial_error' } });
        expect(partial.status).toBe('partial');
        expect(partial.dataSources.audit).toBe('partial');
        expect(partial.seoScore).toBe(0);
    });
    it('retains metadata opportunities when the direct persisted GSC read fails', async () => {
        io.gsc.mockRejectedValue(new Error('private failure GSC'));
        const data = await getSeoOpportunitiesSlice('client-a');
        expectSafeFailure(data, 'gscRows');
        expect(data.metadata.items.length).toBeGreaterThan(0);
        expect(data.positionBand).toMatchObject({ status: 'unavailable', availability: 'unavailable', items: [] });
        expect(card(data, 'pages_4_20').value).toBeNull();
        expect(data.actionHooks.some(hook => hook.id === 'connect-gsc')).toBe(false);
        expect(data.dataSources['content.gscRows']).toBe('unavailable');
    });
    it('aggregates partial nested reads without discarding direct GSC opportunities', async () => {
        io.audit.mockRejectedValue(new Error('private failure audit'));
        const data = await getSeoOpportunitiesSlice('client-a');
        expectSafeFailure(data, 'audit');
        expect(data.dataSources['onPage.audit']).toBe('unavailable');
        expect(data.errors.some(error => error.source === 'onPage.audit')).toBe(true);
        expect(data.positionBand.items[0].metrics.find(metric => metric.label === 'Clics').value).toBe(0);
        expect(data.metadata).toMatchObject({ status: 'unavailable', availability: 'unavailable' });
        expect(data.quickWins.availability).toBe('partial');
    });
    it('propagates a partial visibility response even when that nested call fulfilled', async () => {
        io.visibility.mockResolvedValue({ status: 'partial', dataSources: { ga4Traffic: 'unavailable', gscQueries: 'available' }, errors: [{ source: 'ga4Traffic', message: 'Données temporairement indisponibles.' }], freshness: { gsc: { reliability: 'measured' } } });
        const data = await getSeoOpportunitiesSlice('client-a');
        expect(data.status).toBe('partial');
        expect(data.dataSources.visibility).toBe('partial');
        expect(data.dataSources['visibility.ga4Traffic']).toBe('unavailable');
        expect(data.errors).toContainEqual({ source: 'visibility.ga4Traffic', message: 'Données temporairement indisponibles.' });
        expect(data.positionBand.items.length).toBeGreaterThan(0);
    });
    it.each(loaders)('keeps a successful unobserved GSC read free from errors in %s', async load => {
        io.gsc.mockResolvedValue([]);
        const data = await load('client-a');
        expect(data.status).toBe('available');
        expect(data.dataSources.gscRows).toBe('not_observed');
        expect(data.errors).toEqual([]);
        expect(data.freshness.gsc.reliability).toBe('unavailable');
        if (load === getSeoContentSlice) expect(data.contentDecay.status).toBe('unavailable');
    });
    it('retains direct zero GSC observations when the independent visibility call rejects', async () => {
        io.visibility.mockRejectedValue(new Error('private failure visibility'));
        const data = await getSeoOpportunitiesSlice('client-a');
        expectSafeFailure(data, 'visibility');
        expect(data.positionBand.items[0].metrics.find(metric => metric.label === 'Clics').value).toBe(0);
        expect(data.positionBand.availability).toBe('available');
        expect(data.metadata.items.length).toBeGreaterThan(0);
    });
    it('keeps known disconnected GSC distinct from an incident in opportunities', async () => {
        io.connectors.mockResolvedValue([]);
        io.gsc.mockResolvedValue([]);
        io.visibility.mockResolvedValue({ status: 'available', dataSources: { gscQueries: 'not_connected' }, errors: [], connectors: { gsc: { status: 'not_connected' } } });
        const data = await getSeoOpportunitiesSlice('client-a');
        expect(data.status).toBe('available');
        expect(data.errors).toEqual([]);
        expect(data.dataSources.gscRows).toBe('not_connected');
        expect(data.positionBand.availability).toBe('not_connected');
        expect(card(data, 'pages_4_20').value).toBeNull();
    });
    it('keeps observed zero and persisted and live dates distinct in opportunities', async () => {
        io.gsc.mockResolvedValue([{ ...rows[0], impressions: 0, clicks: 0 }]);
        io.visibility.mockResolvedValue({ status: 'available', dataSources: { gscQueries: 'available' }, errors: [], freshness: { gsc: { reliability: 'measured', lastObservedDate: '2026-09-30' } } });
        const data = await getSeoOpportunitiesSlice('client-a');
        expect(data.status).toBe('available');
        expect(data.positionBand.availability).toBe('available');
        expect(card(data, 'pages_4_20').value).toBe(0);
        expect(data.freshness.gsc).toMatchObject({ lastObservedDate: '2026-10-02', lastLiveObservedDate: '2026-09-30' });
    });
    it('starts nested reads immediately when an audit was already provided', async () => {
        const pending = getSeoOpportunitiesSlice('client-a', { audit });
        const immediateCalls = [io.visibility.mock.calls.length, io.gsc.mock.calls.length];
        const data = await pending;
        expect(immediateCalls[0]).toBe(1);
        expect(immediateCalls[1]).toBe(3);
        expect(data.auditMeta.createdAt).toBe(audit.created_at);
    });
    it('returns sanitized errors and no false success if all sources fail', async () => {
        for (const reader of [io.audit, io.opportunities, io.connectors, io.gsc, io.client]) reader.mockRejectedValue(new Error('private failure unavailable'));
        const data = await getSeoCannibalizationSlice('client-a');
        expect(data.status).toBe('unavailable');
        expect(data.errors).toHaveLength(5);
        expect(JSON.stringify(data)).not.toContain('private failure');
        expect(data.emptyState.description).toContain('temporairement');
    });
    it('retains calculated page overlap without fabricated measured counts after GSC failure', async () => {
        io.audit.mockResolvedValue({ ...audit, extracted_data: { page_summaries: [page, { ...page, url: 'https://example.test/other' }] } });
        io.gsc.mockRejectedValue(new Error('private failure GSC'));
        const data = await getSeoCannibalizationSlice('client-a');
        expectSafeFailure(data, 'gscRows');
        expect(data.groups[0].calculated.reliability).toBe('calculated');
        expect(data.groups[0].measured).toMatchObject({ reliability: 'unavailable', sharedClicks: null, sharedImpressions: null, sharedQueryCount: null });
    });
    it('starts the direct content reads synchronously even after a sync loader failure', async () => {
        io.audit.mockImplementation(() => { throw new Error('private failure sync'); });
        const pending = getSeoContentSlice('client-scope');
        const initialCalls = [io.opportunities.mock.calls.length, io.connectors.mock.calls.length, io.gsc.mock.calls.length];
        const data = await pending;
        expect(initialCalls).toEqual([1, 1, 1]);
        expect(io.gsc).toHaveBeenCalledWith('client-scope', { days: 56, limit: 1200 });
        expectSafeFailure(data, 'audit');
    });
});
