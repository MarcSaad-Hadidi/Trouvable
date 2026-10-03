import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ from: vi.fn(), results: {}, overview: vi.fn(), readiness: vi.fn(),
    client: vi.fn(), audit: vi.fn(), recentAudits: vi.fn(), actions: vi.fn(), opportunities: vi.fn(), merges: vi.fn(), remediation: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({ from: io.from }) }));
vi.mock('@/lib/operator-intelligence/overview', () => ({ getOverviewSlice: io.overview }));
vi.mock('@/lib/operator-intelligence/geo-readiness', () => ({ getReadinessSlice: io.readiness }));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: io.audit, getRecentAudits: io.recentAudits }));
vi.mock('@/lib/db/actions', () => ({ getActions: io.actions }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: io.opportunities }));
vi.mock('@/lib/db/merge-suggestions', () => ({ getMergeSuggestions: io.merges }));
vi.mock('@/lib/remediation/remediation-store', () => ({ listRemediationSuggestionsForClient: io.remediation }));

import { getOperatorWorkspaceShell } from '../operator-intelligence/base.js';
import { getRecentSafeActivity } from '../operator-intelligence/activity.js';
import { getOpportunitySlice } from '../operator-intelligence/opportunities.js';
import { getAgentVisibilitySlice } from '../agent/agent-visibility-slice.js';
import { getAgentSlice } from '../agent/agent-slice.js';
import { getAgentFixesSlice } from '../agent/agent-fixes-slice.js';
import { buildAgentRemediationPipeline } from '../agent/remediation-pipeline.js';

function installShellDatabase() {
    io.from.mockImplementation((table) => {
        let head = false; const filters = {};
        const q = {
            select(_fields, options) { head = options?.head === true; return q; },
            eq(key, value) { filters[key] = value; return q; },
            order() { return q; }, limit() { return q; }, or() { return q; }, single() { return q; }, maybeSingle() { return q; },
            then(resolve, reject) {
                const key = table === 'client_geo_profiles' ? 'client' : table === 'client_site_audits' ? 'audit'
                    : table === 'tracked_queries' ? (filters.is_active ? 'activeTrackedQueries' : 'trackedQueries')
                        : table === 'query_runs' ? (head ? 'totalQueryRuns' : 'lastRun')
                            : table === 'opportunities' ? 'openOpportunities' : table === 'merge_suggestions' ? 'pendingMerge' : 'lastAction';
                const result = io.results[key] || { data: null, count: 0, error: null };
                return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject);
            },
        };
        return q;
    });
}
const emptyOverview = () => ({ status: 'available', errors: [], dataSources: { trackedQueries: 'empty', totalQueryRuns: 'empty', audit: 'empty' },
    kpis: { trackedPromptsTotal: 0, completedRunsTotal: 0, competitorMentionsCount: 0, genericMentionsCount: 0 }, visibility: {} });
const emptyOpportunities = () => ({ active: [], stale: [] });

beforeEach(() => {
    vi.clearAllMocks();
    io.results = { client: { data: { id: 'client-a', client_name: 'A', updated_at: '2026-01-01' }, error: null } };
    installShellDatabase();
    io.overview.mockResolvedValue(emptyOverview());
    io.readiness.mockResolvedValue({ available: false, topBlockers: [] });
    io.client.mockResolvedValue({ id: 'client-a', client_name: 'A' });
    io.audit.mockResolvedValue(null); io.recentAudits.mockResolvedValue([]); io.actions.mockResolvedValue([]);
    io.opportunities.mockResolvedValue(emptyOpportunities()); io.merges.mockResolvedValue([]); io.remediation.mockResolvedValue([]);
});

