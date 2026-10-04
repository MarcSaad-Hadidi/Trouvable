import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ auth: vi.fn(), shell: vi.fn(), audits: {}, suggestions: {}, reads: [], events: [] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ requireAdmin: io.auth }));
vi.mock('@/lib/operator-intelligence/base', () => ({ getOperatorWorkspaceShell: io.shell }));
vi.mock('@/lib/db/core', () => ({
    db: () => ({
        from: (table) => {
            const read = { table, clientId: null, fields: null, order: null, limit: null };
            io.reads.push(read);
            const query = {
                select: (fields) => {
                    read.fields = fields;
                    return query;
                },
                eq: (field, id) => {
                    expect(field).toBe('client_id');
                    read.clientId = id;
                    return query;
                },
                order: (field, options) => {
                    read.order = [field, options];
                    return query;
                },
                limit: (limit) => {
                    read.limit = limit;
                    return query;
                },
                single: async () => {
                    io.events.push('audit:' + read.clientId);
                    return io.audits[read.clientId] || { data: null, error: null };
                },
                then: (resolve, reject) => {
                    const isRemediation = table === 'remediation_suggestions';
                    io.events.push((isRemediation ? 'remediation:' : 'history:') + read.clientId);
                    return Promise.resolve(
                        isRemediation
                            ? io.suggestions[read.clientId] || { data: [], error: null }
                            : { data: [], error: null },
                    ).then(resolve, reject);
                },
            };
            return query;
        },
    }),
}));
vi.mock('@/lib/operator-intelligence/seo-overview', () => ({ getSeoOverviewSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/visibility', () => ({
    getVisibilitySlice: async (id) => {
        io.events.push('visibility:' + id);
        return {
            status: 'available',
            dataSources: { gscQueries: 'not_connected' },
            freshness: { gsc: {} },
            connectors: { gsc: { status: 'not_connected' } },
        };
    },
}));
vi.mock('@/lib/operator-intelligence/seo-content', () => ({
    getSeoContentSlice: async (id) => {
        io.events.push('content:' + id);
        return { emptyState: {}, status: 'available' };
    },
}));
vi.mock('@/lib/operator-intelligence/seo-on-page', () => ({
    getSeoOnPageSlice: async (id) => {
        io.events.push('onPage:' + id);
        return { emptyState: {}, status: 'available' };
    },
}));
vi.mock('@/lib/operator-intelligence/seo-cannibalization', () => ({
    getSeoCannibalizationSlice: async (id) => {
        io.events.push('cannibalization:' + id);
        return { emptyState: {}, status: 'available' };
    },
}));
vi.mock('@/lib/db/gsc', () => ({
    getRecentGscRows: async (id) => {
        io.events.push('gsc:' + id);
        return [];
    },
}));

import { getSeoLocalSlice } from '@/lib/operator-intelligence/seo-local';
import { getSeoActionsSlice } from '@/lib/operator-intelligence/seo-actions';
import { GET } from '@/app/api/admin/seo/client/[clientId]/[slice]/route';
const clientA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const clientB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const audit = { id: 'audit', scan_status: 'success', geo_score: 0, seo_score: 0, issues: [], created_at: '2026-10-03' };
const suggestion = {
    id: 'suggestion',
    problem_type: 'weak_local_clarity',
    status: 'draft',
    created_at: '2026-10-03',
    ai_output: 'Observed recommendation',
};
const seoIssue = { key: 'seo-issue', category: 'technical', title: 'HTTPS' };
const failure = { data: null, error: { code: 'XX000', message: 'private SQL provider token' } };
const load = (slice, clientId = clientA) =>
    GET(new Request('https://example.test/api/seo/' + slice), { params: Promise.resolve({ clientId, slice }) });
const expectSafe = (data, source) => {
    expect(data.dataSources[source]).toBe('unavailable');
    expect(data.errors).toContainEqual({ source, message: 'Données temporairement indisponibles.' });
    expect(JSON.stringify(data)).not.toContain('private SQL');
};
beforeEach(() => {
    vi.clearAllMocks();
    io.audits = {
        [clientA]: { data: audit, error: null },
        [clientB]: { data: { ...audit, id: 'audit-b' }, error: null },
    };
    io.suggestions = { [clientA]: { data: [], error: null }, [clientB]: { data: [], error: null } };
    io.reads = [];
    io.events = [];
    io.auth.mockResolvedValue({ id: 'admin' });
    io.shell.mockResolvedValue({ audit: null });
});

