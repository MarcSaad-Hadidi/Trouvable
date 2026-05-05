import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('Google OAuth signed state', () => {
    it('round-trips a signed state with nonce and expiry metadata', async () => {
        vi.resetModules();
        process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-state-secret';

        const { createGoogleOAuthState, verifyGoogleOAuthState } = await import('@/lib/connectors/google-oauth-state');
        const state = await createGoogleOAuthState({
            clientId: 'client-123',
            returnTo: '/portal/client-acme',
            origin: 'https://www.trouvable.app',
            initiator: 'portal',
        });

        const verified = await verifyGoogleOAuthState(state);

        expect(verified.valid).toBe(true);
        expect(verified.payload).toMatchObject({
            clientId: 'client-123',
            returnTo: '/portal/client-acme',
            origin: 'https://www.trouvable.app',
            initiator: 'portal',
        });
        expect(verified.payload.nonce).toHaveLength(32);
        expect(verified.payload.expiresAt).toBeGreaterThan(verified.payload.issuedAt);
    });

    it('rejects tampered state payloads', async () => {
        vi.resetModules();
        process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-state-secret';

        const { createGoogleOAuthState, verifyGoogleOAuthState } = await import('@/lib/connectors/google-oauth-state');
        const state = await createGoogleOAuthState({
            clientId: 'client-123',
            returnTo: '/admin/clients/client-123/dossier/connectors',
            origin: 'https://www.trouvable.app',
            initiator: 'admin',
        });
        const tampered = state.replace(/.$/, (last) => (last === 'a' ? 'b' : 'a'));

        await expect(verifyGoogleOAuthState(tampered)).resolves.toMatchObject({
            valid: false,
            error: 'invalid_signature',
        });
    });

    it('rejects expired states', async () => {
        vi.resetModules();
        process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-state-secret';

        const { createGoogleOAuthState, verifyGoogleOAuthState } = await import('@/lib/connectors/google-oauth-state');
        const state = await createGoogleOAuthState({
            clientId: 'client-123',
            returnTo: '/portal/client-acme',
            origin: 'https://www.trouvable.app',
            nowMs: 1_000,
            ttlMs: 1_000,
        });

        await expect(verifyGoogleOAuthState(state, { nowMs: 3_001 })).resolves.toMatchObject({
            valid: false,
            error: 'expired_state',
        });
    });

    it('rejects unsafe return targets', async () => {
        vi.resetModules();
        const { normalizeGoogleOAuthReturnTo } = await import('@/lib/connectors/google-oauth-state');

        expect(normalizeGoogleOAuthReturnTo('https://evil.test')).toBeNull();
        expect(normalizeGoogleOAuthReturnTo('//evil.test')).toBeNull();
        expect(normalizeGoogleOAuthReturnTo('/\\evil')).toBeNull();
        expect(normalizeGoogleOAuthReturnTo('/admin/clients/client-123')).toBe('/admin/clients/client-123');
        expect(normalizeGoogleOAuthReturnTo('/portal/client-acme')).toBe('/portal/client-acme');
    });
});
