import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as initiateGoogleOAuth } from '../../app/api/connectors/google/auth/route.js';
import { GET as completeGoogleOAuth } from '../../app/api/connectors/google/callback/route.js';
import { createGoogleOAuthState, verifyGoogleOAuthState } from '../connectors/google-oauth-state.js';

const doubles = vi.hoisted(() => ({
    auth: vi.fn(),
    currentUser: vi.fn(),
    devAdmin: vi.fn(),
    signState: vi.fn(),
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    setCredentials: vi.fn(),
    userInfo: vi.fn(),
    updateConnectorState: vi.fn(),
    getClientConnectorRows: vi.fn(),
    supabase: { from: vi.fn() },
    updates: [],
    memberships: [],
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/connectors/google-oauth-state', async (importOriginal) => {
    const actual = await importOriginal();
    doubles.signState.mockImplementation(actual.createGoogleOAuthState);
    return { ...actual, createGoogleOAuthState: doubles.signState };
});
vi.mock('@clerk/nextjs/server', () => ({ auth: doubles.auth, currentUser: doubles.currentUser }));
vi.mock('@/lib/dev-bypass-server', () => ({ getDevAdminForCurrentRequest: doubles.devAdmin }));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => doubles.supabase }));
vi.mock('googleapis', () => ({
    google: {
        auth: {
            OAuth2: class {
                generateAuthUrl(options) {
                    return doubles.generateAuthUrl(options);
                }
                getToken(code) {
                    return doubles.getToken(code);
                }
                setCredentials(tokens) {
                    return doubles.setCredentials(tokens);
                }
            },
        },
        oauth2: () => ({ userinfo: { get: doubles.userInfo } }),
    },
}));
vi.mock('@/lib/connectors/repository', () => ({
    updateConnectorState: doubles.updateConnectorState,
    getClientConnectorRows: doubles.getClientConnectorRows,
}));

const CLIENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const user = (email = 'member@example.test') => ({
    id: 'user-a',
    primaryEmailAddressId: 'email-a',
    emailAddresses: [{ id: 'email-a', emailAddress: email, verification: { status: 'verified' } }],
    publicMetadata: {},
});

