import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { assertCronAuthorized } from '../continuous/cron-auth.js';

function makeRequest(headers = {}) {
    return {
        headers: {
            get: (key) => headers[key.toLowerCase()] ?? null,
        },
    };
}

const originalEnv = { ...process.env };

beforeEach(() => {
    process.env.CRON_SECRET = 'super-secret-test-123';
});

afterEach(() => {
    process.env = { ...originalEnv };
});

describe('assertCronAuthorized', () => {
    it('autorise avec Authorization Bearer correct', () => {
        const req = makeRequest({ authorization: 'Bearer super-secret-test-123' });
        expect(() => assertCronAuthorized(req)).not.toThrow();
    });

    it('autorise avec x-cron-secret header correct', () => {
        const req = makeRequest({ 'x-cron-secret': 'super-secret-test-123' });
        expect(() => assertCronAuthorized(req)).not.toThrow();
    });

    it('rejette si Bearer token incorrect', () => {
        const req = makeRequest({ authorization: 'Bearer mauvais-token' });
        expect(() => assertCronAuthorized(req)).toThrow();
    });

    it('rejette si x-cron-secret incorrect', () => {
        const req = makeRequest({ 'x-cron-secret': 'mauvais-token' });
        expect(() => assertCronAuthorized(req)).toThrow();
    });

    it('rejette si aucun header fourni', () => {
        const req = makeRequest({});
        expect(() => assertCronAuthorized(req)).toThrow();
    });

    it('set le code CRON_UNAUTHORIZED sur l\'erreur de refus', () => {
        const req = makeRequest({ authorization: 'Bearer mauvais' });
        try {
            assertCronAuthorized(req);
            expect.fail('Devrait avoir throw');
        } catch (err) {
            expect(err.code).toBe('CRON_UNAUTHORIZED');
        }
    });

    it('throw si CRON_SECRET env var est absente', () => {
        delete process.env.CRON_SECRET;
        const req = makeRequest({ authorization: 'Bearer n-importe-quoi' });
        expect(() => assertCronAuthorized(req)).toThrow('CRON_SECRET is missing');
    });

    it('autorise Bearer avec espaces autour du token (trim() appliqu\u00e9)', () => {
        // Le code fait .trim() donc 'Bearer  secret' -> token = 'secret' -> autoris\u00e9
        const req = makeRequest({ authorization: 'Bearer  super-secret-test-123' });
        expect(() => assertCronAuthorized(req)).not.toThrow();
    });

    it('rejette un token compl\u00e8tement diff\u00e9rent', () => {
        const req = makeRequest({ authorization: 'Bearer totalement-faux' });
        expect(() => assertCronAuthorized(req)).toThrow();
    });
});
