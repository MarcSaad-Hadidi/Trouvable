import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
    client: vi.fn(),
    audit: vi.fn(),
    queries: vi.fn(),
    lastRuns: vi.fn(),
    history: vi.fn(),
    from: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: io.audit }));
vi.mock('@/lib/db/tracked-queries', () => ({ getTrackedQueriesAll: io.queries }));
vi.mock('@/lib/db/query-runs', () => ({ getLastRunPerTrackedQuery: io.lastRuns, getQueryRunsHistory: io.history }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({ from: io.from }) }));
import { getPromptSlice } from '../operator-intelligence/prompts';
const query = { id: 'query-a', category: 'discovery', query_text: 'Pourquoi choisir Acme ?', is_active: true };
beforeEach(() => {
    vi.clearAllMocks();
    io.client.mockResolvedValue({ client_name: 'Acme', business_type: 'plombier', address: { city: 'Montreal' } });
    io.audit.mockResolvedValue(null);
    io.queries.mockResolvedValue([query]);
    io.lastRuns.mockResolvedValue(new Map());
    io.history.mockResolvedValue([]);
    io.from.mockReturnValue({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) });
});
describe('prompt source availability', () => {
    it('preserves known brand inference and successful empty history counters', async () => {
        const slice = await getPromptSlice('client-a');
        expect(slice.status).toBe('available');
        expect(slice.prompts[0]).toMatchObject({
            discovery_mode: 'neutral_brand_check',
            visibility_eligible: false,
            run_history: { total: 0 },
        });
    });
    it('does not infer spontaneous visibility or strong quality when client context fails', async () => {
        io.client.mockRejectedValue(new Error('private client SQL'));
        const slice = await getPromptSlice('client-a');
        const prompt = slice.prompts[0];
        expect(slice.status).toBe('partial');
        expect(slice.dataSources.client).toBe('unavailable');
        expect(prompt.discovery_mode).toBeNull();
        expect(prompt.visibility_eligible).toBeNull();
        expect(prompt.quality_score).toBeNull();
        expect(prompt.quality_status).toBeNull();
        expect(slice.starterPack.prompts).toEqual([]);
        expect(slice.siteContext.resolved_business).toBeNull();
        expect(JSON.stringify(slice)).not.toContain('private client SQL');
    });
    it('preserves explicit stored mode and quality contract even when contextual reads fail', async () => {
        io.client.mockRejectedValue(new Error('private'));
        io.audit.mockRejectedValue(new Error('private'));
        io.queries.mockResolvedValue([
            {
                ...query,
                discovery_mode: 'neutral_brand_check',
                quality_status: 'strong',
                quality_score: 90,
                validation_status: 'strong',
                offer_anchor: 'plomberie',
            },
        ]);
        const slice = await getPromptSlice('client-a');
        expect(slice.prompts[0]).toMatchObject({
            discovery_mode: 'neutral_brand_check',
            visibility_eligible: false,
            quality_status: 'strong',
            quality_score: 90,
            offer_anchor: 'plomberie',
        });
        expect(slice.starterPack.prompts).toEqual([]);
    });
    it('retains latest run while failed history cannot become five zero counters', async () => {
        io.lastRuns.mockResolvedValue(new Map([['query-a', { id: 'run-a', status: 'completed', target_found: true }]]));
        io.history.mockRejectedValue(new Error('private history'));
        const slice = await getPromptSlice('client-a');
        expect(slice.prompts[0].last_run).toMatchObject({ id: 'run-a', status: 'completed' });
        expect(slice.prompts[0].run_history).toBeNull();
        expect(slice.dataSources.runHistory).toBe('unavailable');
        expect(slice.status).toBe('partial');
    });
    it('does not infer a contextual starter pack after an audit failure', async () => {
        io.audit.mockRejectedValue(new Error('private audit'));
        const slice = await getPromptSlice('client-a');
        expect(slice.starterPack.prompts).toEqual([]);
        expect(slice.siteContext.siteType).toBeNull();
    });
    it.each(['client-a', 'client-b'])('scopes prompt reads to %s', async (clientId) => {
        await getPromptSlice(clientId);
        for (const key of ['client', 'audit', 'queries', 'lastRuns']) expect(io[key]).toHaveBeenCalledWith(clientId);
        expect(io.history).toHaveBeenCalledWith(clientId, 400);
    });
    it('handles synchronous and complete read failure without false prompt totals', async () => {
        for (const key of ['client', 'audit', 'queries', 'lastRuns', 'history'])
            io[key].mockImplementation(() => {
                throw new Error('private');
            });
        const slice = await getPromptSlice('client-a');
        expect(slice.status).toBe('unavailable');
        expect(slice.summary.total).toBeNull();
    });
    it('retains query totals when latest-run retrieval fails without fabricating no-run or mode metrics', async () => {
        io.lastRuns.mockRejectedValue(new Error('private'));
        const slice = await getPromptSlice('client-a');
        expect(slice.summary.total).toBe(1);
        expect(slice.summary.noRunYet).toBeNull();
        expect(slice.summary.latestStatusCounts).toBeNull();
        expect(slice.prompts[0].lifecycle).toEqual({ latest_status: null, has_run: null });
        expect(slice.summary.visibilityByMode.blind_discovery.with_run).toBeNull();
    });
    it('keeps known last-run classification and measurement when client inference is unavailable', async () => {
        io.client.mockRejectedValue(new Error('private'));
        io.lastRuns.mockResolvedValue(
            new Map([
                [
                    'query-a',
                    {
                        id: 'run-a',
                        status: 'completed',
                        discovery_mode: 'neutral_brand_check',
                        parsed_response: { measurement_outcome: 'assisted_mention' },
                    },
                ],
            ]),
        );
        const slice = await getPromptSlice('client-a');
        expect(slice.prompts[0].last_run).toMatchObject({
            discovery_mode: 'neutral_brand_check',
            visibility_eligible: false,
            measurement_outcome: 'assisted_mention',
        });
        expect(slice.summary.visibilityByMode.blind_discovery.total_prompts).toBeNull();
    });
    it('does not erase last-run data when mention reads fail', async () => {
        io.lastRuns.mockResolvedValue(new Map([['query-a', { id: 'run-a', status: 'completed' }]]));
        io.from.mockReturnValue({
            select: () => ({
                in: () =>
                    Promise.resolve({
                        data: [{ entity_type: 'source' }],
                        error: { message: 'private query_mentions SQL' },
                    }),
            }),
        });
        const slice = await getPromptSlice('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.prompts[0].last_run.id).toBe('run-a');
        expect(slice.prompts[0].last_run.mention_counts).toBeNull();
        expect(JSON.stringify(slice)).not.toContain('private query_mentions SQL');
    });
    it('preserves zero-valued quality metadata and stored nested modes without client context', async () => {
        io.client.mockRejectedValue(new Error('private'));
        io.queries.mockResolvedValue([
            {
                ...query,
                prompt_metadata: {
                    discovery_mode: 'blind_discovery',
                    quality_status: 'weak',
                    quality_score: 0,
                    validation_reasons: ['Existing persisted reason'],
                },
            },
        ]);
        const slice = await getPromptSlice('client-a');
        expect(slice.prompts[0]).toMatchObject({
            discovery_mode: 'blind_discovery',
            visibility_eligible: true,
            quality_score: 0,
            quality_status: 'weak',
            validation_reasons: ['Existing persisted reason'],
        });
    });
    it('retains successful empty and null sources without claiming a read failure', async () => {
        io.queries.mockResolvedValue([]);
        io.client.mockResolvedValue(null);
        io.history.mockResolvedValue(null);
        const slice = await getPromptSlice('client-a');
        expect(slice.status).toBe('available');
        expect(slice.summary.total).toBe(0);
        expect(slice.dataSources.client).toBe('empty');
        expect(slice.dataSources.runHistory).toBe('empty');
    });
});
