import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEV_BYPASS_TURNSTILE_TOKEN,
    getDevAdminIdentity,
    isDevAuthBypassAllowedForHeaders,
    isDevCloudflareBypassAllowedForRequest,
    isDevTurnstileToken,
    isLocalDevelopmentHost,
    normalizeHostname,
} from '../dev-bypass.js';

const originalEnv = { ...process.env };

function makeHeaders(host) {
    return {
        get(name) {
            if (name === 'x-forwarded-host' || name === 'host') {
                return host;
            }

            return null;
        },
    };
}

function makeRequest(hostname) {
    return {
        nextUrl: { hostname },
        headers: makeHeaders(hostname),
    };
}

describe('dev-bypass', () => {
    beforeEach(() => {
        process.env = {
            ...originalEnv,
            NODE_ENV: 'development',
        };

        delete process.env.DEV_BYPASS_AUTH;
        delete process.env.DEV_BYPASS_CLOUDFLARE;
        delete process.env.DEV_BYPASS_ADMIN_EMAIL;
        delete process.env.DEV_BYPASS_ADMIN_USER_ID;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('normalizes raw host values before checking localhost', () => {
        expect(normalizeHostname('http://localhost:3000')).toBe('localhost');
        expect(normalizeHostname('127.0.0.1:3100')).toBe('127.0.0.1');
        expect(isLocalDevelopmentHost('[::1]:3000')).toBe(true);
    });

    it('requires an explicit auth flag and a local host', () => {
        process.env.DEV_BYPASS_AUTH = '1';

        expect(isDevAuthBypassAllowedForHeaders(makeHeaders('localhost:3000'))).toBe(true);
        expect(isDevAuthBypassAllowedForHeaders(makeHeaders('preview.trouvable.app'))).toBe(false);
    });

    it('requires an explicit Cloudflare flag and a local host', () => {
        process.env.DEV_BYPASS_CLOUDFLARE = '1';

        expect(isDevCloudflareBypassAllowedForRequest(makeRequest('127.0.0.1'))).toBe(true);
        expect(isDevCloudflareBypassAllowedForRequest(makeRequest('trouvable.app'))).toBe(false);
    });

    it('returns the configured dev admin identity', () => {
        process.env.DEV_BYPASS_ADMIN_EMAIL = 'Local.Admin@Trouvable.App';
        process.env.DEV_BYPASS_ADMIN_USER_ID = 'dev-operator';

        expect(getDevAdminIdentity()).toEqual({
            userId: 'dev-operator',
            email: 'local.admin@trouvable.app',
            isDevBypass: true,
        });
    });

    it('recognizes only the dedicated local Turnstile bypass token', () => {
        expect(isDevTurnstileToken(DEV_BYPASS_TURNSTILE_TOKEN)).toBe(true);
        expect(isDevTurnstileToken('not-the-token')).toBe(false);
    });
});
