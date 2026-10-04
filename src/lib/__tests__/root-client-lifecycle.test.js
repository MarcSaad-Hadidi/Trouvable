import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as archive } from '../../app/api/admin/clients/archive/route.js';
import { POST as restore } from '../../app/api/admin/clients/restore/route.js';
import { clientIdSchema } from '../admin-schemas.js';

const io = vi.hoisted(() => ({
    admin: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(),
    archive: vi.fn(), restore: vi.fn(), log: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ requireAdmin: io.admin }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({ from: io.from }) }));
vi.mock('@/lib/db/clients', () => ({ archiveClient: io.archive, restoreClient: io.restore }));
vi.mock('@/lib/db/actions', () => ({ logAction: io.log }));

const CLIENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN = { email: 'operator@example.test' };
const flows = [
    { name: 'archive', post: archive, mutate: io.archive, target: 'archived', initial: 'active', fallback: 'prospect', blocked: ['archived'], allowed: ['prospect', 'onboarding', 'active', 'paused'], event: 'client_archived' },
    { name: 'restore', post: restore, mutate: io.restore, target: 'active', initial: 'archived', fallback: 'archived', blocked: ['prospect', 'active'], allowed: ['onboarding', 'paused', 'archived'], event: 'client_restored' },
];
const request = (body = { clientId: CLIENT_A }) => ({ json: vi.fn().mockResolvedValue(body) });
function expectNoMutation() {
    expect(io.archive).not.toHaveBeenCalled();
    expect(io.restore).not.toHaveBeenCalled();
    expect(io.log).not.toHaveBeenCalled();
}