describe('local and actions own their canonical audit source', () => {
    it.each([getSeoLocalSlice, getSeoActionsSlice])(
        'reads one client-scoped audit in %s without the shell',
        async (getter) => {
            const data = await getter(clientA);
            expect(data.dataSources.audit).toBe('available');
            const auditReads = io.reads.filter((read) => read.table === 'client_site_audits');
            expect(auditReads).toEqual([
                {
                    table: 'client_site_audits',
                    clientId: clientA,
                    fields: '*',
                    order: ['created_at', { ascending: false }],
                    limit: 1,
                },
            ]);
            expect(io.shell).not.toHaveBeenCalled();
        },
    );
    it.each([getSeoLocalSlice, getSeoActionsSlice])(
        'keeps an explicitly absent audit from triggering IO in %s',
        async (getter) => {
            io.audits[clientA] = failure;
            const data = await getter(clientA, { audit: null });
            expect(data.dataSources.audit).toBe('empty');
            expect(data.status).toBe('available');
            expect(data.errors).toEqual([]);
            expect(io.reads.some((read) => read.table === 'client_site_audits')).toBe(false);
        },
    );
    it.each([getSeoLocalSlice, getSeoActionsSlice])(
        'uses a provided audit without replacing it in %s',
        async (getter) => {
            io.audits[clientA] = failure;
            const data = await getter(clientA, { audit });
            expect(data.dataSources.audit).toBe('available');
            expect(io.reads.some((read) => read.table === 'client_site_audits')).toBe(false);
        },
    );
    it.each([null, { code: 'PGRST116', message: 'No rows' }])(
        'keeps an absent audit distinct from read error %s',
        async (error) => {
            io.audits[clientA] = { data: null, error };
            const local = await getSeoLocalSlice(clientA);
            const actions = await getSeoActionsSlice(clientA);
            expect(local.available).toBe(false);
            expect(local.status).toBe('available');
            expect(local.errors).toEqual([]);
            expect(local.emptyState.description).toContain('Aucun audit');
            expect(actions.counts).toMatchObject({ totalSuggestions: 0, totalAuditIssues: null });
            expect(actions.errors).toEqual([]);
        },
    );
    it('preserves observed local zero and an observed empty action inventory', async () => {
        const local = await getSeoLocalSlice(clientA);
        const actions = await getSeoActionsSlice(clientA);
        expect(local).toMatchObject({ available: true, localScore: 0, localIssueCount: 0, totalIssueCount: 0 });
        expect(actions).toMatchObject({
            status: 'available',
            available: false,
            counts: { totalSuggestions: 0, draftSuggestions: 0, approvedSuggestions: 0, totalAuditIssues: 0 },
        });
        expect(actions.errors).toEqual([]);
    });
    it.each([undefined, null, 'invalid'])('does not infer zero from audit inventory %s', async (issues) => {
        io.audits[clientA] = { data: { ...audit, issues }, error: null };
        const local = await getSeoLocalSlice(clientA);
        const actions = await getSeoActionsSlice(clientA);
        expect(local.localIssueCount).toBeNull();
        expect(local.totalIssueCount).toBeNull();
        expect(local.localScore).toBe(0);
        expect(actions.counts.totalAuditIssues).toBeNull();
        expect(actions.counts.totalSuggestions).toBe(0);
    });
    it('qualifies a local audit read error safely instead of claiming no audit', async () => {
        io.audits[clientA] = { ...failure, data: audit };
        const data = await getSeoLocalSlice(clientA);
        expect(data.status).toBe('unavailable');
        expect(data.available).toBe(false);
        expectSafe(data, 'audit');
        expect(data.emptyState.description).toContain('temporairement');
        expect(data.emptyState.description).not.toContain('Aucun audit');
    });
    it('retains audit issues when remediation fails without fabricated suggestion counts', async () => {
        io.audits[clientA] = { data: { ...audit, issues: [seoIssue] }, error: null };
        io.suggestions[clientA] = { ...failure, data: [suggestion] };
        const data = await getSeoActionsSlice(clientA);
        expect(data.status).toBe('partial');
        expectSafe(data, 'remediation');
        expect(data.available).toBe(true);
        expect(data.auditIssues).toEqual([seoIssue]);
        expect(data.counts).toEqual({
            totalSuggestions: null,
            draftSuggestions: null,
            approvedSuggestions: null,
            totalAuditIssues: 1,
        });
        expect(data.suggestions).toEqual([]);
    });
    it('retains measured suggestions when audit fails without claiming zero audit issues', async () => {
        io.audits[clientA] = failure;
        io.suggestions[clientA] = {
            data: [suggestion, { ...suggestion, id: 'excluded', problem_type: 'not-seo' }],
            error: null,
        };
        const data = await getSeoActionsSlice(clientA);
        expect(data.status).toBe('partial');
        expectSafe(data, 'audit');
        expect(data.available).toBe(true);
        expect(data.suggestions).toHaveLength(1);
        expect(data.suggestions[0]).toMatchObject({
            id: 'suggestion',
            problemType: 'weak_local_clarity',
            aiOutput: 'Observed recommendation',
        });
        expect(data.counts).toEqual({
            totalSuggestions: 1,
            draftSuggestions: 1,
            approvedSuggestions: 0,
            totalAuditIssues: null,
        });
    });
    it('keeps both failed sources unavailable rather than a successful empty backlog', async () => {
        io.audits[clientA] = failure;
        io.suggestions[clientA] = failure;
        const data = await getSeoActionsSlice(clientA);
        expect(data.status).toBe('unavailable');
        expect(data.available).toBe(false);
        expectSafe(data, 'audit');
        expectSafe(data, 'remediation');
        expect(data.emptyState.title).not.toBe('Aucune action SEO identifiée');
        expect(Object.values(data.counts)).toEqual([null, null, null, null]);
    });
    it('starts both independent action reads synchronously in source order', async () => {
        const pending = getSeoActionsSlice(clientA);
        expect(io.reads.map((read) => read.table)).toEqual(['client_site_audits', 'remediation_suggestions']);
        await pending;
        expect(io.reads.every((read) => read.clientId === clientA)).toBe(true);
    });
    it('does not mix simultaneous client inventories', async () => {
        io.audits[clientB] = {
            data: { ...audit, geo_score: 71, issues: [{ category: 'local', key: 'b' }] },
            error: null,
        };
        io.suggestions[clientB] = { data: [suggestion], error: null };
        const [localA, localB, actionsA, actionsB] = await Promise.all([
            getSeoLocalSlice(clientA),
            getSeoLocalSlice(clientB),
            getSeoActionsSlice(clientA),
            getSeoActionsSlice(clientB),
        ]);
        expect(localA.localIssueCount).toBe(0);
        expect(localB).toMatchObject({ localIssueCount: 1, localScore: 71 });
        expect(actionsA.counts.totalSuggestions).toBe(0);
        expect(actionsB.counts.totalSuggestions).toBe(1);
        expect(io.reads.filter((read) => read.clientId === clientB)).toHaveLength(3);
    });
});

