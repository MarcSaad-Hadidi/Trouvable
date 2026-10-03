import { describe, expect, it } from 'vitest';

describe('public OAuth metadata', () => {
    it('does not advertise active grants for unsupported local OAuth endpoints', async () => {
        const route = await import('../../app/.well-known/oauth-authorization-server/route.js');
        const response = route.GET(new Request('https://www.trouvable.app/.well-known/oauth-authorization-server'));
        const body = await response.json();

        expect(body.trouvable_status).toBe('disabled');
        expect(body.grant_types_supported || []).toEqual([]);
        expect(body.response_types_supported || []).toEqual([]);
    });
});
