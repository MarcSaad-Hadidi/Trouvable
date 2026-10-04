import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ requireAdmin: vi.fn(), payload: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ requireAdmin: boundary.requireAdmin }));
vi.mock('@/lib/operator-intelligence/base', () => ({ getOperatorWorkspaceShell: boundary.payload }));

import { GET } from '../../app/api/admin/geo/client/[clientId]/route.js';

const clientId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const invoke = (id = clientId) => GET(undefined, { params: Promise.resolve({ clientId: id }) });

async function expectNoStoreJson(response, status, payload) {
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(payload);
}

describe('operator shell route error boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        boundary.requireAdmin.mockResolvedValue({ userId: 'operator', email: 'operator@example.test' });
        boundary.payload.mockResolvedValue({ client: { id: clientId }, status: 'available' });
    });

    it('returns safe 503 JSON when the required client source is unavailable', async () => {
        const failure = new Error('SQL password=private; client lookup stack');
        failure.code = 'OPERATOR_CLIENT_UNAVAILABLE';
        boundary.payload.mockRejectedValue(failure);
        const response = await invoke();
        await expectNoStoreJson(response, 503, { error: 'Données client temporairement indisponibles.', status: 503 });
        expect(boundary.payload).toHaveBeenCalledWith(clientId);
    });

    it('returns safe 500 JSON for an unexpected loader exception', async () => {
        boundary.payload.mockRejectedValue(new Error('SQL password=private; provider stack'));
        await expectNoStoreJson(await invoke(), 500, { error: 'Erreur interne du serveur.', status: 500 });
    });

    it('contains authentication resolver exceptions without loading client data', async () => {
        boundary.requireAdmin.mockRejectedValue(new Error('Clerk private token and stack'));
        await expectNoStoreJson(await invoke(), 500, { error: 'Erreur interne du serveur.', status: 500 });
        expect(boundary.payload).not.toHaveBeenCalled();
    });

    it('contains rejected route params before loading client data', async () => {
        await expectNoStoreJson(await GET(undefined, { params: Promise.reject(new Error('private route stack')) }), 500,
            { error: 'Erreur interne du serveur.', status: 500 });
        expect(boundary.payload).not.toHaveBeenCalled();
    });

    it.each(['anonymous', 'forbidden'])('preserves the existing 401 denial for %s access before client reads', async () => {
        boundary.requireAdmin.mockResolvedValue(null);
        await expectNoStoreJson(await invoke(), 401, { error: 'Non autorise' });
        expect(boundary.payload).not.toHaveBeenCalled();
    });

    it('preserves invalid-ID 400 before client reads', async () => {
        await expectNoStoreJson(await invoke('invalid'), 400, { error: 'ID invalide' });
        expect(boundary.payload).not.toHaveBeenCalled();
    });

    it('preserves a successfully missing client as 404', async () => {
        boundary.payload.mockResolvedValue(null);
        await expectNoStoreJson(await invoke(), 404, { error: 'Client non trouve' });
    });

    it('preserves an independent partial payload with 200 and no-store', async () => {
        const payload = { client: { id: clientId }, status: 'partial', dataSources: { audit: 'unavailable' }, errors: [{ source: 'audit', message: 'Données temporairement indisponibles.' }] };
        boundary.payload.mockResolvedValue(payload);
        await expectNoStoreJson(await invoke(), 200, payload);
    });
});
