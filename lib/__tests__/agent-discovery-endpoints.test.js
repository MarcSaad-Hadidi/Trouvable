import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('agent discovery endpoints', () => {
    it('serves RFC 9727 API catalog payload', async () => {
        const mod = await import('../../app/.well-known/api-catalog/route.js');
        const response = mod.GET(new Request('https://www.trouvable.app/.well-known/api-catalog'));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/linkset+json');

        const body = await response.json();
        expect(Array.isArray(body.linkset)).toBe(true);
        expect(body.linkset.length).toBeGreaterThan(0);

        const first = body.linkset[0];
        expect(first.anchor).toContain('/api');
        expect(Array.isArray(first['service-desc'])).toBe(true);
        expect(Array.isArray(first['service-doc'])).toBe(true);
        expect(Array.isArray(first.status)).toBe(true);
    });

    it('serves OAuth protected resource metadata', async () => {
        const mod = await import('../../app/.well-known/oauth-protected-resource/route.js');
        const response = mod.GET(new Request('https://www.trouvable.app/.well-known/oauth-protected-resource'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.resource).toBe('https://www.trouvable.app');
        expect(body.authorization_servers).toContain('https://www.trouvable.app');
        expect(body.scopes_supported).toContain('read:public');
    });

    it('serves agent skills discovery index with sha256 digests', async () => {
        const mod = await import('../../app/.well-known/agent-skills/index.json/route.js');
        const response = mod.GET(new Request('https://www.trouvable.app/.well-known/agent-skills/index.json'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.$schema).toContain('/discovery/0.2.0/schema.json');
        expect(Array.isArray(body.skills)).toBe(true);
        expect(body.skills.length).toBeGreaterThan(0);

        for (const entry of body.skills) {
            expect(entry.type).toBe('skill-md');
            expect(entry.url).toContain('/.well-known/agent-skills/');
            expect(entry.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
        }
    });

    it('serves markdown skill artifact', async () => {
        const mod = await import('../../app/.well-known/agent-skills/[skill]/SKILL.md/route.js');
        const response = await mod.GET(
            new Request('https://www.trouvable.app/.well-known/agent-skills/api-catalog/SKILL.md'),
            { params: Promise.resolve({ skill: 'api-catalog' }) },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/markdown');

        const body = await response.text();
        expect(body).toContain('name: api-catalog');
        expect(body).toContain('# API Catalog');
    });
});

describe('proxy discovery and markdown wiring', () => {
    it('includes homepage API Link relations', () => {
        const source = readFileSync(resolve(process.cwd(), 'lib/agent-discovery/config.js'), 'utf-8');
        expect(source).toContain('rel="api-catalog"');
        expect(source).toContain('rel="service-doc"');
        expect(source).toContain('rel="service-desc"');
        expect(source).toContain('rel="status"');
    });

    it('contains markdown negotiation rewrite to internal markdown renderer', () => {
        const source = readFileSync(resolve(process.cwd(), 'proxy.js'), 'utf-8');
        expect(source).toContain('/__agent/markdown');
        expect(source).toContain('acceptsMarkdown');
    });
});

describe('markdown response negotiation endpoint', () => {
    it('returns markdown content-type and token estimate headers', async () => {
        const mod = await import('../../app/%5F%5Fagent/markdown/route.js');
        const originalFetch = global.fetch;

        global.fetch = async () => new Response('<html><body><h1>Accueil</h1><p>Bienvenue.</p></body></html>');

        try {
            const response = await mod.GET(
                new Request('https://www.trouvable.app/__agent/markdown?path=%2F'),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('text/markdown');

            const tokenHeader = response.headers.get('x-markdown-tokens');
            expect(tokenHeader).toBeTruthy();
            expect(Number(tokenHeader)).toBeGreaterThan(0);
        } finally {
            global.fetch = originalFetch;
        }
    }, 20000);
});
