import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ auth: vi.fn(), shell: vi.fn(), response: null, auditClients: [] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ requireAdmin: io.auth }));
vi.mock('@/lib/operator-intelligence/base', () => ({ getOperatorWorkspaceShell: io.shell }));
vi.mock('@/lib/db/core', () => ({
    db: () => ({
        from: (table) => {
            expect(table).toBe('client_site_audits');
            const query = {
                select: vi.fn(() => query),
                eq: vi.fn((field, clientId) => {
                    expect(field).toBe('client_id');
                    io.auditClients.push(clientId);
                    return query;
                }),
                order: vi.fn(() => query),
                limit: vi.fn(() => query),
                single: vi.fn(async () => io.response),
            };
            return query;
        },
    }),
}));
vi.mock('@/lib/db/ga4', () => ({
    getTrafficDailyRows: vi.fn(async () => [{ date: '2026-10-03', sessions: 0, users: 0 }]),
    getTopPagesRows: vi.fn(async () => []),
}));
vi.mock('@/lib/db/gsc', () => ({ getRecentGscRows: vi.fn(async () => []) }));
vi.mock('@/lib/connectors/repository', () => ({ getClientConnectorRows: vi.fn(async () => []) }));
vi.mock('@/lib/operator-intelligence/seo-health', () => ({ getSeoHealthSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/seo-content', () => ({ getSeoContentSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/seo-cannibalization', () => ({ getSeoCannibalizationSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/seo-local', () => ({ getSeoLocalSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/seo-actions', () => ({ getSeoActionsSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/seo-opportunities', () => ({ getSeoOpportunitiesSlice: vi.fn() }));
vi.mock('@/lib/operator-intelligence/visibility', () => ({ getVisibilitySlice: vi.fn() }));

import { GET } from '@/app/api/admin/seo/client/[clientId]/[slice]/route';
import { getTrafficDailyRows } from '@/lib/db/ga4';
const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherClientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request = new Request('https://example.test/api/seo/overview');
const load = (id = clientId) => GET(request, { params: Promise.resolve({ clientId: id, slice: 'overview' }) });

beforeEach(() => {
    vi.clearAllMocks();
    io.auditClients = [];
    io.auth.mockResolvedValue({ id: 'admin' });
    io.shell.mockResolvedValue({ audit: null });
    io.response = { data: null, error: null };
});

describe('real overview route and audit getter availability', () => {
    it('does not turn a failed audit read into a complete empty reading', async () => {
        io.response = {
            error: { code: 'XX000', message: 'private SQL audit token' },
            data: { seo_score: 99, issues: [] },
        };
        const response = await load();
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('no-store');
        const data = await response.json();
        expect(data.status).toBe('partial');
        expect(data.dataSources.audit).toBe('unavailable');
        expect(data.auditScores).toMatchObject({ seoScore: null, issueCount: null });
        expect(data.kpis.sessions).toBe(0);
        expect(data.errors).toContainEqual({ source: 'audit', message: 'Données temporairement indisponibles.' });
        expect(JSON.stringify(data)).not.toContain('private SQL');
        expect(io.auditClients).toEqual([clientId]);
        expect(io.shell).not.toHaveBeenCalled();
    });
    it.each([null, { code: 'PGRST116', message: 'No rows' }])(
        'keeps a missing audit an ordinary absence for result %s',
        async (error) => {
            io.response = { data: null, error };
            const data = await (await load()).json();
            expect(data.status).toBe('available');
            expect(data.dataSources.audit).toBe('empty');
            expect(data.auditScores.issueCount).toBeNull();
            expect(data.errors).toEqual([]);
            expect(io.auditClients).toEqual([clientId]);
        },
    );
    it.each([clientId, otherClientId])('retains the client filter and observed zero for %s', async (id) => {
        io.response = { data: { seo_score: 0, geo_score: 0, issues: [], created_at: '2026-10-02' }, error: null };
        const data = await (await load(id)).json();
        expect(data.auditScores).toMatchObject({ seoScore: 0, geoScore: 0, issueCount: 0 });
        expect(data.dataSources.audit).toBe('available');
        expect(data.dataFreshness.lastAuditAt).toBe('2026-10-02');
        expect(io.auditClients).toEqual([id]);
        expect(io.shell).not.toHaveBeenCalled();
    });
    it('refuses an unauthorized caller before any IO', async () => {
        io.auth.mockResolvedValue(null);
        expect((await load()).status).toBe(401);
        expect(io.auditClients).toEqual([]);
        expect(getTrafficDailyRows).not.toHaveBeenCalled();
        expect(io.shell).not.toHaveBeenCalled();
    });
    it('validates the client before any IO', async () => {
        expect((await load('invalid')).status).toBe(400);
        expect(io.auditClients).toEqual([]);
        expect(getTrafficDailyRows).not.toHaveBeenCalled();
    });
});
