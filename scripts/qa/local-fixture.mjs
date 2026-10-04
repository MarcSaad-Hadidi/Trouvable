import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// NextURL normalizes loopback addresses to localhost; match the listener origin to prevent self-proxy rewrites.
export const QA_APP_HOST = 'localhost';

export const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
export const CLIENT = Object.freeze({
    id: CLIENT_ID,
    client_name: 'Fixture locale QA',
    client_slug: 'fixture-qa',
    website_url: 'https://fixture.invalid',
    business_type: 'service',
    lifecycle_status: 'active',
    is_published: false,
    archived_at: null,
    updated_at: '2026-10-01T12:00:00.000Z',
    created_at: '2026-09-01T12:00:00.000Z',
    notes: 'Données synthétiques, non publiées, réservées à la QA locale.',
});

// An allowlist also removes unanticipated provider credentials and inherited NODE_OPTIONS.
const SYSTEM_ENV =
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMFILES(?:\(X86\))?|PROGRAMDATA|SYSTEMDRIVE|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE|LANG|LC_ALL|TZ|TERM)$/i;
export function safeEnvironment(source, { mode, port, fixturePort, artifacts, guard, allowFonts = false }) {
    if (!['production', 'fixture'].includes(mode)) throw new Error('Unknown QA mode');
    const env = Object.fromEntries(Object.entries(source).filter(([key]) => SYSTEM_ENV.test(key)));
    Object.assign(env, {
        NODE_ENV: mode === 'fixture' ? 'development' : 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: '1',
        NEXT_PUBLIC_APP_URL: `http://${QA_APP_HOST}:${port}`,
        NODE_OPTIONS: `--require ${JSON.stringify(guard)}`,
        TROUVABLE_QA_ARTIFACTS: artifacts,
        TROUVABLE_QA_PORTS: [port, fixturePort].filter(Boolean).join(','),
        TROUVABLE_QA_ALLOW_FONTS: mode === 'fixture' && allowFonts ? '1' : '0',
        AUDIT_DISABLE_PLAYWRIGHT: '1',
    });
    if (mode === 'fixture') {
        Object.assign(env, {
            DEV_BYPASS_AUTH: '1',
            DEV_BYPASS_CLOUDFLARE: '1',
            SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
            SUPABASE_SERVICE_ROLE_KEY: 'local-fixture-only',
            SUPABASE_ANON_KEY: 'local-fixture-only',
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('fixture-only.clerk.accounts.dev$').toString('base64')}`,
            CLERK_SECRET_KEY: 'sk_test_local_fixture_only_not_a_real_secret',
            CLERK_API_URL: `http://127.0.0.1:${fixturePort}/v1`,
        });
    }
    return env;
}

export function assertNoNextEnvFiles(root) {
    const names = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.development.local',
        '.env.production',
        '.env.production.local',
    ];
    const found = names.filter((name) => fs.existsSync(path.join(root, name)));
    if (found.length)
        throw new Error(
            `QA refuses Next-loaded environment files (${found.join(', ')}). Use a disposable checkout without them; files are never read or removed.`,
        );
}

export function resolveArtifacts(root, requested) {
    if (!requested || !path.isAbsolute(requested))
        throw new Error('--artifacts must be an absolute path outside the repository');
    // Resolve existing ancestors before creating directories, including Windows junctions.
    let ancestor = path.resolve(requested);
    const suffix = [];
    while (!fs.existsSync(ancestor)) {
        suffix.unshift(path.basename(ancestor));
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw new Error('Cannot resolve artifacts directory');
        ancestor = parent;
    }
    const resolved = path.resolve(fs.realpathSync(ancestor), ...suffix);
    const relative = path.relative(fs.realpathSync(root), resolved);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('QA artifacts must remain outside the repository');
    }
    return resolved;
}

export function fixtureResponse(method, input, accept = '') {
    if (!['GET', 'HEAD'].includes(method)) return { status: 405, data: { message: 'QA fixture is read only.' } };
    const url = new URL(input, 'http://127.0.0.1');
    if (!/^\/rest\/v1\/[a-z_]+$/.test(url.pathname))
        return { status: 404, data: { message: 'No such QA fixture endpoint.' } };
    const table = url.pathname.split('/').at(-1);
    const id = url.searchParams.get('id');
    const slug = url.searchParams.get('client_slug');
    const published = url.searchParams.get('is_published');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    let rows = [];
    if (
        table === 'client_geo_profiles' &&
        (!id || id === `eq.${CLIENT_ID}`) &&
        (!slug || slug === 'eq.fixture-qa') &&
        (!published || published === 'eq.false') &&
        limit !== '0' &&
        (!offset || offset === '0')
    )
        rows = [CLIENT];
    const object = accept.includes('application/vnd.pgrst.object+json');
    if (object && !rows.length)
        return {
            status: 406,
            data: {
                code: 'PGRST116',
                details: 'The result contains 0 rows',
                message: 'JSON object requested, multiple (or no) rows returned',
                hint: null,
            },
            count: 0,
        };
    return { status: 200, data: object ? rows[0] : rows, count: rows.length };
}

