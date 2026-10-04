import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
    CLIENT_ID,
    QA_APP_HOST,
    assertNoNextEnvFiles,
    classifyAnonymous,
    checkUnpublishedProfile,
    fixtureResponse,
    missingClerkConfiguration,
    resolveArtifacts,
    safeEnvironment,
    startFixture,
    mockClerk,
} from '../qa/local-fixture.mjs';

const guard = fileURLToPath(new URL('../qa/deny-network.cjs', import.meta.url));
const directories = [];
function temporary() {
    const directory = fs.mkdtempSync(path.join(tmpdir(), 'trouvable-browser-qa-'));
    directories.push(directory);
    return directory;
}
afterEach(() => {
    for (const directory of directories.splice(0)) {
        assert.equal(path.dirname(directory), path.resolve(tmpdir()));
        assert.ok(path.basename(directory).startsWith('trouvable-browser-qa-'));
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

function environment(mode, artifacts = temporary()) {
    const inherited = {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        SUPABASE_SERVICE_ROLE_KEY: 'do-not-inherit',
        NEXT_PUBLIC_SUPABASE_URL: 'https://remote.invalid',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'do-not-inherit',
        CLERK_SECRET_KEY: 'do-not-inherit',
        DEV_BYPASS_AUTH: '1',
        DEV_BYPASS_CLOUDFLARE: '1',
        DEV_BYPASS_ADMIN_USER_ID: 'real-user',
        MISTRAL_API_KEY: 'do-not-inherit',
        GROQ_API_KEY: 'do-not-inherit',
        GEMINI_API_KEY: 'do-not-inherit',
        OPENROUTER_API_KEY: 'do-not-inherit',
        GOOGLE_API_KEY: 'do-not-inherit',
        GOOGLE_SEARCH_API_KEY: 'do-not-inherit',
        GOOGLE_SC_PRIVATE_KEY: 'do-not-inherit',
        GOOGLE_OAUTH_CLIENT_SECRET: 'do-not-inherit',
        TAVILY_API_KEY: 'do-not-inherit',
        RESEND_API_KEY: 'do-not-inherit',
        STRIPE_SECRET_KEY: 'do-not-inherit',
        CRON_SECRET: 'do-not-inherit',
        TURNSTILE_SECRET_KEY: 'do-not-inherit',
        VERCEL_TOKEN: 'do-not-inherit',
        SLACK_ALERT_WEBHOOK_URL: 'do-not-inherit',
        UNKNOWN_PROVIDER_SECRET: 'do-not-inherit',
        NODE_OPTIONS: '--require remote-script',
        HTTPS_PROXY: 'https://remote.invalid',
    };
    return safeEnvironment(inherited, {
        mode,
        port: 3417,
        fixturePort: mode === 'fixture' ? 3419 : undefined,
        artifacts,
        guard,
    });
}
test('production removes all service credentials, public keys, bypass flags and inherited Node hooks', () => {
    const env = environment('production');
    assert.equal(env.NODE_ENV, 'production');
    assert.equal(env.PATH, process.env.PATH);
    assert.equal(env.NODE_OPTIONS, `--require ${JSON.stringify(guard)}`);
    assert.equal(env.NEXT_PUBLIC_CLERK_KEYLESS_DISABLED, '1');
    assert.equal(env.TROUVABLE_QA_PORTS, '3417');
    assert.equal(env.TROUVABLE_QA_ALLOW_FONTS, '0');
    for (const [key, value] of Object.entries(env)) {
        assert.notEqual(value, 'do-not-inherit', key);
        assert.ok(!key.startsWith('DEV_BYPASS_'), key);
    }
    assert.equal(env.CLERK_SECRET_KEY, undefined);
    assert.equal(env.UNKNOWN_PROVIDER_SECRET, undefined);
    assert.equal(env.HTTPS_PROXY, undefined);
});
test('development environment points only at its synthetic local fixture', () => {
    const env = environment('fixture');
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.DEV_BYPASS_AUTH, '1');
    assert.equal(env.DEV_BYPASS_ADMIN_USER_ID, undefined);
    assert.equal(env.SUPABASE_URL, 'http://127.0.0.1:3419');
    assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, 'local-fixture-only');
    assert.equal(env.CLERK_API_URL, 'http://127.0.0.1:3419/v1');
    assert.equal(env.OPENROUTER_API_KEY, undefined);
    assert.equal(env.GOOGLE_API_KEY, undefined);
    assert.equal(env.TROUVABLE_QA_PORTS, '3417,3419');
});
test('Next environment files are refused before contents are read; .env.example remains allowed', () => {
    const root = temporary();
    fs.writeFileSync(path.join(root, '.env.example'), 'EXAMPLE=example');
    assert.doesNotThrow(() => assertNoNextEnvFiles(root));
    for (const name of [
        '.env',
        '.env.local',
        '.env.production',
        '.env.production.local',
        '.env.development',
        '.env.development.local',
    ]) {
        fs.writeFileSync(path.join(root, name), 'SECRET=must-not-load');
        assert.throws(() => assertNoNextEnvFiles(root), /QA refuses Next-loaded environment files/);
        fs.unlinkSync(path.join(root, name));
    }
});
test('artifact paths must stay outside the real checkout, including junction targets', () => {
    const root = temporary();
    const out = temporary();
    assert.throws(() => resolveArtifacts(root, 'relative'), /absolute/);
    assert.throws(() => resolveArtifacts(root, root), /outside/);
    assert.throws(() => resolveArtifacts(root, path.join(root, 'qa')), /outside/);
    assert.equal(resolveArtifacts(root, path.join(out, 'new')), path.join(out, 'new'));
    const link = path.join(out, 'link');
    fs.symlinkSync(root, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => resolveArtifacts(root, path.join(link, 'new')), /outside/);
});
test('fixture cannot publish a client, resolve real identifiers, or serve non-REST endpoints', () => {
    const list = fixtureResponse('GET', '/rest/v1/client_geo_profiles');
    assert.equal(list.status, 200);
    assert.equal(list.data[0].id, CLIENT_ID);
    assert.equal(list.data[0].is_published, false);
    for (const query of [
        'is_published=eq.true',
        'id=eq.real-client',
        'client_slug=eq.customer',
        'offset=1',
        'limit=0',
    ]) {
        assert.deepEqual(fixtureResponse('GET', `/rest/v1/client_geo_profiles?${query}`).data, []);
    }
    assert.equal(
        fixtureResponse('GET', '/rest/v1/client_geo_profiles?is_published=eq.true', 'application/vnd.pgrst.object+json')
            .status,
        406,
    );
    assert.deepEqual(fixtureResponse('GET', '/rest/v1/geo_runs').data, []);
    assert.equal(fixtureResponse('GET', '/auth/v1/user').status, 404);
});
test('HTTP fixture responds to HEAD and rejects every write method without creating state', async () => {
    const fixture = await startFixture(0, temporary());
    const base = `http://127.0.0.1:${fixture.port}/rest/v1/client_geo_profiles`;
    try {
        const head = await fetch(base, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), '');
        assert.equal(head.headers.get('content-range'), '0-0/1');
        for (const method of ['POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']) {
            const response = await fetch(base, { method });
            assert.equal(response.status, 405, method);
        }
        const response = await fetch(base);
        assert.equal((await response.json()).length, 1);
        assert.equal(fixture.requests.filter(({ status }) => status === 405).length, 5);
    } finally {
        fixture.server.closeAllConnections();
        await new Promise((resolve) => fixture.server.close(resolve));
    }
});
test('anonymous classification requires a denial or local sign-in redirect, never a missing configuration', () => {
    const base = 'http://localhost:3417';
    for (const status of [401, 403]) assert.equal(classifyAnonymous({ status, base }), 'access-denied');
    assert.equal(
        classifyAnonymous({ status: 307, location: '/espace?redirect_url=local', base }),
        'access-denied-redirect',
    );
    assert.equal(
        classifyAnonymous({ status: 307, location: 'https://accounts.invalid/sign-in', base }),
        'failed-unexpected-redirect',
    );
    assert.equal(classifyAnonymous({ status: 307, location: '/admin/clients', base }), 'failed-unexpected-redirect');
    assert.equal(classifyAnonymous({ status: 200, base }), 'failed-unprotected-or-error');
    assert.equal(classifyAnonymous({ status: 500, base }), 'failed-unprotected-or-error');
    assert.equal(classifyAnonymous({ status: 500, configurationMissing: true, base }), 'configuration-unavailable');
    assert.equal(classifyAnonymous({ status: 403, bypass: true, base }), 'failed-bypass-in-production');
    assert.equal(missingClerkConfiguration('@clerk/nextjs: Missing publishableKey.'), true);
    assert.equal(missingClerkConfiguration('Database timed out'), false);
});
test('server preload blocks fetch, HTTP overrides, DNS and direct sockets before external connection', () => {
    const env = environment('production');
    const probe = `
        import assert from 'node:assert/strict';
        import http from 'node:http';
        import dns from 'node:dns';
        import net from 'node:net';
        import tls from 'node:tls';
        await assert.rejects(fetch('https://fonts.googleapis.com'), { code: 'QA_NETWORK_BLOCKED' });
        await assert.rejects(fetch('https://provider.invalid'), { code: 'QA_NETWORK_BLOCKED' });
        await assert.rejects(fetch('http://127.0.0.1:9'), { code: 'QA_NETWORK_BLOCKED' });
        assert.throws(() => http.request('http://localhost:3417', { hostname: 'provider.invalid' }), { code: 'QA_NETWORK_BLOCKED' });
        await assert.rejects(dns.promises.lookup('provider.invalid'), { code: 'QA_NETWORK_BLOCKED' });
        await assert.rejects(new Promise((resolve, reject) => dns.lookup('provider.invalid', (error) => error ? reject(error) : resolve())), { code: 'QA_NETWORK_BLOCKED' });
        await assert.rejects(new dns.promises.Resolver().resolve4('provider.invalid'), { code: 'QA_NETWORK_BLOCKED' });
        await assert.rejects(new Promise((resolve, reject) => new dns.Resolver().resolve4('provider.invalid', (error) => error ? reject(error) : resolve())), { code: 'QA_NETWORK_BLOCKED' });
        assert.throws(() => net.connect(9, '127.0.0.1'), { code: 'QA_NETWORK_BLOCKED' });
        assert.throws(() => new net.Socket().connect({ host: 'provider.invalid', port: 443 }), { code: 'QA_NETWORK_BLOCKED' });
        assert.throws(() => tls.connect({ host: 'provider.invalid', port: 443 }), { code: 'QA_NETWORK_BLOCKED' });
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
        env,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
    });
    assert.equal(child.status, 0, child.stderr || child.error?.message);
    assert.ok(
        fs
            .readFileSync(path.join(env.TROUVABLE_QA_ARTIFACTS, 'server-network-blocked.log'), 'utf8')
            .includes('provider.invalid'),
    );
});

// This tests allowed networking end to end, without Playwright or Next dependencies.
test('preload permits only the declared local fixture port through fetch and HTTP', async () => {
    const artifacts = temporary();
    const fixture = await startFixture(0, artifacts);
    const env = safeEnvironment(process.env, {
        mode: 'fixture',
        port: 3417,
        fixturePort: fixture.port,
        artifacts,
        guard,
    });
    const probe = `
        import assert from 'node:assert/strict';
        import http from 'node:http';
        const base = process.env.SUPABASE_URL + '/rest/v1/client_geo_profiles';
        const response = await fetch(base);
        assert.equal(response.status, 200);
        assert.equal((await response.json())[0].is_published, false);
        await new Promise((resolve, reject) => http.get(base, (response) => {
            assert.equal(response.statusCode, 200);
            response.resume(); response.once('end', resolve);
        }).once('error', reject));
    `;
    try {
        await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', probe], {
            env,
            windowsHide: true,
            timeout: 10000,
        });
        assert.equal(fixture.requests.length, 2);
    } finally {
        fixture.server.closeAllConnections();
        await new Promise((resolve) => fixture.server.close(resolve));
    }
});

test('QA listener origin keeps normalized Clerk rewrites internal in Next', async () => {
    const { NextURL } = await import('next/dist/server/web/next-url.js');
    const { getRelativeURL } = await import('next/dist/shared/lib/router/utils/relativize-url.js');
    for (const mode of ['production', 'fixture']) {
        const env = environment(mode);
        const pathname = '/ai/faq.json';
        // Clerk decorates NextResponse.next with an absolute rewrite; NextURL canonicalizes loopback hosts.
        const rewrite = new NextURL(new URL(pathname, env.NEXT_PUBLIC_APP_URL).href).toString();
        const listenerRequest = `http://${QA_APP_HOST}:3417${pathname}`;
        assert.equal(getRelativeURL(rewrite, listenerRequest), pathname);
        assert.equal(env.NEXT_PUBLIC_APP_URL, `http://${QA_APP_HOST}:3417`);
    }
});

