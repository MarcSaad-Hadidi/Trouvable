import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ audit: vi.fn(), opportunities: vi.fn(), rows: vi.fn(), connectors: vi.fn(), client: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: io.audit }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: io.opportunities }));
vi.mock('@/lib/db/gsc', () => ({ getRecentGscRows: io.rows }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: io.connectors }));
vi.mock('@/lib/db/clients', () => ({ getClientSearchIdentity: io.client }));
import { getSeoContentSlice } from '../operator-intelligence/seo-content';
import { getSeoCannibalizationSlice } from '../operator-intelligence/seo-cannibalization';
const surfaces = [
    { read: getSeoContentSlice, daysLimit: 1200, empty: 'Search Console connectée sans pages SEO observables sur la fenêtre disponible.', fresh: 'Données fraîches sur la fenêtre SEO active.', aging: 'Données utilisables, mais à surveiller.', stale: 'Données trop anciennes pour qualifier un pilotage contenu fiable.' },
    { read: getSeoCannibalizationSlice, daysLimit: 1600, empty: 'Search Console connectée sans données exploitables sur la fenêtre observée.', fresh: 'Données fraîches sur la fenêtre de recouvrement active.', aging: 'Données encore utilisables, mais à surveiller.', stale: 'Données trop anciennes pour appuyer un arbitrage opérateur serein.' },
];
beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    io.audit.mockResolvedValue(null); io.opportunities.mockResolvedValue({ active: [] }); io.rows.mockResolvedValue([]);
    io.connectors.mockResolvedValue([{ provider: 'gsc', status: 'connected', last_synced_at: '2026-10-04T09:00:00Z' }]);
    io.client.mockResolvedValue({ clientName: 'Acme', websiteUrl: 'https://example.test' });
});
afterEach(() => vi.useRealTimers());
describe.each(surfaces)('GSC freshness contract $daysLimit', (surface) => {
    it('keeps a connected empty source distinct from not-connected, with the exact domain message and DTO keys', async () => {
        const { freshness } = await surface.read('client-a');
        expect(freshness.gsc).toEqual({ status: 'warning', reliability: 'unavailable', label: 'Search Console', connectorStatus: 'connected', lastObservedDate: null, lastSyncedAt: '2026-10-04T09:00:00Z', detail: surface.empty });
        io.connectors.mockResolvedValue([]);
        expect((await surface.read('client-a')).freshness.gsc).toEqual({ status: 'unavailable', reliability: 'unavailable', label: 'Search Console', connectorStatus: 'not_connected', lastObservedDate: null, lastSyncedAt: null, detail: 'Search Console non connectée pour ce mandat.' });
    });
    it.each([
        ['2026-10-04', 'ok', 'fresh'], ['2026-10-01', 'ok', 'fresh'], ['2026-09-30', 'warning', 'aging'],
        ['2026-09-27', 'warning', 'aging'], ['2026-09-26', 'critical', 'stale'],
    ])('preserves age thresholds and exact text at %s', async (date, status, messageKey) => {
        io.rows.mockResolvedValue([{ page: 'https://example.test/services', date, clicks: 0, impressions: 0, position: null }]);
        expect((await surface.read('client-a')).freshness.gsc).toEqual({ status, reliability: 'measured', label: 'Search Console', connectorStatus: 'connected', lastObservedDate: date, lastSyncedAt: '2026-10-04T09:00:00Z', detail: surface[messageKey] });
    });
    it('preserves invalid observed dates as a measured warning rather than a fabricated age', async () => {
        io.rows.mockResolvedValue([{ date: 'unknown-date', page: 'https://example.test' }]);
        expect((await surface.read('client-a')).freshness.gsc).toMatchObject({ status: 'warning', reliability: 'measured', lastObservedDate: 'unknown-date', detail: 'Date observée non exploitable proprement.' });
    });
    it('keeps failed GSC unavailable while retaining independent connector sync dates', async () => {
        io.rows.mockRejectedValue(new Error('private GSC error'));
        const slice = await surface.read('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.freshness.gsc).toEqual({ status: 'unavailable', reliability: 'unavailable', label: 'Search Console', connectorStatus: 'connected', lastObservedDate: null, lastSyncedAt: '2026-10-04T09:00:00Z', detail: 'Données Search Console temporairement indisponibles.' });
        expect(JSON.stringify(slice)).not.toContain('private GSC error');
    });
    it('keeps known observations despite a connector failure and qualifies absent observations', async () => {
        io.connectors.mockRejectedValue(new Error('private connector'));
        io.rows.mockResolvedValue([{ page: 'https://example.test', date: '2026-10-04', clicks: 0, impressions: 0, position: null }]);
        expect((await surface.read('client-a')).freshness.gsc).toEqual({ status: 'ok', reliability: 'measured', label: 'Search Console', connectorStatus: 'unavailable', lastObservedDate: '2026-10-04', lastSyncedAt: null, detail: surface.fresh });
        io.rows.mockResolvedValue([]);
        expect((await surface.read('client-a')).freshness.gsc).toMatchObject({ status: 'unavailable', reliability: 'unavailable', connectorStatus: 'unavailable', detail: 'Données Search Console temporairement indisponibles.' });
    });
    it.each(['client-a', 'client-b'])('retains consumer scope and fetch windows for %s', async (clientId) => {
        await surface.read(clientId);
        expect(io.rows).toHaveBeenCalledWith(clientId, { days: 56, limit: surface.daysLimit });
        expect(io.connectors).toHaveBeenCalledWith(clientId); expect(io.audit).toHaveBeenCalledWith(clientId);
    });
});
