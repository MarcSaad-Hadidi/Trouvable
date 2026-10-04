import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ tables: {}, failures: {}, calls: [], adminFailure: false, database: null }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/core', () => ({ db: () => io.database }));
vi.mock('@/lib/supabase-admin', () => ({
    getAdminSupabase: () => {
        if (io.adminFailure) throw new Error('private service initialization');
        return io.database;
    },
}));

// Real overview, snapshot, KPI derivations, activity and domain readers are exercised.
// Only the database boundary is replaced; no upstream view DTO is fabricated.
import { getOverviewSlice } from '../operator-intelligence/overview.js';
import { getAgentVisibilitySlice } from '../agent/agent-visibility-slice.js';
import { getProvenanceMeta } from '../operator-intelligence/provenance.js';

function sourceFor(call) {
    if (call.table === 'client_site_audits')
        return call.single ? 'audit' : call.limit === 24 ? 'auditHistory' : 'activity.audits';
    if (call.table === 'tracked_queries')
        return call.head ? (call.filters.is_active ? 'activeTrackedQueries' : 'totalTrackedQueries') : 'trackedQueries';
    if (call.table === 'query_runs') {
        if (call.head) return call.filters.target_found ? 'brandRecommendations' : 'totalQueryRuns';
        if (call.columns === 'created_at') return 'lastRun';
        if (call.columns === 'raw_analysis') return 'diagnostics';
        return call.columns.includes('parsed_response') ? 'runHistory' : 'runs';
    }
    if (call.table === 'opportunities') return call.head ? 'openOpportunities' : 'opportunities';
    if (call.table === 'actions') return 'activity.actions';
    if (call.table === 'query_mentions') return 'mentions';
    return 'pendingMerge';
}

function installDatabase() {
    io.database = {
        from(table) {
            const call = { table, filters: {}, inclusions: {}, columns: '', head: false, single: false };
            const query = {
                select(columns, options) {
                    call.columns = columns;
                    call.head = options?.head === true;
                    return query;
                },
                eq(key, value) {
                    call.filters[key] = value;
                    return query;
                },
                in(key, values) {
                    call.inclusions[key] = values;
                    return query;
                },
                or(value) {
                    call.or = value;
                    return query;
                },
                order(key, options) {
                    call.order = { key, ascending: options?.ascending !== false };
                    return query;
                },
                limit(value) {
                    call.limit = value;
                    return query;
                },
                single() {
                    call.single = true;
                    return query;
                },
                maybeSingle() {
                    call.single = true;
                    return query;
                },
                then(resolve, reject) {
                    call.source = sourceFor(call);
                    io.calls.push(call);
                    const failure = io.failures[`${call.filters.client_id}:${call.source}`] ?? io.failures[call.source];
                    if (failure) {
                        return (failure instanceof Error ? Promise.reject(failure) : Promise.resolve(failure)).then(
                            resolve,
                            reject,
                        );
                    }
                    let rows = (io.tables[table] || []).filter(
                        (row) =>
                            Object.entries(call.filters).every(([key, value]) => row[key] === value) &&
                            Object.entries(call.inclusions).every(([key, values]) => values.includes(row[key])),
                    );
                    if (call.or === 'run_mode.is.null,run_mode.eq.standard')
                        rows = rows.filter((row) => row.run_mode == null || row.run_mode === 'standard');
                    const count = rows.length;
                    if (call.order) {
                        const { key, ascending } = call.order;
                        rows = rows.slice().sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')));
                        if (!ascending) rows.reverse();
                    }
                    if (call.limit) rows = rows.slice(0, call.limit);
                    return Promise.resolve(
                        call.head
                            ? { count, error: null }
                            : { data: call.single ? rows[0] || null : rows, error: null },
                    ).then(resolve, reject);
                },
            };
            return query;
        },
    };
}