describe('the four SEO routes use actual direct getters', () => {
    it.each(['health', 'local', 'actions', 'opportunities'])(
        '%s does not read the multi-query shell',
        async (slice) => {
            const response = await load(slice);
            expect(response.status).toBe(200);
            expect(response.headers.get('cache-control')).toBe('no-store');
            const data = await response.json();
            expect(data.dataSources.audit).toBe('available');
            expect(io.shell).not.toHaveBeenCalled();
            expect(io.reads.filter((read) => read.table === 'client_site_audits' && read.limit === 1)).toHaveLength(1);
            expect(io.reads.every((read) => read.clientId === clientA)).toBe(true);
            if (slice === 'opportunities')
                expect(io.events.indexOf('audit:' + clientA)).toBeLessThan(io.events.indexOf('visibility:' + clientA));
            if (slice === 'health')
                expect(io.reads.filter((read) => read.table === 'client_site_audits')).toHaveLength(2);
        },
    );
    it.each(['health', 'local', 'actions', 'opportunities'])(
        '%s refuses an unauthorized caller before IO',
        async (slice) => {
            io.auth.mockResolvedValue(null);
            expect((await load(slice)).status).toBe(401);
            expect(io.reads).toEqual([]);
            expect(io.events).toEqual([]);
            expect(io.shell).not.toHaveBeenCalled();
        },
    );
    it.each(['health', 'local', 'actions', 'opportunities'])('%s validates client before IO', async (slice) => {
        expect((await load(slice, 'invalid')).status).toBe(400);
        expect(io.reads).toEqual([]);
        expect(io.events).toEqual([]);
    });
    it.each(['local', 'actions'])('%s retains another client filter and qualifiers', async (slice) => {
        io.audits[clientB] = failure;
        io.suggestions[clientB] = { data: [suggestion], error: null };
        const data = await (await load(slice, clientB)).json();
        expectSafe(data, 'audit');
        expect(io.reads.every((read) => read.clientId === clientB)).toBe(true);
        expect(data.status).toBe(slice === 'local' ? 'unavailable' : 'partial');
    });
});

describe('a persisted failed local audit is not an absent audit', () => {
    it('keeps the successful read available and describes the failed audit', async () => {
        io.audits[clientA] = { data: { ...audit, scan_status: 'failed' }, error: null };
        const data = await getSeoLocalSlice(clientA);
        expect(data.available).toBe(false);
        expect(data.dataSources.audit).toBe('available');
        expect(data.errors).toEqual([]);
        expect(data.emptyState.description).toContain('échoué');
        expect(data.emptyState.description).not.toContain('Aucun audit');
        expect(data.localScore).toBeUndefined();
    });
});