export async function startFixture(port, artifacts) {
    const requests = [];
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        const result = fixtureResponse(req.method, url, req.headers.accept);
        requests.push({ method: req.method, path: url.pathname, query: url.search, status: result.status });
        fs.writeFileSync(path.join(artifacts, 'fixture-requests.json'), JSON.stringify(requests, null, 2));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Allow', 'GET, HEAD');
        if (result.count !== undefined)
            res.setHeader('Content-Range', result.count ? `0-${result.count - 1}/${result.count}` : '*/0');
        res.writeHead(result.status);
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(result.data));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
    });
    return { server, port: server.address().port, requests };
}

export function missingClerkConfiguration(log) {
    return /(?:publishable|secret)\s*key\s*(?:is\s*)?(?:missing|not found)|missing\s*(?:publishable|secret)\s*key|CLERK_ADMIN_EMAIL env var is required|clerk.*(?:requires? a|must.*provide).*key/i.test(
        log,
    );
}

export function classifyAnonymous({ status, location, base, configurationMissing = false, bypass = false }) {
    if (bypass) return 'failed-bypass-in-production';
    if ([401, 403].includes(status)) return 'access-denied';
    if (status >= 300 && status < 400 && location) {
        const target = new URL(location, base);
        if (
            target.origin === new URL(base).origin &&
            /^\/(?:espace|admin\/sign-in|portal\/sign-in)(?:\/|$)/.test(target.pathname)
        )
            return 'access-denied-redirect';
        return 'failed-unexpected-redirect';
    }
    if (status >= 500 && configurationMissing) return 'configuration-unavailable';
    return 'failed-unprotected-or-error';
}

export function checkUnpublishedProfile({ status, body, requests }) {
    const profileVisible = [CLIENT.client_name, CLIENT_ID, CLIENT.website_url, CLIENT.notes].some((value) =>
        body.includes(value),
    );
    const notFoundBoundary = body.includes('NEXT_HTTP_ERROR_FALLBACK;404');
    const noindex = (body.match(/<meta\b[^>]*>/gi) || []).some(
        (tag) => /\bname=["']robots["']/i.test(tag) && /\bcontent=["'][^"']*\bnoindex\b/i.test(tag),
    );
    const publishedLookups = requests.filter((request) => {
        if (request.method !== 'GET' || request.path !== '/rest/v1/client_geo_profiles') return false;
        const params = new URLSearchParams(request.query);
        return params.get('client_slug') === `eq.${CLIENT.client_slug}` && params.get('is_published') === 'eq.true';
    });
    const rejectedLookup = publishedLookups.length > 0 && publishedLookups.every((request) => request.status === 406);
    const streamedNotFound = status === 200 && notFoundBoundary && noindex;
    const valid = !profileVisible && rejectedLookup && (status === 404 || streamedNotFound);
    return {
        valid,
        classification: valid ? (streamedNotFound ? 'streamed-not-found' : 'not-found') : 'failed-unpublished-profile',
        notFoundBoundary,
        noindex,
        profileVisible,
        publishedLookups,
    };
}

// Anonymous browser fixture only; never used by production QA.
export function mockClerk() {
    const state = {
        client: { sessions: [], signIn: null, signUp: null },
        session: null,
        user: null,
        organization: null,
    };
    const mount = (element) => {
        element.textContent = 'Clerk simulé pour QA locale : connexion réelle non validée.';
        element.setAttribute('data-qa-auth-fixture', 'true');
        element.setAttribute('data-component-status', 'ready');
    };
    window.Clerk = {
        loaded: true,
        isSignedIn: false,
        __internal_lastEmittedResources: state,
        status: 'ready',
        ...state,
        load: async () => {},
        addListener: (listener, options) => {
            if (!options?.skipInitialEmit) listener(state);
            return () => {};
        },
        on: (_event, listener, options) => {
            if (options?.notify) listener('ready');
        },
        off: () => {},
        __unstable__updateProps: () => {},
        __internal_setSdkMetadata: () => {},
        __internal_queryClient: null,
        __internal_queryClientStatus: 'ready',
        telemetry: { record: () => {} },
        signOut: async () => {},
        mountSignIn: mount,
        unmountSignIn: () => {},
        mountSignUp: mount,
        unmountSignUp: () => {},
        mountUserButton: () => {},
        unmountUserButton: () => {},
    };
}