beforeEach(() => {
    vi.resetAllMocks();
    io.admin.mockResolvedValue(ADMIN);
    io.from.mockReturnValue({ select: io.select });
    io.select.mockReturnValue({ eq: io.eq });
    io.eq.mockReturnValue({ single: io.single });
    io.archive.mockResolvedValue({ id: CLIENT_A, lifecycle_status: 'archived' });
    io.restore.mockResolvedValue({ id: CLIENT_A, lifecycle_status: 'active' });
    io.log.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe.each(flows)('client lifecycle endpoint $name', (flow) => {
    beforeEach(() => { io.single.mockResolvedValue({ data: { lifecycle_status: flow.initial }, error: null }); });

    it('refuses authorization before reading the body or accessing data', async () => {
        io.admin.mockResolvedValue(null);
        const req = request();
        const response = await flow.post(req);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Non autorisé' });
        expect(req.json).not.toHaveBeenCalled();
        expect(io.from).not.toHaveBeenCalled();
        expectNoMutation();
    });

    it('returns invalid JSON after authorization without data access', async () => {
        const req = request();
        req.json.mockRejectedValue(new SyntaxError('private body'));
        const response = await flow.post(req);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'JSON invalide' });
        expect(io.admin.mock.invocationCallOrder[0]).toBeLessThan(req.json.mock.invocationCallOrder[0]);
        expect(io.from).not.toHaveBeenCalled();
        expectNoMutation();
    });

    it.each([{}, { clientId: 'invalid' }, null])('preserves schema validation issues for %j', async (body) => {
        const response = await flow.post(request(body));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Validation', details: clientIdSchema.safeParse(body).error.issues });
        expect(io.from).not.toHaveBeenCalled();
        expectNoMutation();
    });

    it.each([
        { data: null, error: null },
        { data: null, error: { code: 'PGRST116', message: 'zero rows' } },
        { data: { lifecycle_status: 'active' }, error: { code: '08006', message: 'private database connection' } },
    ])('characterizes missing client and returned fetch errors (%j)', async (result) => {
        io.single.mockResolvedValue(result);
        const response = await flow.post(request());
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'Client introuvable.' });
        expectNoMutation();
    });

    it.each(flow.blocked)('refuses a forbidden transition from %s before mutating or logging', async (from) => {
        io.single.mockResolvedValue({ data: { lifecycle_status: from }, error: null });
        const response = await flow.post(request());
        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: `[Lifecycle] Transition "${from}" → "${flow.target}" is not allowed` });
        expectNoMutation();
    });

    it.each(flow.allowed)('preserves the allowed transition from %s', async (from) => {
        io.single.mockResolvedValue({ data: { lifecycle_status: from }, error: null });
        const response = await flow.post(request());
        expect(response.status).toBe(200);
        expect(flow.mutate).toHaveBeenCalledExactlyOnceWith(CLIENT_A);
        expect(io.log).toHaveBeenCalledWith(expect.objectContaining({ details: { from, to: flow.target } }));
    });
    it('preserves unknown lifecycle validation messages', async () => {
        io.single.mockResolvedValue({ data: { lifecycle_status: 'unknown' }, error: null });
        const response = await flow.post(request());
        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({ error: '[Lifecycle] Unknown current state: "unknown"' });
        expectNoMutation();
    });

    it.each([CLIENT_A, CLIENT_B])('scopes lookup, mutation and journal to client %s in order', async (clientId) => {
        const client = { id: clientId, lifecycle_status: flow.target };
        flow.mutate.mockResolvedValue(client);
        const req = request({ clientId });
        const response = await flow.post(req);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true, client });
        expect(io.from).toHaveBeenCalledExactlyOnceWith('client_geo_profiles');
        expect(io.select).toHaveBeenCalledExactlyOnceWith('lifecycle_status');
        expect(io.eq).toHaveBeenCalledExactlyOnceWith('id', clientId);
        expect(io.single).toHaveBeenCalledExactlyOnceWith();
        expect(flow.mutate).toHaveBeenCalledExactlyOnceWith(clientId);
        expect(io.log).toHaveBeenCalledExactlyOnceWith({
            client_id: clientId, action_type: flow.event,
            details: { from: flow.initial, to: flow.target }, performed_by: ADMIN.email,
        });
        expect(io.admin.mock.invocationCallOrder[0]).toBeLessThan(req.json.mock.invocationCallOrder[0]);
        expect(req.json.mock.invocationCallOrder[0]).toBeLessThan(io.single.mock.invocationCallOrder[0]);
        expect(io.single.mock.invocationCallOrder[0]).toBeLessThan(flow.mutate.mock.invocationCallOrder[0]);
        expect(flow.mutate.mock.invocationCallOrder[0]).toBeLessThan(io.log.mock.invocationCallOrder[0]);
        expect(flow.name === 'archive' ? io.restore : io.archive).not.toHaveBeenCalled();
    });

    it.each([null, undefined, ''])('uses the existing fallback for lifecycle %j', async (lifecycle_status) => {
        io.single.mockResolvedValue({ data: { lifecycle_status }, error: null });
        expect((await flow.post(request())).status).toBe(200);
        expect(io.log).toHaveBeenCalledWith(expect.objectContaining({ details: { from: flow.fallback, to: flow.target } }));
    });

    it.each(['read', 'mutation', 'journal'])('hides rejected %s details behind the endpoint-specific 500', async (stage) => {
        const failure = new Error(`private ${stage} details`);
        if (stage === 'read') io.single.mockRejectedValue(failure);
        if (stage === 'mutation') flow.mutate.mockRejectedValue(failure);
        if (stage === 'journal') io.log.mockRejectedValue(failure);
        const response = await flow.post(request());
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'Erreur interne du serveur.' });
        expect(console.error).toHaveBeenCalledExactlyOnceWith(`[clients/${flow.name}]`, failure);
        if (stage === 'read') expectNoMutation();
        if (stage === 'mutation') expect(io.log).not.toHaveBeenCalled();
        if (stage === 'journal') expect(flow.mutate).toHaveBeenCalledExactlyOnceWith(CLIENT_A);
    });
});


