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

    it('maps connector configuration and access errors without secret values', async () => {
        const { mapGoogleOAuthError } = await import('@/lib/seo/gsc-property');

        for (const code of ['missing_google_oauth_env', 'missing_refresh_token', 'no_property_access']) {
            const remedy = mapGoogleOAuthError(code);
            expect(remedy.code).toBe(code);
            expect(remedy.headline).toBeTruthy();
            expect(remedy.body).not.toContain('secret-value');
        }
    });
});

describe('GSC property resolution', () => {
    it('normalizes a bare domain to a URL-prefix property', async () => {
        const { resolveGscProperty } = await import('@/lib/seo/gsc-property');

        expect(resolveGscProperty({
            connector: { config: { site_url: 'example.com' } },
            websiteUrl: null,
        })).toBe('https://example.com/');
    });

    it('keeps Search Console domain properties unchanged', async () => {
        const { resolveGscProperty } = await import('@/lib/seo/gsc-property');

        expect(resolveGscProperty({
            connector: { config: { site_url: 'sc-domain:example.com' } },
            websiteUrl: 'https://fallback.test',
        })).toBe('sc-domain:example.com');
    });
});