function addFixture(clientId) {
    const auditId = `${clientId}-audit`;
    io.tables.client_site_audits.push({
        id: auditId,
        client_id: clientId,
        created_at: '2026-09-01T12:00:00Z',
        scan_status: 'success',
        seo_score: '72',
        geo_score: '0',
    });
    for (let group = 0; group < 9; group += 1) {
        const queryId = `${clientId}-prompt-${group}`;
        io.tables.tracked_queries.push({ id: queryId, client_id: clientId, is_active: group !== 8 });
        for (let run = 0; run < 9 - group; run += 1) {
            io.tables.query_runs.push({
                id: `${clientId}-run-${group}-${run}`,
                client_id: clientId,
                tracked_query_id: queryId,
                provider: `provider-${group}`,
                model: `${clientId}-model-${group}`,
                status: 'completed',
                run_mode: group === 0 ? null : 'standard',
                target_found: group % 2 === 0,
                created_at: '2026-10-01T12:00:00Z',
                parse_confidence: 0.8,
                parse_status: 'parsed_success',
            });
        }
        for (let mention = 0; mention < 9 - group; mention += 1) {
            io.tables.query_mentions.push(
                {
                    query_run_id: `${clientId}-run-0-0`,
                    entity_type: 'source',
                    business_name: `${clientId}-host-${group}.test`,
                    created_at: '2026-10-01T12:00:00Z',
                },
                {
                    query_run_id: `${clientId}-run-0-0`,
                    entity_type: 'competitor',
                    business_name: `${clientId}-competitor-${group}`,
                },
            );
        }
    }
    io.tables.query_mentions.push({ query_run_id: `${clientId}-run-0-0`, entity_type: 'generic_mention' });
    io.tables.opportunities.push(
        { id: `${clientId}-low`, client_id: clientId, status: 'open', priority: 'low', audit_id: auditId },
        { id: `${clientId}-high`, client_id: clientId, status: 'open', priority: 'high', source: 'observed' },
        { id: `${clientId}-stale`, client_id: clientId, status: 'open', audit_id: 'older-audit' },
    );
    io.tables.actions.push({
        id: `${clientId}-action`,
        client_id: clientId,
        action_type: 'geo_queries_run',
        details: { successful: 2, total_queries: 3 },
        created_at: '2026-10-02T12:00:00Z',
    });
    // Both readers must exclude benchmark runs, while retaining historical null run_mode.
    io.tables.query_runs.push({
        id: `${clientId}-benchmark`,
        client_id: clientId,
        status: 'completed',
        run_mode: 'benchmark',
        target_found: true,
        model: 'excluded-benchmark',
        created_at: '2026-10-03T12:00:00Z',
    });
}

beforeEach(() => {
    io.tables = {
        client_site_audits: [],
        tracked_queries: [],
        query_runs: [],
        query_mentions: [],
        opportunities: [],
        merge_suggestions: [],
        actions: [],
    };
    io.failures = {};
    io.calls = [];
    io.adminFailure = false;
    installDatabase();
});

