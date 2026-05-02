import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('Google OAuth remediation mapping', () => {
    it('maps invalid_client to clear French remediation copy', async () => {
        const { mapGoogleOAuthError } = await import('@/lib/seo/gsc-property');
        const remedy = mapGoogleOAuthError('invalid_client');

        expect(remedy.severity).toBe('critical');
        expect(remedy.headline).toContain('OAuth Google');
        expect(remedy.body).toContain('GOOGLE_OAUTH_CLIENT_ID');
        expect(remedy.body).toContain('reconnectez');
    });

    it('keeps unknown OAuth errors structured', async () => {
        const { mapGoogleOAuthError } = await import('@/lib/seo/gsc-property');
        const remedy = mapGoogleOAuthError('temporarily_unavailable');

        expect(remedy).toMatchObject({
            code: 'temporarily_unavailable',
            severity: 'warning',
        });
    });
});
