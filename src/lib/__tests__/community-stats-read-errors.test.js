import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
    admin: vi.fn(),
    client: vi.fn(),
    connectors: vi.fn(),
    queries: [],
    responses: {},
    rows: {},
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: io.admin }));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: io.connectors }));
import { getCommunityStats } from '../db/community';
import { getSocialSlice } from '../operator-intelligence/social';

const tables = ['community_documents', 'community_clusters', 'community_opportunities', 'community_mentions'];
const fields = ['documents', 'clusters', 'opportunities', 'mentions'];
function queryFor(table) {
    const record = { table, columns: null, options: null, filters: [] };
    io.queries.push(record);
    const response = () => {
        const clientId = record.filters.find(([key]) => key === 'client_id')?.[1];
        if (record.options?.head) return io.responses[clientId]?.[table] || { count: 0, error: null, data: null };
        return { data: io.rows[table] ?? [], error: null };
    };
    const query = {
        select(columns, options) {
            record.columns = columns;
            record.options = options;
            return query;
        },
        eq(key, value) {
            record.filters.push([key, value]);
            return query;
        },
        order() {
            return query;
        },
        limit() {
            return query;
        },
        maybeSingle() {
            return Promise.resolve({ data: io.rows[table] ?? null, error: null });
        },
        then(resolve, reject) {
            return Promise.resolve(response()).then(resolve, reject);
        },
    };
    return query;
}
function setCounts(clientId, counts) {
    io.responses[clientId] = Object.fromEntries(
        tables.map((table, index) => [table, { count: counts[index], error: null, data: null }]),
    );
}

beforeEach(() => {
    io.queries = [];
    io.responses = {};
    io.rows = {};
    io.admin.mockReset().mockReturnValue({ from: queryFor });
    io.client.mockReset().mockResolvedValue({ client_name: 'Atelier' });
    io.connectors.mockReset().mockResolvedValue([{ provider: 'agent_reach', status: 'connected' }]);
    setCounts('client-a', [4, 2, 1, 3]);
});

describe('real community stats reader validates all Supabase results', () => {
    it.each(tables)('rejects an error from %s even with contradictory zero count and data', async (table) => {
        io.responses['client-a'][table] = {
            error: { message: 'private SQL token fixture' },
            count: 0,
            data: [{ id: 'contradictory' }],
        };
        await expect(getCommunityStats('client-a')).rejects.toThrow('getCommunityStats');
    });
    it.each(tables)('checks every error before using any count or data when %s fails', async (table) => {
        const countReads = tables.map(() => vi.fn(() => 0));
        const dataReads = tables.map(() => vi.fn(() => [{ id: 'contradictory' }]));
        io.responses['client-a'] = Object.fromEntries(
            tables.map((name, index) => [
                name,
                {
                    error: name === table ? { message: 'private failure fixture' } : null,
                    get count() {
                        return countReads[index]();
                    },
                    get data() {
                        return dataReads[index]();
                    },
                },
            ]),
        );
        await expect(getCommunityStats('client-a')).rejects.toThrow('getCommunityStats');
        for (const read of [...countReads, ...dataReads]) expect(read).not.toHaveBeenCalled();
    });
    it.each([null, undefined, '', '  ', false, true, {}, [], NaN, Infinity, 'invalid', -1, 2.5])(
        'preserves invalid or absent successful counts as null: %s',
        async (count) => {
            setCounts('client-a', [count, count, count, count]);
            expect(await getCommunityStats('client-a')).toEqual({
                documents: null,
                clusters: null,
                opportunities: null,
                mentions: null,
            });
        },
    );
    it('preserves successful zero and nonzero counts', async () => {
        setCounts('client-a', [0, 2, '3', 4]);
        expect(await getCommunityStats('client-a')).toEqual({
            documents: 0,
            clusters: 2,
            opportunities: 3,
            mentions: 4,
        });
        setCounts('client-a', [0, 0, 0, 0]);
        expect(await getCommunityStats('client-a')).toEqual({
            documents: 0,
            clusters: 0,
            opportunities: 0,
            mentions: 0,
        });
    });
    it('starts all four exact head reads synchronously with the original filters', async () => {
        const pending = getCommunityStats('client-a');
        const immediateQueries = io.queries.map((query) => ({ ...query, filters: [...query.filters] }));
        await pending;
        expect(immediateQueries).toEqual(
            tables.map((table) => ({
                table,
                columns: 'id',
                options: { count: 'exact', head: true },
                filters:
                    table === 'community_opportunities'
                        ? [
                              ['client_id', 'client-a'],
                              ['status', 'open'],
                          ]
                        : [['client_id', 'client-a']],
            })),
        );
        expect(io.admin).toHaveBeenCalledTimes(1);
    });
    it('keeps simultaneous client A/B counts and filters isolated', async () => {
        setCounts('client-a', [1, 2, 3, 4]);
        setCounts('client-b', [10, 20, 30, 40]);
        const [a, b] = await Promise.all([getCommunityStats('client-a'), getCommunityStats('client-b')]);
        expect(a).toEqual({ documents: 1, clusters: 2, opportunities: 3, mentions: 4 });
        expect(b).toEqual({ documents: 10, clusters: 20, opportunities: 30, mentions: 40 });
        expect(io.queries.slice(0, 4).every((query) => query.filters[0][1] === 'client-a')).toBe(true);
        expect(io.queries.slice(4).every((query) => query.filters[0][1] === 'client-b')).toBe(true);
    });
});

describe('real Social slice receives errors from the real stats reader', () => {
    it.each(tables)(
        'retains independent community evidence and safe partial DTO when %s count fails',
        async (table) => {
            io.responses['client-a'][table] = {
                count: 0,
                data: [{ id: 'contradictory' }],
                error: { message: 'private SQL token fixture' },
            };
            io.rows.community_clusters = [
                { cluster_type: 'theme', label: 'Observed theme', mention_count: 2, sources: [] },
            ];
            io.rows.community_opportunities = [
                { opportunity_type: 'content', title: 'Observed opportunity', mention_count: 1 },
            ];
            io.rows.community_collection_runs = { id: 'run-a', status: 'completed', documents_persisted: 4 };
            const data = await getSocialSlice('client-a');
            expect(data.status).toBe('partial');
            expect(data.dataSources.stats).toBe('unavailable');
            expect(data.errors).toContainEqual({ source: 'stats', message: 'Données temporairement indisponibles.' });
            for (const field of fields) expect(data.summary[field + '_count']).toBeNull();
            expect(data.summary.last_run).toMatchObject({ id: 'run-a', status: 'completed', documents_persisted: 4 });
            expect(data.topThemes[0].label).toBe('Observed theme');
            expect(data.contentOpportunities[0].title).toBe('Observed opportunity');
            expect(data.connection.status).toBe('unavailable');
            expect(JSON.stringify(data)).not.toMatch(/private|SQL|token fixture|contradictory/);
            expect(io.client).toHaveBeenCalledWith('client-a');
            expect(io.connectors).toHaveBeenCalledWith('client-a');
            expect(io.queries.every((query) => query.filters[0][1] === 'client-a')).toBe(true);
        },
    );
    it('keeps successful zero stats distinct from rejected stats in Social', async () => {
        setCounts('client-a', [0, 0, 0, 0]);
        const data = await getSocialSlice('client-a');
        expect(data.status).toBe('available');
        expect(data.errors).toEqual([]);
        expect(data.summary.documents_count).toBe(0);
        expect(data.summary.mentions_count).toBe(0);
        expect(data.connection.status).toBe('connected_empty');
    });
});
