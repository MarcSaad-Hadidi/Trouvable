import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const validator = path.join(root, 'scripts/validate-hibernation.mjs');
const fixtures = [];
const required = [
    'parking/index.html', 'parking/404.html', 'parking/robots.txt', 'vercel.json', 'package.json',
    'scripts/vercel-ignore-hibernation.mjs', '.github/dependabot.yml',
    '.github/workflows/ci.yml', '.github/workflows/external-cron.yml',
    '.github/workflows/codeql.yml', '.github/workflows/dependency-review.yml',
];

function fixture() {
    const directory = mkdtempSync(path.join(tmpdir(), 'trouvable-hibernation-'));
    fixtures.push(directory);
    for (const file of required) {
        mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
        cpSync(path.join(root, file), path.join(directory, file));
    }
    return directory;
}

afterEach(() => {
    for (const directory of fixtures.splice(0)) {
        // Only delete the exact disposable directory created by this test.
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
        assert.ok(path.basename(directory).startsWith('trouvable-hibernation-'));
        rmSync(directory, { recursive: true, force: true });
    }
});

function rewrite(directory, file, transform) {
    const target = path.join(directory, file);
    const before = readFileSync(target, 'utf8');
    const after = transform(before);
    assert.notEqual(after, before, 'mutation must change its fixture');
    writeFileSync(target, after);
}

function vercel(directory, transform) {
    rewrite(directory, 'vercel.json', raw => JSON.stringify(transform(JSON.parse(raw))));
}

function validate(directory) {
    return spawnSync(process.execPath, [validator], { cwd: directory, encoding: 'utf8', timeout: 10000 });
}

test('closed contract accepts static parking and isolated manual validation without application dependencies', () => {
    const result = validate(fixture());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Hibernation validation passed/);
});

