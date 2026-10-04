import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
    client: vi.fn(),
    connectors: vi.fn(),
    stats: vi.fn(),
    clusters: vi.fn(),
    opportunities: vi.fn(),
    latestRun: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: io.connectors }));
vi.mock('@/lib/db/community', () => ({
    getCommunityStats: io.stats,
    listClusters: io.clusters,
    listOpportunities: io.opportunities,
    getLatestCollectionRun: io.latestRun,
}));
import { getSocialSlice } from '../operator-intelligence/social';
beforeEach(() => {
    vi.clearAllMocks();
    io.client.mockResolvedValue({ client_name: 'Acme' });
    io.connectors.mockResolvedValue([]);
    io.stats.mockResolvedValue({ documents: 0, clusters: 0, opportunities: 0, mentions: 0 });
    io.clusters.mockResolvedValue([]);
    io.opportunities.mockResolvedValue([]);
    io.latestRun.mockResolvedValue(null);
});
describe('persisted community source availability', () => {
    it('preserves known not-connected and measured zero', async () => {
        const slice = await getSocialSlice('client-a');
        expect(slice.status).toBe('available');
        expect(slice.connection.status).toBe('not_connected');
        expect(slice.summary.documents_count).toBe(0);
        expect(slice.dataSources.connectorRows).toBe('empty');
    });
    it('retains a completed collection while connector and stats reads fail', async () => {
        io.connectors.mockRejectedValue(new Error('private connector SQL'));
        io.stats.mockRejectedValue(new Error('private stats token'));
        io.latestRun.mockResolvedValue({ id: 'run-a', status: 'completed', documents_persisted: 4 });
        const slice = await getSocialSlice('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.connection.status).toBe('unavailable');
        expect(slice.summary.last_run).toMatchObject({ id: 'run-a', status: 'completed' });
        expect(slice.summary.documents_count).toBeNull();
        expect(slice.summary.mentions_count).toBeNull();
        expect(slice.connection.message).not.toContain('aucune collecte');
        expect(slice.emptyState.description).toContain('indisponibles');
        expect(JSON.stringify(slice)).not.toMatch(/private|SQL|token/);
    });
    it('retains counts and last run when independent clusters and opportunities fail', async () => {
        io.connectors.mockResolvedValue([{ provider: 'agent_reach', status: 'connected' }]);
        io.stats.mockResolvedValue({ documents: 4, clusters: 2, opportunities: 1, mentions: 3 });
        io.clusters.mockRejectedValue(new Error('private'));
        io.opportunities.mockRejectedValue(new Error('private'));
        const slice = await getSocialSlice('client-a');
        expect(slice.summary.documents_count).toBe(4);
        expect(slice.summary.unique_sources).toBeNull();
        expect(slice.status).toBe('partial');
        expect(slice.topThemes).toEqual([]);
    });
    it('does not erase a known collection if connector is empty and stats are zero', async () => {
        io.latestRun.mockResolvedValue({ id: 'run-a', status: 'completed', documents_persisted: 0 });
        const slice = await getSocialSlice('client-a');
        expect(slice.summary.last_run.id).toBe('run-a');
        expect(slice.connection.message).not.toContain('aucune collecte');
    });
    it('does not treat null stats as measured zero or fabricate context after client failure', async () => {
        io.stats.mockResolvedValue(null);
        io.client.mockRejectedValue(new Error('private'));
        const slice = await getSocialSlice('client-a');
        expect(slice.summary.documents_count).toBeNull();
        expect(slice.summary.site_context).toBeNull();
    });
    it.each(['client-a', 'client-b'])('scopes every source to %s', async (clientId) => {
        await getSocialSlice(clientId);
        for (const key of ['client', 'connectors', 'stats', 'clusters', 'latestRun'])
            expect(io[key]).toHaveBeenCalledWith(clientId);
        expect(io.opportunities).toHaveBeenCalledWith(clientId, { status: null });
    });
    it('handles synchronous and complete source failure', async () => {
        for (const read of Object.values(io))
            read.mockImplementation(() => {
                throw new Error('private');
            });
        const slice = await getSocialSlice('client-a');
        expect(slice.status).toBe('unavailable');
        expect(slice.summary.documents_count).toBeNull();
    });
});