function installMembershipDatabase() {
    doubles.supabase.from.mockImplementation((table) => {
        const filters = [];
        let update = null;
        const query = {
            select() {
                return query;
            },
            eq(key, value) {
                filters.push((row) => row[key] === value);
                return query;
            },
            neq(key, value) {
                filters.push((row) => row[key] !== value);
                return query;
            },
            in(key, values) {
                filters.push((row) => values.includes(row[key]));
                return query;
            },
            update(payload) {
                update = payload;
                return query;
            },
            then(resolve, reject) {
                const rows = (
                    table === 'client_portal_access'
                        ? doubles.memberships
                        : [
                              { id: CLIENT_A, client_slug: 'client-a', client_name: 'A', lifecycle_status: 'active' },
                              { id: CLIENT_B, client_slug: 'client-b', client_name: 'B', lifecycle_status: 'active' },
                          ]
                ).filter((row) => filters.every((filter) => filter(row)));
                if (update) doubles.updates.push({ table, payload: update, ids: rows.map((row) => row.id) });
                return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
        };
        return query;
    });
}

async function initiation(clientId = CLIENT_B, returnTo = '/portal/client-b') {
    return initiateGoogleOAuth(
        new Request(
            `https://trouvable.test/api/connectors/google/auth?clientId=${clientId}&returnTo=${encodeURIComponent(returnTo)}`,
        ),
    );
}
async function callback(clientId = CLIENT_B, extra = 'code=test-code') {
    const state = await createGoogleOAuthState({
        clientId,
        returnTo: '/portal/client-b',
        origin: 'https://trouvable.test',
    });
    doubles.signState.mockClear();
    return completeGoogleOAuth(
        new Request(
            `https://trouvable.test/api/connectors/google/callback?${extra}&state=${encodeURIComponent(state)}`,
        ),
    );
}
function expectNoExternalWork() {
    expect(doubles.signState).not.toHaveBeenCalled();
    expect(doubles.generateAuthUrl).not.toHaveBeenCalled();
    expect(doubles.getToken).not.toHaveBeenCalled();
    expect(doubles.userInfo).not.toHaveBeenCalled();
    expect(doubles.getClientConnectorRows).not.toHaveBeenCalled();
    expect(doubles.updateConnectorState).not.toHaveBeenCalled();
    expect(doubles.updates).toEqual([]);
}

describe('Google OAuth server authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CLERK_ADMIN_EMAIL', 'operator@example.test');
        vi.stubEnv('GOOGLE_OAUTH_STATE_SECRET', 'test-state-secret');
        vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'test-client-id');
        vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'test-client-secret');
        doubles.auth.mockResolvedValue({ userId: null });
        doubles.currentUser.mockResolvedValue(null);
        doubles.devAdmin.mockResolvedValue(null);
        doubles.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=signed');
        doubles.getToken.mockResolvedValue({
            tokens: { access_token: 'test-access-token', refresh_token: 'test-refresh-token' },
        });
        doubles.userInfo.mockResolvedValue({ data: { email: 'google@example.test' } });
        doubles.getClientConnectorRows.mockResolvedValue([{ provider: 'ga4', config: { propertyId: '123' } }]);
        doubles.updateConnectorState.mockResolvedValue({});
        doubles.updates = [];
        doubles.memberships = [];
        installMembershipDatabase();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('rejects anonymous arbitrary-client initiation before minting state', async () => {
        const response = await initiation();
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({ error: 'google_oauth_authentication_required', status: 401 });
        expectNoExternalWork();
        expect(doubles.supabase.from).not.toHaveBeenCalled();
    });
    it('rejects a signed-in user without target membership', async () => {
        doubles.auth.mockResolvedValue({ userId: 'user-a' });
        doubles.currentUser.mockResolvedValue(user());
        const response = await initiation();
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: 'google_oauth_forbidden', status: 403 });
        expectNoExternalWork();
    });
    it.each(['initiation', 'callback'])(
        'denies client B to verified-email client A without identity or connector writes (%s)',
        async (flow) => {
            doubles.auth.mockResolvedValue({ userId: 'user-a' });
            doubles.currentUser.mockResolvedValue(user());
            doubles.memberships = [
                {
                    id: 'membership-a',
                    client_id: CLIENT_A,
                    contact_email: 'member@example.test',
                    clerk_user_id: null,
                    status: 'active',
                },
            ];
            const response = await (flow === 'initiation' ? initiation() : callback());
            expect(response.status).toBe(403);
            expectNoExternalWork();
        },
    );
    it('rejects an anonymous valid signed callback before token exchange', async () => {
        const response = await callback();
        expect(response.status).toBe(401);
        expectNoExternalWork();
    });
    it('does not persist Google denial errors for an unauthorized signed callback', async () => {
        const response = await callback(CLIENT_B, 'error=access_denied');
        expect(response.status).toBe(401);
        expectNoExternalWork();
    });
    it.each(['initiation', 'callback'])(
        'returns a safe unavailable error when authorization lookup fails (%s)',
        async (flow) => {
            doubles.auth.mockRejectedValue(new Error('SQL secret table and stack private'));
            const response = await (flow === 'initiation' ? initiation() : callback());
            expect(response.status).toBe(503);
            expect(await response.json()).toEqual({ error: 'google_oauth_access_unavailable', status: 503 });
            expectNoExternalWork();
        },
    );
    it.each(['initiation', 'callback'])(
        'fails closed with safe JSON on membership database errors (%s)',
        async (flow) => {
            doubles.auth.mockResolvedValue({ userId: 'user-a' });
            doubles.currentUser.mockResolvedValue(user());
            doubles.supabase.from.mockImplementation(() => ({
                select() {
                    return this;
                },
                eq() {
                    return this;
                },
                then(resolve, reject) {
                    return Promise.resolve({ data: null, error: { message: 'SQL private secret' } }).then(
                        resolve,
                        reject,
                    );
                },
            }));
            const response = await (flow === 'initiation' ? initiation() : callback());
            expect(response.status).toBe(503);
            expect(await response.json()).toEqual({ error: 'google_oauth_access_unavailable', status: 503 });
            expectNoExternalWork();
        },
    );
    it('rejects a callback after target membership is revoked', async () => {
        doubles.auth.mockResolvedValue({ userId: 'user-a' });
        doubles.currentUser.mockResolvedValue(user());
        doubles.memberships = [
            {
                id: 'membership-b',
                client_id: CLIENT_B,
                contact_email: 'member@example.test',
                clerk_user_id: 'user-a',
                status: 'revoked',
            },
        ];
        const response = await callback();
        expect(response.status).toBe(403);
        expectNoExternalWork();
    });
    it('allows an allowlisted operator to initiate OAuth for client B', async () => {
        doubles.auth.mockResolvedValue({ userId: 'operator' });
        doubles.currentUser.mockResolvedValue(user('operator@example.test'));
        const response = await initiation();
        expect(response.status).toBe(307);
        expect(doubles.generateAuthUrl).toHaveBeenCalledTimes(1);
        const state = await verifyGoogleOAuthState(doubles.generateAuthUrl.mock.calls[0][0].state);
        expect(state.payload.clientId).toBe(CLIENT_B);
        expect(doubles.supabase.from).not.toHaveBeenCalled();
    });
    it('allows the active target member to initiate OAuth', async () => {
        doubles.auth.mockResolvedValue({ userId: 'user-a' });
        doubles.currentUser.mockResolvedValue(user());
        doubles.memberships = [
            {
                id: 'membership-b',
                client_id: CLIENT_B,
                contact_email: 'member@example.test',
                clerk_user_id: 'user-a',
                status: 'active',
            },
        ];
        const response = await initiation();
        expect(response.status).toBe(307);
        expect(doubles.generateAuthUrl).toHaveBeenCalledTimes(1);
        expect(doubles.updates).toEqual([]);
    });
    it.each(['operator', 'portal'])(
        'allows an authorized %s callback and persists only signed target client',
        async (caller) => {
            doubles.auth.mockResolvedValue({ userId: caller });
            doubles.currentUser.mockResolvedValue(
                user(caller === 'operator' ? 'operator@example.test' : 'member@example.test'),
            );
            doubles.memberships = [
                {
                    id: 'membership-b',
                    client_id: CLIENT_B,
                    contact_email: 'member@example.test',
                    clerk_user_id: caller,
                    status: 'active',
                },
            ];
            const response = await callback();
            expect(response.status).toBe(307);
            expect(new URL(response.headers.get('location')).searchParams.get('success')).toBe('GoogleConnected');
            expect(doubles.getToken).toHaveBeenCalledWith('test-code');
            expect(doubles.updateConnectorState).toHaveBeenCalledTimes(2);
            for (const [payload] of doubles.updateConnectorState.mock.calls)
                expect(payload).toMatchObject({ clientId: CLIENT_B, status: 'configured' });
            expect(doubles.updates).toEqual([]);
        },
    );
    it('returns a safe error when Google OAuth env is missing for an authorized operator', async () => {
        doubles.auth.mockResolvedValue({ userId: 'operator' });
        doubles.currentUser.mockResolvedValue(user('operator@example.test'));
        vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', '');
        const response = await initiation();
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ error: 'missing_google_oauth_env' });
        expectNoExternalWork();
    });
    it('rejects unsafe returnTo values before redirecting to Google', async () => {
        const response = await initiation(CLIENT_B, 'https://evil.test');
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('invalid_return_to');
        expectNoExternalWork();
    });
    it('rejects tampered callback state without using caller-provided client IDs', async () => {
        const response = await completeGoogleOAuth(
            new Request('https://trouvable.test/api/connectors/google/callback?code=abc&state=client-b'),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'invalid_google_oauth_state', detail: 'malformed_state' });
        expectNoExternalWork();
    });
});
