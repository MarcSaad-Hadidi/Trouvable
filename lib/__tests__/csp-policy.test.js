/**
 * The application proxy and static parking have separate CSP contracts.
 * Keep production integrations explicit and parking unable to run scripts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function applicationPolicy() {
    const source = readFileSync(resolve('proxy.js'), 'utf8');
    const match = source.match(/const cspHeader = \[([\s\S]*?)\]\.join/);
    if (!match) throw new Error('Could not extract application CSP');
    return [...match[1].matchAll(/(['"])(.*?)\1/g)].map((entry) => entry[2]).join('; ');
}

function parkingPolicy() {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
    return config.headers.find((entry) => entry.source === '/(.*)').headers
        .find((header) => header.key === 'Content-Security-Policy').value;
}

function directives(policy) {
    return Object.fromEntries(policy.split(';').filter((part) => part.trim()).map((part) => {
        const [name, ...values] = part.trim().split(/\s+/);
        return [name, values];
    }));
}

const application = directives(applicationPolicy());
const parking = directives(parkingPolicy());
const effectiveParking = (directive) => parking[directive] ?? parking['default-src'];

describe('application CSP', () => {
    it('forbids production eval and external fonts', () => {
        expect(application['script-src']).not.toContain("'unsafe-eval'");
        expect(application['style-src']).not.toContain('https://fonts.googleapis.com');
        expect(application['font-src']).toEqual(["'self'"]);
    });

    it('blocks framing and plugins and upgrades insecure requests', () => {
        expect(application['frame-ancestors']).toEqual(["'none'"]);
        expect(application['object-src']).toEqual(["'none'"]);
        expect(application).toHaveProperty('upgrade-insecure-requests');
        expect(application['base-uri']).toEqual(["'self'"]);
    });

    it('keeps required application integrations explicit', () => {
        expect(application['script-src']).toContain('https://*.clerk.com');
        expect(application['script-src']).toContain('https://challenges.cloudflare.com');
        expect(application['script-src']).toContain('https://va.vercel-scripts.com');
        expect(application['connect-src']).toContain('https://*.supabase.co');
        expect(application['script-src']).toContain('https://*.clarity.ms');
        expect(application['connect-src']).toContain('https://*.clarity.ms');
        expect(application['connect-src']).toContain('https://c.bing.com');
    });
});

describe('parking CSP', () => {
    it('denies every runtime integration, including via default-src', () => {
        expect(parking['default-src']).toEqual(["'none'"]);
        for (const directive of ['script-src', 'connect-src', 'frame-src', 'worker-src', 'object-src', 'font-src']) {
            expect(effectiveParking(directive)).toEqual(["'none'"]);
        }
        expect(parkingPolicy()).not.toMatch(/https?:|unsafe-eval/);
    });

    it('allows only local presentation and denies forms, framing and base URLs', () => {
        expect(parking['style-src']).toEqual(["'unsafe-inline'"]);
        expect(parking['img-src']).toEqual(["'self'", 'data:']);
        expect(parking['base-uri']).toEqual(["'none'"]);
        expect(parking['form-action']).toEqual(["'none'"]);
        expect(parking['frame-ancestors']).toEqual(["'none'"]);
    });
});