describe('operator shell source availability', () => {
    it('preserves successful empty counts as measured zero', async () => {
        const shell = await getOperatorWorkspaceShell('client-a');
        expect(shell.workspace).toMatchObject({ trackedPromptCount: 0, activeTrackedPromptCount: 0, completedRunCount: 0, openOpportunityCount: 0, pendingMergeCount: 0 });
        expect(shell.status).toBe('available');
        expect(shell.dataSources.trackedQueries).toBe('empty');
    });
    it('retains independent count and audit data while failed counts and latest run become unavailable', async () => {
        io.results.totalQueryRuns = { count: null, error: { message: 'secret SQL table' } };
        io.results.lastRun = new Error('private transport stack');
        io.results.trackedQueries = { count: 3, error: null };
        io.results.audit = { data: { id: 'audit-a', seo_score: 72, geo_score: 0, created_at: '2026-01-02' }, error: null };
        const shell = await getOperatorWorkspaceShell('client-a');
        expect(shell.workspace).toMatchObject({ trackedPromptCount: 3, completedRunCount: null, seoScore: 72, geoScore: 0, latestRunAt: null });
        expect(shell.status).toBe('partial');
        expect(shell.dataSources).toMatchObject({ totalQueryRuns: 'unavailable', lastRun: 'unavailable' });
        expect(JSON.stringify(shell.errors)).not.toMatch(/secret|SQL|stack|transport/);
    });
    it('retains client and counts when audit and latest action fail', async () => {
        io.results.audit = { data: null, error: { message: 'private audit query' } };
        io.results.lastAction = { data: { created_at: '2026-01-03' }, error: { message: 'private action query' } };
        const shell = await getOperatorWorkspaceShell('client-a');
        expect(shell.workspace).toMatchObject({ completedRunCount: 0, seoScore: null, geoScore: null, issueCount: null, latestActivityAt: null });
        expect(shell.status).toBe('partial');
    });
    it.each([null, undefined, '', false, Infinity, -1])('rejects invalid count %s rather than manufacturing zero', async (count) => {
        io.results.trackedQueries = { count, error: null };
        const shell = await getOperatorWorkspaceShell('client-a');
        expect(shell.workspace.trackedPromptCount).toBeNull();
        expect(shell.dataSources.trackedQueries).toBe('unavailable');
    });
    it('distinguishes a missing client from a required client query failure', async () => {
        io.results.client = { data: null, error: null };
        expect(await getOperatorWorkspaceShell('missing')).toBeNull();
        io.results.client = { data: null, error: { message: 'SQL credentials private' } };
        await expect(getOperatorWorkspaceShell('client-a')).rejects.toMatchObject({ code: 'OPERATOR_CLIENT_UNAVAILABLE', message: 'Données client temporairement indisponibles.' });
    });
});

describe('safe independent activity and opportunity sources', () => {
    it('retains successful activity when audit history fails', async () => {
        io.recentAudits.mockRejectedValue(new Error('private SQL'));
        io.actions.mockResolvedValue([{ id: 'action-a', action_type: 'tracked_query_created', created_at: '2026-01-02' }]);
        const activity = await getRecentSafeActivity('client-a');
        expect(activity.items).toHaveLength(1);
        expect(activity.status).toBe('partial');
        expect(activity.dataSources.audits).toBe('unavailable');
        expect(JSON.stringify(activity.errors)).not.toContain('SQL');
    });
    it('retains measured opportunity totals while failed review sources are unknown', async () => {
        io.opportunities.mockResolvedValue({ active: [{ id: 'opp-a', title: 'Observed issue', status: 'open', source: 'observed' }], stale: [] });
        io.merges.mockRejectedValue(new Error('private merge SQL'));
        const opportunities = await getOpportunitySlice('client-a');
        expect(opportunities.summary.open).toBe(1);
        expect(opportunities.summary.pendingMergeCount).toBeNull();
        expect(opportunities.summary.reviewQueueCount).toBeNull();
        expect(opportunities.status).toBe('partial');
        expect(opportunities.dataSources.merges).toBe('unavailable');
    });
});

