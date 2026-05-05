import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const generateAuthUrlMock = vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?state=signed');

vi.mock('googleapis', () => ({
    google: {
        auth: {
            OAuth2: class {
                generateAuthUrl(options) {
                    return generateAuthUrlMock(options);
                }
            },
        },
    },
}));

vi.mock('@/lib/connectors/repository', () => ({
    updateConnectorState: vi.fn(),
    getClientConnectorRows: vi.fn(async () => []),
}));

describe('Google OAuth auth route', () => {
    beforeEach(() => {
        vi.resetModules();
        generateAuthUrlMock.mockClear();
        process.env.GOOGLE_OAUTH_STATE_SECRET = 'test-state-secret';
        process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
        process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    });

    it('returns an operator-safe error when Google OAuth env is missing', async () => {
        delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const route = await import('../../app/api/connectors/google/auth/route.js');

        const response = await route.GET(new Request('https://www.trouvable.app/api/connectors/google/auth?clientId=client-123'));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toMatchObject({
            error: 'missing_google_oauth_env',
        });
        expect(JSON.stringify(body)).not.toContain('client-secret');
        expect(generateAuthUrlMock).not.toHaveBeenCalled();
    });

    it('rejects unsafe returnTo values before redirecting to Google', async () => {
        const route = await import('../../app/api/connectors/google/auth/route.js');

        const response = await route.GET(new Request('https://www.trouvable.app/api/connectors/google/auth?clientId=client-123&returnTo=https://evil.test'));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('invalid_return_to');
        expect(generateAuthUrlMock).not.toHaveBeenCalled();
    });

    it('rejects tampered callback state without falling back to raw state', async () => {
        const route = await import('../../app/api/connectors/google/callback/route.js');

        const response = await route.GET(new Request('https://www.trouvable.app/api/connectors/google/callback?code=abc&state=client-123'));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            error: 'invalid_google_oauth_state',
            detail: 'missing_state',
        });
    });
});