test('an unpublished profile can only pass HTTP 200 with streamed not-found content and rejected published IO', () => {
    const body = '<meta name="robots" content="noindex"/><h1>Page Introuvable</h1>NEXT_HTTP_ERROR_FALLBACK;404';
    const requests = [
        {
            method: 'GET',
            path: '/rest/v1/client_geo_profiles',
            query: '?client_slug=eq.fixture-qa&is_published=eq.true',
            status: 406,
        },
    ];
    const streamed = checkUnpublishedProfile({ status: 200, body, requests });
    assert.equal(streamed.valid, true);
    assert.equal(streamed.classification, 'streamed-not-found');
    assert.equal(streamed.profileVisible, false);
    assert.deepEqual(streamed.publishedLookups, requests);
    assert.equal(checkUnpublishedProfile({ status: 200, body, requests: [...requests, ...requests] }).valid, true);
    assert.equal(checkUnpublishedProfile({ status: 404, body, requests }).classification, 'not-found');
    for (const input of [
        { status: 200, body: body + 'Fixture locale QA', requests },
        { status: 200, body: body + CLIENT_ID, requests },
        { status: 200, body: '<meta name="robots" content="noindex"/>Ordinary page', requests },
        { status: 200, body: 'NEXT_HTTP_ERROR_FALLBACK;404', requests },
        { status: 200, body, requests: [] },
        {
            status: 200,
            body,
            requests: [{ ...requests[0], query: '?client_slug=eq.fixture-qa&is_published=eq.false' }],
        },
        { status: 200, body, requests: [{ ...requests[0], status: 200 }] },
        { status: 200, body, requests: [...requests, { ...requests[0], status: 200 }] },
        { status: 200, body, requests: [...requests, { ...requests[0], status: 500 }] },
        { status: 500, body, requests },
    ]) {
        assert.equal(checkUnpublishedProfile(input).valid, false);
        assert.equal(checkUnpublishedProfile(input).classification, 'failed-unpublished-profile');
    }
});

test('the anonymous Clerk fixture satisfies the installed auth snapshot contract without signing in', async () => {
    const { deriveState } = await import('@clerk/shared/deriveState');
    const { resolveAuthState } = await import('@clerk/shared/authorization');
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    globalThis.window = {};
    try {
        mockClerk();
        const clerk = window.Clerk;
        const authObject = deriveState(true, clerk.__internal_lastEmittedResources || {});
        const auth = resolveAuthState({ authObject, options: {} });
        assert.equal(auth.isLoaded, true);
        assert.equal(auth.isSignedIn, false);
        assert.equal(auth.userId, null);
        assert.equal(auth.sessionId, null);
        assert.equal(auth.sessionClaims, null);
        assert.deepEqual(clerk.client.sessions, []);
        const attrs = {};
        const element = {
            setAttribute: (name, value) => {
                attrs[name] = value;
            },
        };
        clerk.mountSignIn(element);
        assert.equal(attrs['data-qa-auth-fixture'], 'true');
        assert.equal(attrs['data-component-status'], 'ready');
    } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else delete globalThis.window;
    }
});
