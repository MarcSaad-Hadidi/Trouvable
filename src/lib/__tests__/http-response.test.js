import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { noStoreJson } from '../http-response';

describe('private operator JSON response', () => {
    it('preserves JSON payload and default status while disabling caching', async () => {
        const response = noStoreJson({ score: 0, missing: null });
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('Content-Type')).toContain('application/json');
        expect(await response.json()).toEqual({ score: 0, missing: null });
    });

    it('preserves error status and caller headers', async () => {
        const response = noStoreJson({ error: 'Non autorisé' }, { status: 401, headers: { 'X-Request-Id': 'test' } });
        expect(response.status).toBe(401);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('X-Request-Id')).toBe('test');
        expect(await response.json()).toEqual({ error: 'Non autorisé' });
    });

    it('retains the historical explicit cache header override', () => {
        const response = noStoreJson({}, { headers: { 'Cache-Control': 'private, max-age=0' } });
        expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });
});
