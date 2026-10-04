import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
    client: vi.fn(),
    insertRun: vi.fn(),
    updateRun: vi.fn(),
    documents: vi.fn(),
    listDocuments: vi.fn(),
    deleteMentions: vi.fn(),
    insertMentions: vi.fn(),
    markProcessed: vi.fn(),
    clearClusters: vi.fn(),
    clusters: vi.fn(),
    opportunities: vi.fn(),
    existingOpportunities: vi.fn(),
    createOpportunities: vi.fn(),
    listMentions: vi.fn(),
    searchAvailable: vi.fn(),
    webSearch: vi.fn(),
    task: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/db/opportunities', () => ({
    getOpportunitiesBySource: io.existingOpportunities,
    createOpportunities: io.createOpportunities,
}));
vi.mock('@/lib/db/community', () => ({
    insertCollectionRun: io.insertRun,
    updateCollectionRun: io.updateRun,
    upsertDocuments: io.documents,
    listDocuments: io.listDocuments,
    deleteMentionsForDocuments: io.deleteMentions,
    insertMentions: io.insertMentions,
    markDocumentsProcessed: io.markProcessed,
    clearClusters: io.clearClusters,
    upsertClusters: io.clusters,
    upsertOpportunities: io.opportunities,
}));
vi.mock('@/lib/supabase-admin', () => ({
    getAdminSupabase: () => ({ from: () => ({ select: () => ({ eq: io.listMentions }) }) }),
}));
vi.mock('@/lib/agent-reach/web-search-collector', () => ({
    isWebSearchAvailable: io.searchAvailable,
    collectViaWebSearch: io.webSearch,
}));
vi.mock('@/lib/ai/tasks/registry', () => ({ executeTask: io.task }));
vi.mock('@/lib/ai/tasks/community-classify', () => ({}));
vi.mock('@/lib/ai/tasks/community-labels', () => ({}));
vi.mock('@/lib/ai/tasks/community-synthesize', () => ({}));