describe.each([
    { name: 'overview', read: getOverviewSlice },
    { name: 'agent visibility', read: getAgentVisibilitySlice },
])('$name projection from real source readers', ({ name, read }) => {
    it('preserves observed KPIs, historical numeric scores, provenance, freshness and ordered limits', async () => {
        addFixture('client-a');
        const result = await read('client-a');
        expect(result.status).toBe('available');
        expect(result.errors).toEqual([]);
        expect(result.dataSources).toEqual({
            audit: 'available',
            openOpportunities: 'available',
            pendingMerge: 'available',
            activeTrackedQueries: 'available',
            totalTrackedQueries: 'available',
            totalQueryRuns: 'available',
            brandRecommendations: 'available',
            runs: 'available',
            lastRun: 'available',
            trackedQueries: 'available',
            diagnostics: 'available',
            mentions: 'available',
            opportunities: 'available',
            activity: 'available',
            'activity.audits': 'available',
            'activity.actions': 'available',
            auditHistory: 'available',
            runHistory: 'available',
        });
        expect(result.kpis).toMatchObject({
            completedRunsTotal: 45,
            trackedPromptsTotal: 9,
            mentionRatePercent: 56,
            visibilityProxyPercent: 56,
            citationCoveragePercent: 2,
            competitorMentionsCount: 45,
            genericMentionsCount: 1,
            visibilityProxyReliability: 'high',
            avgParseConfidence: 0.8,
            parseFailureRate: 0,
        });
        expect(result.provenance).toEqual({
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        });
        const models = name === 'overview' ? result.visibility.topProvidersModels : result.topModels;
        const competitors = name === 'overview' ? result.competitors.topCompetitors : result.topCompetitors;
        const sources = name === 'overview' ? result.sources.topHosts : result.topSources;
        expect(models.map((row) => row.model)).toEqual(Array.from({ length: 5 }, (_, i) => `client-a-model-${i}`));
        expect(models.map((row) => row.runs)).toEqual([9, 8, 7, 6, 5]);
        expect(competitors).toEqual(
            Array.from({ length: 6 }, (_, i) => ({ name: `client-a-competitor-${i}`, count: 9 - i })),
        );
        expect(sources).toEqual(
            Array.from({ length: 6 }, (_, i) => ({ host: `client-a-host-${i}.test`, count: 9 - i })),
        );
        const coverage = name === 'overview' ? result.visibility.promptCoverage : result.promptCoverage;
        expect(coverage).toEqual({
            total: 9,
            active: 8,
            withTargetFound: 5,
            withRunNoTarget: 4,
            noRunYet: 0,
            mentionRatePercent: 56,
        });
        if (name === 'overview') {
            expect(result.kpis).toMatchObject({ seoScore: 72, geoScore: 0, openOpportunitiesCount: 2 });
            expect(result.opportunities.openItems.map((row) => row.id)).toEqual(['client-a-high', 'client-a-low']);
            expect(result.opportunities.openItems[0].provenance).toEqual(getProvenanceMeta('observed'));
            expect(result.visibility).toMatchObject({
                lastAuditAt: '2026-09-01T12:00:00Z',
                lastGeoRunAt: '2026-10-01T12:00:00Z',
            });
            expect(result.recentActivity.map((row) => row.id)).toEqual([
                'action-client-a-action',
                'audit-client-a-audit',
            ]);
        } else {
            expect(result.freshness).toEqual({
                lastAuditAt: '2026-09-01T12:00:00Z',
                lastRunAt: '2026-10-01T12:00:00Z',
            });
            expect(result.links).toEqual({
                prompts: '/admin/clients/client-a/geo/prompts',
                runs: '/admin/clients/client-a/geo/runs',
                models: '/admin/clients/client-a/geo/models',
                continuous: '/admin/clients/client-a/geo/continuous',
            });
            expect(result.emptyState).toBeNull();
            expect(result).not.toHaveProperty('opportunities');
        }
        expect(io.calls).toHaveLength(18);
        expect(io.calls.filter((call) => call.source === 'audit')).toHaveLength(2);
        expect(io.calls.filter((call) => call.source === 'mentions')[0].inclusions.query_run_id).toHaveLength(45);
        expect(io.calls.every((call) => call.source === 'mentions' || call.filters.client_id === 'client-a')).toBe(
            true,
        );
    });

    it('keeps successful zero counts distinct from unavailable metrics and performs no empty mention query', async () => {
        const result = await read('client-a');
        expect(result.status).toBe('available');
        expect(result.kpis).toMatchObject({
            completedRunsTotal: 0,
            trackedPromptsTotal: 0,
            competitorMentionsCount: 0,
            genericMentionsCount: 0,
            mentionRatePercent: null,
            visibilityProxyPercent: null,
            citationCoveragePercent: null,
        });
        expect(result.dataSources).toMatchObject({ runs: 'empty', mentions: 'empty', totalQueryRuns: 'available' });
        expect(io.calls).toHaveLength(17);
        expect(io.calls.some((call) => call.source === 'mentions')).toBe(false);
        if (name === 'agent visibility') expect(result.emptyState.description).toContain('Aucun prompt');
    });

    it('preserves measured zero percentages when completed runs contain no target or source', async () => {
        addFixture('client-a');
        io.tables.query_runs.forEach((run) => {
            run.target_found = false;
        });
        io.tables.query_mentions = [];
        const result = await read('client-a');
        expect(result.status).toBe('available');
        expect(result.kpis).toMatchObject({
            completedRunsTotal: 45,
            mentionRatePercent: 0,
            visibilityProxyPercent: 0,
            citationCoveragePercent: 0,
            competitorMentionsCount: 0,
            genericMentionsCount: 0,
        });
        if (name === 'agent visibility') expect(result.emptyState).toBeNull();
    });

    it('distinguishes followed prompts with no runs from an unavailable run source', async () => {
        io.tables.tracked_queries.push({ id: 'client-a-prompt', client_id: 'client-a', is_active: true });
        const result = await read('client-a');
        expect(result.kpis).toMatchObject({ trackedPromptsTotal: 1, completedRunsTotal: 0 });
        const coverage = name === 'overview' ? result.visibility.promptCoverage : result.promptCoverage;
        expect(coverage.noRunYet).toBe(1);
        if (name === 'agent visibility') expect(result.emptyState.title).toBe('Aucune exécution moteur');
    });

    it.each([
        ['trackedQueries', 'trackedPromptsTotal'],
        ['totalQueryRuns', 'completedRunsTotal'],
        ['brandRecommendations', 'visibilityProxyPercent'],
        ['mentions', 'citationCoveragePercent'],
        ['runs', 'mentionRatePercent'],
    ])('retains unrelated observations when %s fails', async (source, unknownMetric) => {
        addFixture('client-a');
        io.failures[source] = { data: [{ id: 'unsafe-data' }], count: 99, error: { message: 'private SQL detail' } };
        const result = await read('client-a');
        expect(result.status).toBe('partial');
        expect(result.dataSources[source]).toBe('unavailable');
        expect(result.kpis[unknownMetric]).toBeNull();
        if (source !== 'totalQueryRuns') expect(result.kpis.completedRunsTotal).toBe(45);
        if (source !== 'trackedQueries') expect(result.kpis.trackedPromptsTotal).toBe(9);
        expect(JSON.stringify(result)).not.toMatch(/private SQL|unsafe-data/);
        if (name === 'agent visibility' && ['trackedQueries', 'totalQueryRuns'].includes(source))
            expect(result.emptyState.description).not.toMatch(/Aucun prompt|aucune exécution/);
    });

    it.each([null, undefined, '0', Infinity])(
        'does not convert an absent or invalid count (%s) to zero',
        async (count) => {
            io.failures.totalQueryRuns = { count, error: null };
            const result = await read('client-a');
            expect(result.status).toBe('partial');
            expect(result.kpis.completedRunsTotal).toBeNull();
            expect(result.dataSources.totalQueryRuns).toBe('unavailable');
            if (name === 'agent visibility') expect(result.emptyState.description).not.toContain('Aucune exécution');
        },
    );

    it.each(['opportunities', 'auditHistory', 'runHistory', 'activity.audits', 'activity.actions'])(
        'preserves full diagnostics from the independent %s branch even for agent visibility',
        async (source) => {
            addFixture('client-a');
            io.failures[source] = new Error('private transport stack');
            const result = await read('client-a');
            expect(result.status).toBe('partial');
            expect(result.dataSources[source]).toBe('unavailable');
            expect(result.errors).toContainEqual({ source, message: 'Données temporairement indisponibles.' });
            expect(result.kpis.completedRunsTotal).toBe(45);
            expect(result.kpis.mentionRatePercent).toBe(56);
            expect(JSON.stringify(result)).not.toContain('private transport');
            expect(io.calls).toHaveLength(18);
        },
    );

    it('keeps client A and B isolated through the same real readers without shared projection state', async () => {
        addFixture('client-a');
        addFixture('client-b');
        io.failures['client-a:trackedQueries'] = new Error('private A error');
        const a = await read('client-a');
        const aSerialized = JSON.stringify(a);
        const b = await read('client-b');
        expect(a.status).toBe('partial');
        expect(b.status).toBe('available');
        expect(b.kpis.trackedPromptsTotal).toBe(9);
        expect(b.kpis.completedRunsTotal).toBe(45);
        expect(JSON.stringify(b)).not.toContain('client-a');
        expect(aSerialized).not.toContain('client-b');
        expect(JSON.stringify(a)).toBe(aSerialized);
        expect(io.calls).toHaveLength(36);
        const mentionCalls = io.calls.filter((call) => call.source === 'mentions');
        expect(mentionCalls[0].inclusions.query_run_id.every((id) => id.startsWith('client-a-'))).toBe(true);
        expect(mentionCalls[1].inclusions.query_run_id.every((id) => id.startsWith('client-b-'))).toBe(true);
    });
});

describe('fatal snapshot acquisition without dropping independent branches', () => {
    it('rejects overview safely and retains the agent unavailable contract', async () => {
        io.adminFailure = true;
        await expect(getOverviewSlice('client-a')).rejects.toThrow('Données temporairement indisponibles.');
        expect(io.calls).toHaveLength(6);
        io.calls = [];
        const result = await getAgentVisibilitySlice('client-a');
        expect(io.calls).toHaveLength(6);
        expect(result.status).toBe('unavailable');
        expect(result.dataSources).toEqual({ overview: 'unavailable' });
        expect(result.errors).toEqual([{ source: 'overview', message: 'Données temporairement indisponibles.' }]);
        expect(result.kpis.completedRunsTotal).toBeNull();
        expect(result.kpis.trackedPromptsTotal).toBeNull();
        expect(result.promptCoverage.active).toBeNull();
        expect(result.topModels).toEqual([]);
        expect(result.topSources).toEqual([]);
        expect(result.topCompetitors).toEqual([]);
        expect(JSON.stringify(result)).not.toContain('private service');
    });
});