const ciFile = '.github/workflows/ci.yml';
const mutations = [
    ['parking unquoted inline CSS resource', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('<body>', '<body style=background:url(https://example.invalid/x)>'))],
    ['parking encoded second slash navigation', directory => rewrite(directory, 'parking/404.html', raw => raw.replace('href="/"', 'href="/&#x2f;example.invalid"'))],
    ['parking control-character external navigation', directory => rewrite(directory, 'parking/404.html', raw => raw.replace('href="/"', 'href="/\n/example.invalid"'))],
    ['parking secondary external srcset candidate', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</body>', '<img srcset="/local.png 1x, https://example.invalid/x 2x"></body>'))],
    ['parking CSS image-set resource', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</style>', 'body{background:image-set("https://example.invalid/x" 1x)}</style>'))],
    ['parking entity encoded inline CSS resource', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('<body>', '<body style="background:&#117;rl(https://example.invalid/x)">'))],
    ['external cron condition only in comment', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw.replace("inputs.confirm == 'RUN_ONCE'", 'true') + "\n# if: ${{ inputs.confirm == 'RUN_ONCE' }}\n")],
    ['external cron default only in comment', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw.replace('default: CANCEL', 'default: RUN_ONCE') + '\n# default: CANCEL\n')],
    ['extra external cron job without confirmation', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw + '\n  unchecked:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo should-require-confirmation\n')],
    ['legacy Vercel builder', directory => vercel(directory, config => ({ ...config, builds: [{ src: 'package.json', use: '@vercel/next' }] }))],
    ['duplicate quoted workflow event', directory => rewrite(directory, '.github/workflows/codeql.yml', raw => raw + '\n"on":\n  push:\n')],

    ['parking robots weaker metadata', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('noindex, nofollow, noarchive', 'noindex'))],
    ['parking crawler allow override', directory => rewrite(directory, 'parking/robots.txt', raw => raw + '\nAllow: /\n')],
    ['additional active Dependabot entry', directory => rewrite(directory, '.github/dependabot.yml', raw => raw + '\n  - package-ecosystem: npm\n    directory: /archive\n    open-pull-requests-limit: 2\n')],

    ['Git deployment enabled', directory => vercel(directory, config => ({ ...config, git: { deploymentEnabled: true } }))],
    ['dynamic framework restored', directory => vercel(directory, config => ({ ...config, framework: 'nextjs' }))],
    ['parking dependency installation', directory => vercel(directory, config => ({ ...config, installCommand: 'npm ci' }))],
    ['application build in parking', directory => vercel(directory, config => ({ ...config, buildCommand: 'npm run build' }))],
    ['automatic Vercel cron', directory => vercel(directory, config => ({ ...config, crons: [{ path: '/api/cron', schedule: '* * * * *' }] }))],
    ['serverless functions', directory => vercel(directory, config => ({ ...config, functions: { 'api/**': {} } }))],
    ['runtime rewrites', directory => vercel(directory, config => ({ ...config, rewrites: [{ source: '/', destination: '/api' }] }))],
    ['weakened default CSP', directory => vercel(directory, config => {
        config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value = "default-src 'self'";
        return config;
    })],
    ['scripts allowed despite default none', directory => vercel(directory, config => {
        config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value += "; script-src 'self'";
        return config;
    })],
    ['route-specific CSP override', directory => vercel(directory, config => ({
        ...config, headers: [...config.headers, { source: '/', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'" }] }],
    }))],
    ['automatic external cron', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw.replace('on:', "on:\n  schedule:\n    - cron: '* * * * *'"))],
    ['inline automatic cron trigger', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw.replace('on:', 'on: {schedule: [], workflow_dispatch: {}}'))],
    ['external cron confirmation removed', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw.replace("inputs.confirm == 'RUN_ONCE'", 'true'))],
    ['external cron default activated', directory => rewrite(directory, '.github/workflows/external-cron.yml', raw => raw.replace('default: CANCEL', 'default: RUN_ONCE'))],
    ['automatic CodeQL', directory => rewrite(directory, '.github/workflows/codeql.yml', raw => raw.replace('on:', 'on:\n  push:'))],
    ['additional manual automation trigger', directory => rewrite(directory, '.github/workflows/dependency-review.yml', raw => raw.replace('on:', 'on:\n  repository_dispatch:'))],
    ['application job made automatic', directory => rewrite(directory, ciFile, raw => raw.replace("github.event_name == 'workflow_dispatch'", 'true'))],
    ['application job enabled on pull requests', directory => rewrite(directory, ciFile, raw => raw.replace("github.event_name == 'workflow_dispatch'", "github.event_name != 'schedule'"))],
    ['application job secret', directory => rewrite(directory, ciFile, raw => raw.replace('    env:', '    env:\n      SUPABASE_SERVICE_ROLE_KEY: ' + '$' + '{{ secrets.PRODUCTION_KEY }}'))],
    ['unbounded application timeout', directory => rewrite(directory, ciFile, raw => raw.replace('timeout-minutes: 20', 'timeout-minutes: 120'))],
    ['equivalent unapproved command', directory => rewrite(directory, ciFile, raw => raw.replace('run: npm run verify', 'run: npm exec next build'))],
    ['application install in automatic gate', directory => rewrite(directory, ciFile, raw => raw.replace('run: node scripts/validate-hibernation.mjs', 'run: npm ci'))],
    ['extra automatic job', directory => rewrite(directory, ciFile, raw => raw + '\n  unapproved:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n')],
    ['new workflow outside allowlist', directory => writeFileSync(path.join(directory, '.github/workflows/extra.yml'), 'on: push\njobs: {}\n')],
    ['automatic CI schedule', directory => rewrite(directory, ciFile, raw => raw.replace('on:', 'on:\n  schedule:\n    - cron: "0 0 * * *"'))],
    ['indirect application script', directory => rewrite(directory, 'package.json', raw => {
        const config = JSON.parse(raw);
        config.scripts.build = 'next build --webpack && node scripts/deploy.js';
        return JSON.stringify(config);
    })],
    ['lint warning threshold removed', directory => rewrite(directory, 'package.json', raw => {
        const config = JSON.parse(raw);
        config.scripts.lint = 'eslint .';
        return JSON.stringify(config);
    })],
    ['verification lifecycle hook', directory => rewrite(directory, 'package.json', raw => {
        const config = JSON.parse(raw);
        config.scripts.preverify = 'node scripts/production.js';
        return JSON.stringify(config);
    })],
    ['repository check invokes deployment', directory => rewrite(directory, 'package.json', raw => {
        const config = JSON.parse(raw);
        config.scripts['check:repository'] = 'node scripts/deploy.js';
        return JSON.stringify(config);
    })],
    ['application lifecycle hook', directory => rewrite(directory, 'package.json', raw => {
        const config = JSON.parse(raw);
        config.scripts.pretest = 'node scripts/production.js';
        return JSON.stringify(config);
    })],
    ['parking script', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</body>', '<script>alert(1)</script></body>'))],
    ['parking inline event handler', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('<body>', '<body onload="alert(1)">'))],
    ['parking external image', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</body>', '<img src="https://example.invalid/image.png"></body>'))],
    ['parking protocol-relative image', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</body>', '<img src="//example.invalid/image.png"></body>'))],
    ['parking encoded external resource', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</body>', '<img src="&#104;ttps://example.invalid/image.png"></body>'))],
    ['parking external CSS URL', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</style>', 'body{background:url(https://example.invalid/x)}</style>'))],
    ['parking escaped CSS import', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</style>', '@\\69mport "https://example.invalid/x";</style>'))],
    ['parking executable link', directory => rewrite(directory, 'parking/404.html', raw => raw.replace('href="/"', 'href="javascript:alert(1)"'))],
    ['parking refresh redirect', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</head>', '<meta http-equiv="refresh" content="0;url=https://example.invalid"></head>'))],
    ['parking form', directory => rewrite(directory, 'parking/index.html', raw => raw.replace('</body>', '<form action="/api"></form></body>'))],
    ['unexpected parking artifact', directory => writeFileSync(path.join(directory, 'parking/app.js'), 'void 0;')],
];

for (const [name, mutate] of mutations) {
    test('rejects ' + name, () => {
        const directory = fixture();
        mutate(directory);
        const result = validate(directory);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /Hibernation validation failed/);
    });
}

test('Vercel ignore guard ignores the integration branch and retains explicit dormant allowlist exit codes', () => {
    const script = path.join(root, 'scripts/vercel-ignore-hibernation.mjs');
    const ignored = spawnSync(process.execPath, [script], { env: { ...process.env, VERCEL_GIT_COMMIT_REF: 'refactor/trouvable-repo-consolidation' } });
    const allowed = spawnSync(process.execPath, [script], { env: { ...process.env, VERCEL_GIT_COMMIT_REF: 'main' } });
    assert.equal(ignored.status, 0);
    assert.equal(allowed.status, 1);
});