async function runPipeline() {
    const { runCommunityPipeline } = await import('@/lib/agent-reach/pipeline');
    const pending = runCommunityPipeline('client');
    await vi.runAllTimersAsync();
    return pending;
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv('COMMUNITY_USE_LLM_ENRICHMENT', 'false');
    io.client.mockResolvedValue({ client_name: 'Acme', business_type: '', address: {} });
    io.insertRun.mockResolvedValue({ id: 'run' });
    io.updateRun.mockResolvedValue({});
    io.documents.mockResolvedValue({ persisted: 0, skipped: 0 });
    io.listDocuments.mockResolvedValue([]);
    io.listMentions.mockResolvedValue({ data: [], error: null });
    io.clusters.mockImplementation(async (rows) => rows);
    io.existingOpportunities.mockResolvedValue([]);
    io.createOpportunities.mockResolvedValue([]);
    io.searchAvailable.mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { children: [] } }) }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('community pipeline terminal states and ordered effects', () => {
    it('does not start a collection for a missing client', async () => {
        io.client.mockResolvedValue(null);
        expect(await runPipeline()).toEqual({ success: false, error: 'Client introuvable', summary: {} });
        expect(io.insertRun).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('records blocked access as partial without clearing existing clusters', async () => {
        fetch.mockResolvedValue({ ok: false, status: 403 });
        const result = await runPipeline();
        expect(result.success).toBe(false);
        expect(result.summary).toMatchObject({
            is_access_failure: true,
            failure_class: 'source_access_failure',
            documents_collected: 0,
        });
        expect(io.updateRun).toHaveBeenLastCalledWith('run', expect.objectContaining({ status: 'partial' }));
        expect(io.documents).not.toHaveBeenCalled();
        expect(io.clearClusters).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('completes a successful empty collection without inventing mentions', async () => {
        const result = await runPipeline();
        expect(result).toMatchObject({
            success: true,
            summary: { documents_collected: 0, failure_class: 'seed_quality_failure' },
        });
        expect(io.deleteMentions).not.toHaveBeenCalled();
        expect(io.markProcessed).not.toHaveBeenCalled();
        expect(io.clearClusters).toHaveBeenCalledWith('client');
        expect(io.updateRun).toHaveBeenLastCalledWith(
            'run',
            expect.objectContaining({
                status: 'completed',
                run_context: expect.objectContaining({ enrichment_method: 'keyword' }),
            }),
        );
    });

    it('preserves normalization provenance and replacement order with web fallback', async () => {
        fetch.mockResolvedValue({ ok: false, status: 403 });
        io.searchAvailable.mockReturnValue(true);
        io.webSearch.mockResolvedValue({
            posts: [
                {
                    id: 'external',
                    title: 'Best Acme?',
                    body: '',
                    permalink: 'https://example.com/thread',
                    _source_platform: 'quora',
                    _search_score: 0,
                    ups: 0,
                },
            ],
            seedDiagnostics: [{ status: 'ok', results: 1 }],
            provider: 'fixture',
        });
        io.documents.mockResolvedValue({ persisted: 1, skipped: 0 });
        io.listDocuments.mockResolvedValue([{ id: 'doc', title: 'Best Acme?', source: 'quora' }]);
        const result = await runPipeline();
        expect(result).toMatchObject({
            success: true,
            summary: { collection_source: 'web_search', web_search_provider: 'fixture', documents_persisted: 1 },
        });
        expect(io.documents).toHaveBeenCalledWith([
            expect.objectContaining({
                source: 'quora',
                source_metadata: expect.objectContaining({ search_score: 0 }),
                collection_run_id: 'run',
            }),
        ]);
        expect(io.listDocuments).toHaveBeenCalledWith('client', { unprocessedOnly: true });
        expect(io.deleteMentions).toHaveBeenCalledWith(['doc']);
        expect(io.deleteMentions.mock.invocationCallOrder[0]).toBeLessThan(
            io.insertMentions.mock.invocationCallOrder[0],
        );
        expect(io.insertMentions.mock.invocationCallOrder[0]).toBeLessThan(
            io.markProcessed.mock.invocationCallOrder[0],
        );
        expect(io.markProcessed.mock.invocationCallOrder[0]).toBeLessThan(io.listMentions.mock.invocationCallOrder[0]);
        expect(io.listMentions.mock.invocationCallOrder[0]).toBeLessThan(io.clearClusters.mock.invocationCallOrder[0]);
    });

    it('finalizes a database failure without hiding it as empty data', async () => {
        io.listMentions.mockResolvedValue({ data: null, error: { message: 'read failed' } });
        io.updateRun.mockImplementation(async (id, patch) => {
            if (patch.status === 'failed') throw new Error('finalization failed');
        });
        expect(await runPipeline()).toEqual({
            success: false,
            error: '[Community] listMentionsForClustering: read failed',
            summary: {},
        });
        expect(io.updateRun).toHaveBeenLastCalledWith('run', expect.objectContaining({ status: 'failed' }));
        expect(io.clearClusters).not.toHaveBeenCalled();
    });

    it('uses keyword extraction if LLM returns nothing and isolates optional task failures', async () => {
        vi.stubEnv('COMMUNITY_USE_LLM_ENRICHMENT', 'true');
        io.listDocuments.mockResolvedValue([{ id: 'doc', title: 'Best Acme?', source: 'reddit' }]);
        io.listMentions.mockResolvedValue({
            data: [
                { mention_type: 'question', label: 'Best Acme?', source: 'reddit' },
                { mention_type: 'question', label: 'Best Acme?', source: 'reddit' },
            ],
            error: null,
        });
        io.task.mockImplementation(async (task) => {
            if (task === 'community-classify') return { data: [] };
            throw new Error('provider unavailable');
        });
        const result = await runPipeline();
        expect(result.success).toBe(true);
        expect(result.summary.opportunities_derived).toBe(1);
        expect(io.opportunities).toHaveBeenCalledWith([
            expect.objectContaining({ opportunity_type: 'faq', title: 'FAQ: Best Acme?' }),
        ]);
        expect(io.task.mock.calls.map(([task]) => task)).toEqual([
            'community-classify',
            'community-labels',
            'community-synthesize',
        ]);
        expect(io.updateRun).toHaveBeenLastCalledWith(
            'run',
            expect.objectContaining({ run_context: expect.objectContaining({ enrichment_method: 'keyword' }) }),
        );
    });

    it('deduplicates the action queue bridge and contains insertion failures', async () => {
        io.listMentions.mockResolvedValue({
            data: [
                { mention_type: 'question', label: 'Best Acme?', source: 'reddit' },
                { mention_type: 'question', label: 'Best Acme?', source: 'reddit' },
            ],
            error: null,
        });
        io.existingOpportunities.mockResolvedValue([{ title: 'FAQ: Best Acme?' }]);
        expect((await runPipeline()).success).toBe(true);
        expect(io.createOpportunities).not.toHaveBeenCalled();
        io.existingOpportunities.mockRejectedValue(new Error('read failed'));
        io.createOpportunities.mockRejectedValue(new Error('insert failed'));
        expect((await runPipeline()).success).toBe(true);
        expect(io.createOpportunities).toHaveBeenCalledWith([
            expect.objectContaining({ title: 'FAQ: Best Acme?', source: 'community', truth_class: 'inferred' }),
        ]);
    });

    it('keeps the enrichment flag fixed at import and batches documents without losing successful output', async () => {
        vi.stubEnv('COMMUNITY_USE_LLM_ENRICHMENT', 'true');
        await import('@/lib/agent-reach/pipeline');
        vi.stubEnv('COMMUNITY_USE_LLM_ENRICHMENT', 'false');
        io.listDocuments.mockResolvedValue(
            Array.from({ length: 11 }, (_, i) => ({ id: `doc-${i}`, title: 'Best Acme?', body: 'x'.repeat(700) })),
        );
        io.task.mockResolvedValue({ data: [{ mention_type: 'question', label: 'LLM result' }] });
        expect((await runPipeline()).success).toBe(true);
        expect(io.task.mock.calls.map(([, input]) => input.documents.length)).toEqual([10, 1]);
        expect(io.task.mock.calls[0][1].documents[0]).toMatchObject({ body: 'x'.repeat(600), source: 'unknown' });
        expect(io.insertMentions.mock.calls[0][0]).toHaveLength(2);
        expect(io.updateRun).toHaveBeenLastCalledWith(
            'run',
            expect.objectContaining({ run_context: expect.objectContaining({ enrichment_method: 'llm' }) }),
        );
    });

    it('does not replace a valid empty LLM opportunity array with inferred rules', async () => {
        vi.stubEnv('COMMUNITY_USE_LLM_ENRICHMENT', 'true');
        io.listMentions.mockResolvedValue({
            data: [
                { mention_type: 'question', label: 'Question?', source: 'reddit' },
                { mention_type: 'question', label: 'Question?', source: 'reddit' },
            ],
            error: null,
        });
        io.task.mockImplementation(async (task) => ({
            data:
                task === 'community-labels'
                    ? [{ original: 'Question?', normalized: 'Normalized question', is_duplicate_of: null }]
                    : [],
        }));
        const result = await runPipeline();
        expect(result).toMatchObject({ success: true, summary: { opportunities_derived: 0 } });
        expect(io.task.mock.calls.find(([task]) => task === 'community-synthesize')[1].clusters[0].label).toBe(
            'Normalized question',
        );
        expect(io.clusters.mock.invocationCallOrder[0]).toBeLessThan(io.task.mock.invocationCallOrder[0]);
        expect(io.opportunities).not.toHaveBeenCalled();
    });
});
