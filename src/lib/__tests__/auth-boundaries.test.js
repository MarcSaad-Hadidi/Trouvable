import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn(), devAdmin: vi.fn(), listClients: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: boundary.auth, currentUser: boundary.currentUser }));
vi.mock('@/lib/dev-bypass-server', () => ({ getDevAdminForCurrentRequest: boundary.devAdmin }));
vi.mock('@/lib/operator-data', () => ({ listOperatorClients: boundary.listClients }));

import { getAdminAccessState, requireAdmin, resolveOperatorRole } from '../auth.js';
import { GET } from '../../app/api/admin/geo/clients/route.js';

function clerkUser(email, role) {
    return {
        id: 'operator-id',
        primaryEmailAddressId: 'primary',
        emailAddresses: [{ id: 'primary', emailAddress: email, verification: { status: 'verified' } }],
        publicMetadata: role === undefined ? {} : { operatorRole: role },
    };
}

describe('actual server admin authorization boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CLERK_ADMIN_EMAIL', 'operator@example.test');
        boundary.devAdmin.mockResolvedValue(null);
        boundary.auth.mockResolvedValue({ userId: null });
        boundary.currentUser.mockResolvedValue(null);
        boundary.listClients.mockResolvedValue([{ id: 'client-a' }]);
    });
    afterEach(() => vi.unstubAllEnvs());

    it('rejects anonymous users before fetching a Clerk user or operator data', async () => {
        expect(await getAdminAccessState()).toMatchObject({ kind: 'anonymous', admin: null, operatorRole: null });
        expect(await requireAdmin()).toBeNull();
        const response = await GET();
        expect(response.status).toBe(401);
        expect(boundary.currentUser).not.toHaveBeenCalled();
        expect(boundary.listClients).not.toHaveBeenCalled();
    });
    it('rejects a signed-in identity whose Clerk user is unavailable', async () => {
        boundary.auth.mockResolvedValue({ userId: 'operator-id' });
        expect(await requireAdmin()).toBeNull();
        expect((await GET()).status).toBe(401);
        expect(boundary.listClients).not.toHaveBeenCalled();
    });
    it('rejects a forbidden email even when metadata claims admin role', async () => {
        boundary.auth.mockResolvedValue({ userId: 'operator-id' });
        boundary.currentUser.mockResolvedValue(clerkUser('other@example.test', 'admin'));
        expect(await getAdminAccessState()).toMatchObject({ kind: 'forbidden', admin: null, operatorRole: null });
        expect(await requireAdmin()).toBeNull();
        expect((await GET()).status).toBe(401);
        expect(boundary.listClients).not.toHaveBeenCalled();
    });
    it.each(['admin', 'consultant', 'viewer'])(
        'preserves allowlisted %s role identity without inventing permissions',
        async (role) => {
            boundary.auth.mockResolvedValue({ userId: 'operator-id' });
            boundary.currentUser.mockResolvedValue(clerkUser('operator@example.test', role));
            expect(await getAdminAccessState()).toMatchObject({
                kind: 'clerk',
                operatorRole: role,
                admin: { userId: 'operator-id', email: 'operator@example.test' },
            });
            expect(await requireAdmin()).toEqual({ userId: 'operator-id', email: 'operator@example.test' });
            const response = await GET();
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ clients: [{ id: 'client-a' }] });
        },
    );
    it('defaults an allowlisted identity with no role metadata to admin', async () => {
        boundary.auth.mockResolvedValue({ userId: 'operator-id' });
        boundary.currentUser.mockResolvedValue(clerkUser('operator@example.test'));
        expect((await getAdminAccessState()).operatorRole).toBe('admin');
    });
    it('does not resolve operator roles without a user and allowlist grant', () => {
        expect(resolveOperatorRole(null, true)).toBeNull();
        expect(resolveOperatorRole(clerkUser('other@example.test', 'viewer'), false)).toBeNull();
    });
});