describe('Agent availability through visibility and remediation', () => {
    it('preserves canonical unknown counts and partial source metadata', async () => {
        io.overview.mockResolvedValue({ status: 'partial', dataSources: { trackedQueries: 'unavailable', totalQueryRuns: 'unavailable' }, errors: [{ source: 'trackedQueries', message: 'Données temporairement indisponibles.' }],
            kpis: { trackedPromptsTotal: null, completedRunsTotal: null, competitorMentionsCount: null, genericMentionsCount: null } });
        const visibility = await getAgentVisibilitySlice('client-a');
        expect(visibility.kpis).toMatchObject({ trackedPromptsTotal: null, completedRunsTotal: null, competitorMentionsCount: null, genericMentionsCount: null });
        expect(visibility.promptCoverage.active).toBeNull();
        expect(visibility.status).toBe('partial');
        expect(visibility.emptyState.description).not.toMatch(/Aucun prompt|aucune exécution/);
    });
    it('does not claim a missing audit or synthesize actionability fixes after an audit read failure', async () => {
        io.audit.mockRejectedValue(new Error('private audit SQL'));
        const slice = await getAgentSlice('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.inputs.actionability).toBeNull();
        expect(slice.inputs.advancedProtocols).toBeNull();
        expect(slice.emptyState.description).not.toContain('Aucun audit');
    });
    it('retains numeric legacy visibility payloads without inventing a load error', async () => {
        io.overview.mockResolvedValue({ kpis: { trackedPromptsTotal: 0, completedRunsTotal: 0 } });
        const slice = await getAgentVisibilitySlice('client-a');
        expect(slice.status).toBe('available');
        expect(slice.errors).toEqual([]);
        expect(slice.kpis.trackedPromptsTotal).toBe(0);
    });
    it('keeps genuine zero counts eligible for a measured empty state', async () => {
        const visibility = await getAgentVisibilitySlice('client-a');
        expect(visibility.kpis.trackedPromptsTotal).toBe(0);
        expect(visibility.emptyState.description).toContain('Aucun prompt');
    });
    it('does not prescribe missing prompts, missing runs or weak metric fixes for unknown data', () => {
        const pipeline = buildAgentRemediationPipeline({ overviewSlice: { status: 'partial', dataSources: { trackedQueries: 'unavailable', totalQueryRuns: 'unavailable' }, kpis: { trackedPromptsTotal: null, completedRunsTotal: null } } });
        expect(pipeline.items.filter((item) => item.source === 'visibility')).toEqual([]);
        expect(pipeline.items.filter((item) => item.source === 'score_guardrail')).toEqual([]);
    });
    it('keeps genuine no-prompts and no-runs observations actionable', () => {
        expect(buildAgentRemediationPipeline({ overviewSlice: { kpis: { trackedPromptsTotal: 0, completedRunsTotal: 0 } } }).items.map((item) => item.id)).toContain('visibility-no-prompts');
        expect(buildAgentRemediationPipeline({ overviewSlice: { kpis: { trackedPromptsTotal: 2, completedRunsTotal: 0 } } }).items.map((item) => item.id)).toContain('visibility-no-runs');
    });
    it.each([['agent', getAgentSlice], ['fixes', getAgentFixesSlice]])('propagates nested opportunity and overview failures without false counts (%s)', async (_label, loadSlice) => {
        io.overview.mockResolvedValue({ status: 'partial', dataSources: { trackedQueries: 'unavailable', totalQueryRuns: 'unavailable', audit: 'unavailable' }, errors: [], kpis: { trackedPromptsTotal: null, completedRunsTotal: null }, visibility: {} });
        io.merges.mockRejectedValue(new Error('private merge'));
        const slice = await loadSlice('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.topFixes.some((item) => item.id === 'visibility-no-prompts')).toBe(false);
        if (slice.summary) expect(slice.summary.pendingMergeCount).toBeNull();
        if (slice.emptyState) expect(slice.emptyState.description).not.toContain('Aucun audit');
    });
});
