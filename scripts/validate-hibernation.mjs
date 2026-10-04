import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readRequired(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), 'utf8');
  } catch (error) {
    fail(`${relativePath}: missing or unreadable (${error.code || error.message})`);
    return '';
  }
}

function assertStaticHtml(relativePath, html) {
  if (!html) return;
  if (!/^<!doctype html>/i.test(html.trimStart())) fail(relativePath + ': must start with <!doctype html>');
  const robotsMeta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).find(tag => /\bname\s*=\s*["']robots["']/i.test(tag));
  const robotsContent = robotsMeta?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  const robots = robotsContent.toLowerCase().split(/[\s,]+/);
  if (!['noindex', 'nofollow', 'noarchive'].every(value => robots.includes(value))) fail(relativePath + ': must declare robots noindex, nofollow, noarchive');
  if (/<(?:script|form|iframe|object|embed)\b/i.test(html) || /\bon[a-z]+\s*=/i.test(html)) fail(relativePath + ': executable content and forms are forbidden');
  if (/<meta[^>]+http-equiv\s*=/i.test(html)) fail(relativePath + ': refresh navigation is forbidden');
  if (/\bsrcset\s*=/i.test(html)) fail(relativePath + ': responsive resource lists are forbidden');
  for (const match of html.matchAll(/\b(?:src|href|poster|action|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (/[&\u0000-\u0020]/.test(value) || !/^(?:\/(?![\/\\])[^\\]*|#[a-z0-9_-]*)$/i.test(value)) fail(relativePath + ': external or executable resource reference is forbidden');
  }
  // Parking has no resource-loading CSS; reject escapes that could conceal URLs.
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]);
  styles.push(...[...html.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(match => match[1] ?? match[2] ?? match[3]));
  if (styles.some(css => /&|\\|@import\b|(?:url|image-set|image|src)\s*\(|@font-face\b/i.test(css))) fail(relativePath + ': resource-loading CSS is forbidden');
  if (/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/i.test(html)) fail(relativePath + ': runtime network calls are forbidden');
}

function assertManualOnlyWorkflow(relativePath, yaml) {
  if (!yaml) return;
  const lines = yaml.replace(/\r/g, '').split('\n');
  const eventStart = lines.indexOf('on:');
  if (lines.filter(line => /^(?:on|['"]on['"]):/.test(line)).length !== 1 || eventStart < 0) {
    fail(relativePath + ': only the explicit workflow_dispatch event block is allowed');
    return;
  }
  const events = [];
  for (const line of lines.slice(eventStart + 1)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^\S/.test(line)) break;
    if (/^  \S/.test(line)) events.push(line);
  }
  if (events.length !== 1 || events[0] !== '  workflow_dispatch:') fail(relativePath + ': automatic or additional triggers are forbidden while hibernating');
}

function normalizeWorkflow(yaml) {
  return yaml.replace(/\r/g, '').split('\n')
    .filter(line => line.trim() && !line.trimStart().startsWith('#'))
    .map(line => line.trimEnd()).join('\n');
}

// Closed CI contract: alternative YAML, commands, jobs, env or permissions
// cannot run unchecked. Review changes here and in the workflow together.
const CI_CONTRACT = [
  "name: Hibernation Gate",
  "",
  "on:",
  "  push:",
  "    branches:",
  "      - main",
  "  pull_request:",
  "    branches:",
  "      - main",
  "  workflow_dispatch:",
  "",
  "permissions:",
  "  contents: read",
  "",
  "concurrency:",
  "  group: hibernation-gate-${{ github.workflow }}-${{ github.ref }}",
  "  cancel-in-progress: true",
  "",
  "jobs:",
  "  static-hibernation:",
  "    name: Validate static hibernation deployment",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 5",
  "    steps:",
  "      - name: Checkout repository",
  "        uses: actions/checkout@v6",
  "        with:",
  "          persist-credentials: false",
  "      - name: Setup Node.js",
  "        uses: actions/setup-node@v6",
  "        with:",
  "          node-version: \"24\"",
  "      - name: Validate hibernation contract",
  "        run: node scripts/validate-hibernation.mjs",
  "      - name: Test hibernation guards",
  "        run: node --test scripts/__tests__/hibernation.test.mjs",
  "",
  "  application-validation:",
  "    name: Validate dormant application manually",
  "    if: ${{ github.event_name == 'workflow_dispatch' }}",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 20",
  "    concurrency:",
  "      group: application-validation-${{ github.ref }}",
  "      cancel-in-progress: true",
  "    env:",
  "      NEXT_TELEMETRY_DISABLED: \"1\"",
  "    steps:",
  "      - name: Checkout repository",
  "        uses: actions/checkout@v6",
  "        with:",
  "          persist-credentials: false",
  "      - name: Setup Node.js",
  "        uses: actions/setup-node@v6",
  "        with:",
  "          node-version: \"24\"",
  "      - name: Install locked dependencies without lifecycle scripts",
  "        run: npm ci --ignore-scripts --no-audit --no-fund",
  "      - name: Verify dormant application without service secrets",
  "        run: npm run verify",
  ""
].join('\n');

function assertCiWorkflow(yaml, packageRaw) {
  if (!yaml) return;
  if (normalizeWorkflow(yaml) !== normalizeWorkflow(CI_CONTRACT)) fail('.github/workflows/ci.yml: must match the approved lightweight gate and isolated manual application job');
  if (!packageRaw) return;
  try {
    const scripts = JSON.parse(packageRaw).scripts || {};
    const approved = {
      'format:check': 'prettier . --check',
      lint: 'eslint . --max-warnings 0',
      typecheck: 'next typegen --webpack && tsc --noEmit',
      test: 'vitest run',
      'test:tooling': 'node --test scripts/__tests__/repository.test.mjs scripts/__tests__/verify.test.mjs',
      'test:hibernation': 'node --test scripts/__tests__/hibernation.test.mjs',
      build: 'next build --webpack',
      'check:hibernation': 'node scripts/validate-hibernation.mjs',
      'check:repository': 'node scripts/check-repository.mjs',
      verify: 'node scripts/verify.mjs',
    };
    for (const [name, command] of Object.entries(approved)) {
      if (scripts[name] !== command || scripts['pre' + name] || scripts['post' + name]) fail('package.json: manual validation script ' + name + ' must remain local and free of lifecycle hooks');
    }
  } catch {
    fail('package.json: unreadable manual validation commands');
  }
}

function assertParkingCsp(policy) {
  const directives = new Map();
  for (const part of policy.split(';').filter(value => value.trim())) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (directives.has(name)) fail('vercel.json: duplicate parking CSP directive ' + name);
    directives.set(name, values.join(' '));
  }
  const presentation = {
    'default-src': "'none'", 'style-src': "'unsafe-inline'", 'img-src': "'self' data:",
    'base-uri': "'none'", 'form-action': "'none'", 'frame-ancestors': "'none'",
  };
  for (const [name, value] of Object.entries(presentation)) {
    if (directives.get(name) !== value) fail('vercel.json: parking CSP must enforce ' + name + ' ' + value);
  }
  for (const [name, value] of directives) {
    if (!(name in presentation) && value !== "'none'") fail('vercel.json: parking CSP cannot enable ' + name);
  }
}

const indexHtml = await readRequired('parking/index.html');
const notFoundHtml = await readRequired('parking/404.html');
const robotsTxt = await readRequired('parking/robots.txt');
const vercelRaw = await readRequired('vercel.json');
const ignoreScript = await readRequired('scripts/vercel-ignore-hibernation.mjs');
const ciWorkflow = await readRequired('.github/workflows/ci.yml');
const packageRaw = await readRequired('package.json');
const cronWorkflow = await readRequired('.github/workflows/external-cron.yml');
const codeqlWorkflow = await readRequired('.github/workflows/codeql.yml');
const dependencyWorkflow = await readRequired('.github/workflows/dependency-review.yml');
const dependabotConfig = await readRequired('.github/dependabot.yml');

assertStaticHtml('parking/index.html', indexHtml);
assertStaticHtml('parking/404.html', notFoundHtml);

if (indexHtml && !/Trouvable est temporairement en pause/i.test(indexHtml)) {
  fail('parking/index.html: missing the public hibernation message');
}
if (robotsTxt && robotsTxt.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(line => line && !line.startsWith('#')).join('\n') !== 'user-agent: *\ndisallow: /') {
  fail('parking/robots.txt: must disallow every crawler without allow overrides');
}

if (vercelRaw) {
  try {
    const config = JSON.parse(vercelRaw);
    const staticKeys = new Set(['$schema', 'framework', 'installCommand', 'buildCommand', 'outputDirectory', 'ignoreCommand', 'git', 'cleanUrls', 'trailingSlash', 'headers']);
    for (const key of Object.keys(config)) if (!staticKeys.has(key)) fail('vercel.json: unapproved configuration key ' + key);
    if (config.framework !== null) fail('vercel.json: framework must be null (Other preset)');
    if (config.installCommand !== '') fail('vercel.json: installCommand must be empty');
    if (config.buildCommand !== 'node scripts/validate-hibernation.mjs') {
      fail('vercel.json: buildCommand must run the hibernation validator');
    }
    if (config.outputDirectory !== 'parking') fail('vercel.json: outputDirectory must be parking');
    if (config.ignoreCommand !== 'node scripts/vercel-ignore-hibernation.mjs') {
      fail('vercel.json: ignoreCommand must enforce the hibernation deployment allowlist');
    }
    if (config.git?.deploymentEnabled !== false) {
      fail('vercel.json: automatic Git deployments must be disabled after the static production rollout');
    }
    for (const forbiddenKey of ['functions', 'crons', 'rewrites', 'routes']) {
      if (Object.prototype.hasOwnProperty.call(config, forbiddenKey)) {
        fail(`vercel.json: ${forbiddenKey} is forbidden in static hibernation mode`);
      }
    }
    const allHeaders = (config.headers || []).flatMap((entry) => entry.headers || []);
    const headerMap = new Map(allHeaders.map((entry) => [String(entry.key).toLowerCase(), String(entry.value)]));
    if (!['noindex', 'nofollow', 'noarchive'].every(value => (headerMap.get('x-robots-tag') || '').toLowerCase().split(/[\s,]+/).includes(value))) {
      fail('vercel.json: X-Robots-Tag must disable indexing');
    }
    assertParkingCsp(headerMap.get('content-security-policy') || '');
    if ((config.headers || []).some(entry => entry.source !== '/(.*)')) fail('vercel.json: parking headers must apply uniformly to every route');
  } catch (error) {
    fail(`vercel.json: invalid JSON (${error.message})`);
  }
}

if (ignoreScript) {
  if (!/VERCEL_GIT_COMMIT_REF/.test(ignoreScript)) {
    fail('scripts/vercel-ignore-hibernation.mjs: must inspect VERCEL_GIT_COMMIT_REF');
  }
  if (!/process\.exit\(0\)/.test(ignoreScript) || !/process\.exit\(1\)/.test(ignoreScript)) {
    fail('scripts/vercel-ignore-hibernation.mjs: must implement explicit ignore/build exit codes');
  }
}

assertCiWorkflow(ciWorkflow, packageRaw);

assertManualOnlyWorkflow('.github/workflows/external-cron.yml', cronWorkflow);
// Freeze the reviewed manual cron as a whole: comments cannot satisfy guards,
// and an extra job cannot bypass explicit confirmation. Review any change.
if (cronWorkflow && createHash('sha256').update(normalizeWorkflow(cronWorkflow)).digest('hex') !== '30f98b56b3a9ee870e2faaf8895861814fd5f284ff4d6f6b6ad8eeb8ee9c3ed8') {
  fail('.github/workflows/external-cron.yml: must retain the reviewed manual workflow and explicit RUN_ONCE confirmation');
}
assertManualOnlyWorkflow('.github/workflows/codeql.yml', codeqlWorkflow);
assertManualOnlyWorkflow('.github/workflows/dependency-review.yml', dependencyWorkflow);

if (dependabotConfig) {
  const limits = [...dependabotConfig.matchAll(/open-pull-requests-limit:\s*(\d+)/g)].map(match => Number(match[1]));
  const ecosystems = [...dependabotConfig.matchAll(/package-ecosystem:\s*["']?([\w-]+)/g)].map(match => match[1]);
  if (limits.length !== 2 || limits.some(limit => limit !== 0) || ecosystems.length !== 2 || !ecosystems.includes('npm') || !ecosystems.includes('github-actions')) {
    fail('.github/dependabot.yml: exactly the dormant npm and GitHub Actions version-update entries must remain disabled');
  }
}

try {
  const files = await readdir(path.join(root, 'parking'));
  const allowed = new Set(['404.html', 'index.html', 'robots.txt']);
  for (const file of files) {
    if (!allowed.has(file)) fail(`parking/${file}: unexpected deployment artifact`);
  }
} catch {
  // readRequired already reports the missing directory through required files.
}

try {
  const workflowFiles = await readdir(path.join(root, '.github/workflows'));
  const allowedWorkflows = new Set(['ci.yml', 'codeql.yml', 'dependency-review.yml', 'external-cron.yml']);
  for (const file of workflowFiles) {
    if (!allowedWorkflows.has(file)) {
      fail(`.github/workflows/${file}: unexpected workflow could reintroduce automatic resource use`);
    }
  }
} catch (error) {
  fail(`.github/workflows: missing or unreadable (${error.code || error.message})`);
}

if (failures.length > 0) {
  console.error('Hibernation validation failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Hibernation validation passed: static-only deployment, dormant automation, and Git deployment freeze enforced.');
