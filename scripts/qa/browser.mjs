import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
    CLIENT_ID,
    QA_APP_HOST,
    assertNoNextEnvFiles,
    classifyAnonymous,
    checkUnpublishedProfile,
    missingClerkConfiguration,
    resolveArtifacts,
    safeEnvironment,
    startFixture,
    mockClerk,
} from './local-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GUARD = path.join(ROOT, 'scripts/qa/deny-network.cjs');
const VIEWS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const PUBLIC = [
    '/',
    '/a-propos',
    '/offres',
    '/methodologie',
    '/contact',
    '/notre-mesure',
    '/etudes-de-cas',
    '/etudes-de-cas/dossier-type',
    '/villes/montreal',
    '/expertises/services-residentiels',
    '/agence-geo-montreal',
    '/services/audit-visibilite-ia',
    '/plateformes/chatgpt',
    '/ressources/geo-vs-seo',
];
const AUTH = ['/espace', '/portal/sign-in', '/admin/sign-in'];
const CLIENT_BASE = `/admin/clients/${CLIENT_ID}`;
const ADMIN = [
    '',
    '/dossier',
    '/dossier/audit',
    '/seo',
    '/seo/content',
    '/seo/cannibalization',
    '/seo/health',
    '/seo/on-page',
    '/seo/opportunities',
    '/seo/visibility',
    '/seo/local',
    '/seo/actions',
    '/geo',
    '/geo/prompts',
    '/geo/social',
    '/geo/models',
    '/agent',
    '/agent/visibility',
    '/agent/fixes',
    '/agent/actionability',
    '/agent/protocols',
].map((suffix) => CLIENT_BASE + suffix);
const ALIASES = [
    { route: `${CLIENT_BASE}/visibility?window=7d&sentinel=qa`, target: `${CLIENT_BASE}/seo/visibility` },
    { route: `${CLIENT_BASE}/audit?sentinel=qa`, target: `${CLIENT_BASE}/dossier/audit` },
    { route: `${CLIENT_BASE}/models`, target: `${CLIENT_BASE}/geo/models` },
];

function options(args) {
    const result = { mode: 'all', artifacts: null, executable: null, port: 0, fixturePort: 0, allowFonts: false };
    for (let i = 0; i < args.length; i++) {
        const flag = args[i];
        if (flag === '--help') return { help: true };
        if (flag === '--allow-fonts') {
            result.allowFonts = true;
            continue;
        }
        const key = {
            '--mode': 'mode',
            '--artifacts': 'artifacts',
            '--executable': 'executable',
            '--port': 'port',
            '--fixture-port': 'fixturePort',
        }[flag];
        if (!key || !args[i + 1] || args[i + 1].startsWith('--'))
            throw new Error(`Unknown or incomplete option: ${flag}`);
        result[key] = args[++i];
    }
    if (!['all', 'production', 'fixture'].includes(result.mode))
        throw new Error('--mode must be all, production or fixture');
    for (const key of ['port', 'fixturePort']) {
        result[key] = Number(result[key]);
        if (!Number.isInteger(result[key]) || result[key] < 0 || result[key] > 65535) throw new Error(`Invalid ${key}`);
    }
    return result;
}
async function availablePort(requested) {
    const reservation = net.createServer();
    await new Promise((resolve, reject) => {
        reservation.once('error', reject);
        reservation.listen(requested, QA_APP_HOST, resolve);
    });
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    return port;
}
async function stopChild(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') {
        // Only the PID spawned by this invocation; /T closes Next's workers as well.
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
        });
        await new Promise((resolve, reject) => {
            killer.once('exit', resolve);
            killer.once('error', reject);
        });
    } else {
        try {
            process.kill(-child.pid, 'SIGTERM');
        } catch (error) {
            if (error.code !== 'ESRCH') throw error;
        }
        await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
        if (child.exitCode === null && child.signalCode === null) {
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch (error) {
                if (error.code !== 'ESRCH') throw error;
            }
        }
    }
    await Promise.race([
        new Promise((resolve) =>
            child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve),
        ),
        delay(3000),
    ]);
}
async function ready(child, logFile, base) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null)
            throw new Error(`Next exited before readiness; see ${logFile}`);
        const log = fs.readFileSync(logFile, 'utf8');
        if (/EADDRINUSE|address already in use/i.test(log))
            throw new Error('QA port was taken; another server is never reused');
        // The child must announce readiness before HTTP probing; no pre-existing app is accepted.
        if (/Ready in|ready - started server/i.test(log)) {
            try {
                const response = await fetch(`${base}/robots.txt`, {
                    redirect: 'manual',
                    signal: AbortSignal.timeout(5000),
                });
                if (response.status === 200) return;
            } catch {
                /* The child is still starting; retry within the deadline. */
            }
        }
        await delay(250);
    }
    throw new Error(`Next readiness timed out; see ${logFile}`);
}

// This anonymous client is installed ONLY in the development fixture browser context.
function domSnapshot() {
    const rect = (element) => {
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height };
    };
    const shell = (element) => ({
        className: element.className,
        rect: rect(element),
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        overflowY: getComputedStyle(element).overflowY,
    });
    return {
        url: location.href,
        title: document.title,
        body: document.body.innerText.slice(0, 6500),
        viewport: innerWidth,
        width: document.documentElement.scrollWidth,
        description: document.querySelector('meta[name="description"]')?.content,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        ogImage: document.querySelector('meta[property="og:image"]')?.content,
        twitterImage: document.querySelector('meta[name="twitter:image"]')?.content,
        headings: [...document.querySelectorAll('h1,h2')].map((element) => ({
            tag: element.tagName,
            text: element.textContent,
            rect: rect(element),
        })),
        shell: [...document.querySelectorAll('.geo-shell,.geo-main,.geo-content')].map(shell),
        charts: [...document.querySelectorAll('.recharts-responsive-container')].map((element) => ({
            container: rect(element),
            svg: element.querySelector('svg') ? rect(element.querySelector('svg')) : null,
        })),
        navigation: performance.getEntriesByType('navigation').map((entry) => ({
            duration: entry.duration,
            domContentLoaded: entry.domContentLoadedEventEnd,
            transferSize: entry.transferSize,
        })),
    };
}
async function checkScroll(page) {
    const content = page.locator('.geo-content');
    await content.hover();
    const before = await page.evaluate(() => {
        const content = document.querySelector('.geo-content');
        const rect = content.getBoundingClientRect();
        const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const hit = document.elementFromPoint(point.x, point.y);
        return { scrollTop: content.scrollTop, point, hit: { tag: hit?.tagName, className: hit?.className } };
    });
    await page.mouse.wheel(0, 600);
    let settleError = null;
    try {
        await page.waitForFunction(
            () => {
                const content = document.querySelector('.geo-content');
                return content && (content.scrollHeight <= content.clientHeight + 1 || content.scrollTop > 0);
            },
            null,
            { timeout: 5000 },
        );
    } catch (error) {
        settleError = error.message;
    }
    const model = await page.evaluate(() => {
        const content = document.querySelector('.geo-content');
        const shell = document.querySelector('.geo-shell');
        const main = document.querySelector('.geo-main');
        const pageRoot =
            content && [...content.children].find((element) => !['STYLE', 'SCRIPT', 'LINK'].includes(element.tagName));
        const model = {
            geometry: content ? content.getBoundingClientRect().toJSON() : null,
            ancestors: content
                ? [content.parentElement, content.parentElement?.parentElement].filter(Boolean).map((element) => ({
                      className: element.className,
                      overflowY: getComputedStyle(element).overflowY,
                      minHeight: getComputedStyle(element).minHeight,
                      clientHeight: element.clientHeight,
                      scrollHeight: element.scrollHeight,
                  }))
                : [],
            count: document.querySelectorAll('.geo-content').length,
            page: scrollY,
            shell: shell?.scrollTop,
            content: content?.scrollTop,
            requiresScroll: content ? content.scrollHeight > content.clientHeight + 1 : false,
            shellOverflow: shell ? getComputedStyle(shell).overflowY : null,
            mainOverflow: main ? getComputedStyle(main).overflowY : null,
            contentOverflow: content ? getComputedStyle(content).overflowY : null,
            pageRootClass: pageRoot?.className || null,
            pageRootOverflow: pageRoot ? getComputedStyle(pageRoot).overflowY : null,
        };
        model.valid =
            model.count === 1 &&
            model.page === 0 &&
            model.shell === 0 &&
            model.shellOverflow === 'hidden' &&
            model.mainOverflow === 'hidden' &&
            model.contentOverflow === 'auto' &&
            Boolean(pageRoot) &&
            model.pageRootOverflow === 'visible' &&
            (!model.requiresScroll || model.content > 0);
        return model;
    });
    return { ...model, before, settleError };
}
async function keyboardCheck(page, client) {
    await page.evaluate(() => {
        document.activeElement?.blur();
        document.body.focus();
    });
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
        const element = document.activeElement;
        const style = element ? getComputedStyle(element) : null;
        return {
            tag: element?.tagName,
            text: element?.textContent?.trim().slice(0, 100),
            aria: element?.getAttribute('aria-label'),
            outline: style?.outline,
            boxShadow: style?.boxShadow,
            visible: !!element && element !== document.body && element.getBoundingClientRect().width > 0,
        };
    });
    const target = client
        ? `${CLIENT_BASE}/${new URL(page.url()).pathname.endsWith('/dossier') ? 'geo' : 'dossier'}`
        : new URL(page.url()).pathname === '/offres'
          ? '/methodologie'
          : '/offres';
    const link = page.locator(`a[href="${target}"]`).first();
    if ((await link.count()) && (await link.isVisible())) {
        await link.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL((url) => url.pathname === target, { timeout: 20000 });
        focus.keyboardNavigation = page.url();
    }
    return focus;
}
async function faqCheck(page) {
    const home = await import(pathToFileURL(path.join(ROOT, 'src/features/public/home/home-faqs.js')).href);
    const section = page.locator('#faq');
    await section.scrollIntoViewIfNeeded();
    const read = () =>
        section.evaluate((element) => ({ innerText: element.innerText, textContent: element.textContent }));
    const before = await read();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await read();
    const normalize = (text) => text.replace(/\s+/g, ' ').trim();
    const missing = (text) =>
        home.HOME_FAQS.map(({ question, answer }) => ({
            question,
            questionMissing: !normalize(text).includes(normalize(question)),
            answerMissing: !normalize(text).includes(normalize(answer)),
        })).filter(({ questionMissing, answerMissing }) => questionMissing || answerMissing);
    const afterInnerMissing = missing(after.innerText);
    return {
        count: home.HOME_FAQS.length,
        valid: afterInnerMissing.length === 0,
        before: { ...before, innerMissing: missing(before.innerText), textMissing: missing(before.textContent) },
        after: { ...after, innerMissing: afterInnerMissing, textMissing: missing(after.textContent) },
    };
}
function chartsStable(before, after) {
    return (
        before.length === after.length &&
        after.every((chart, index) => {
            if (chart.container.width === 0 || chart.container.height === 0) return true; // Hidden tab: dimensions recorded, not tested.
            return (
                chart.svg?.width > 0 &&
                chart.svg?.height > 0 &&
                Math.abs(chart.container.width - before[index].container.width) < 2 &&
                Math.abs(chart.container.height - before[index].container.height) < 2
            );
        })
    );
}
async function browserCase(context, test, base, out, mode, logFile) {
    const page = await context.newPage();
    await page.setViewportSize(VIEWS[test.view]);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] });
    await cdp.send('Performance.enable');
    const result = { ...test, errors: [], console: [], requests: [], failures: [] };
    const requests = new Map();
    page.on('pageerror', (error) => result.errors.push(error.message));
    page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
            result.console.push({ type: message.type(), text: message.text() });
    });
    cdp.on('Network.requestWillBeSent', (event) =>
        requests.set(event.requestId, { url: event.request.url, type: event.type, method: event.request.method }),
    );
    cdp.on('Network.responseReceived', (event) => {
        const request = requests.get(event.requestId);
        if (request) Object.assign(request, { status: event.response.status, mime: event.response.mimeType });
    });
    cdp.on('Network.loadingFailed', (event) => {
        const request = requests.get(event.requestId);
        if (request)
            Object.assign(request, { failed: true, reason: event.errorText, blockedReason: event.blockedReason });
    });
    const shellReady =
        mode === 'fixture' && test.route.startsWith(CLIENT_BASE)
            ? page
                  .waitForResponse(
                      (response) => new URL(response.url()).pathname === `/api/admin/geo/client/${CLIENT_ID}`,
                      { timeout: 90000 },
                  )
                  .then((response) => ({ status: response.status(), url: response.url() }))
                  .catch((error) => ({ error: error.message }))
            : null;
    try {
        const response = await page.goto(base + test.route, { waitUntil: 'load', timeout: 90000 });
        result.status = response?.status();
        result.bypass = response?.headers()['x-trouvable-dev-auth-bypass'] || null;
        if (mode === 'production' && result.bypass) result.failures.push('Production exposed the development bypass');
        if (
            mode === 'production' &&
            result.status >= 500 &&
            missingClerkConfiguration(fs.readFileSync(logFile, 'utf8'))
        ) {
            result.classification = 'configuration-unavailable';
            result.dom = await page.evaluate(domSnapshot);
            result.screenshot = `${test.view}-${test.label}-configuration-unavailable.png`;
            await page.screenshot({ path: path.join(out, result.screenshot), fullPage: false });
        } else {
            if (result.status !== 200) result.failures.push(`Expected 200, received ${result.status}`);
            if (test.admin) await page.locator('.geo-content').waitFor({ timeout: 20000 });
            if (test.client) {
                if (shellReady) {
                    result.shellResponse = await shellReady;
                    if (result.shellResponse.error) throw new Error(result.shellResponse.error);
                    if (result.shellResponse.status !== 200)
                        throw new Error(`Client shell returned HTTP ${result.shellResponse.status}`);
                }
                await page
                    .getByText('Fixture locale QA', { exact: false })
                    .first()
                    .waitFor({ state: 'attached', timeout: 90000 });
            }
            if (test.auth && mode === 'fixture') {
                await page.locator('[data-qa-auth-fixture]').waitFor({ timeout: 20000 });
                result.auth = 'anonymous-mock-ui-only';
            }
            await delay(700);
            result.dom = await page.evaluate(domSnapshot);
            if (result.dom.width > result.dom.viewport + 1) result.failures.push('Horizontal page overflow');
            if (test.public) {
                if (
                    !result.dom.title ||
                    !result.dom.description ||
                    !result.dom.canonical ||
                    !result.dom.ogImage ||
                    !result.dom.twitterImage
                )
                    result.failures.push('Public metadata missing');
                if (result.dom.headings.filter((heading) => heading.tag === 'H1').length !== 1)
                    result.failures.push('Expected one public H1');
            }
            if (test.target && new URL(result.dom.url).pathname !== test.target)
                result.failures.push(`Alias did not reach ${test.target}`);
            result.screenshot = `${test.view}-${test.label}.png`;
            await page.screenshot({ path: path.join(out, result.screenshot), fullPage: false });
            if (test.route === '/') {
                result.faq = await faqCheck(page);
                if (!result.faq.valid) result.failures.push('Home FAQ differs from canonical repository answers');
                await page.screenshot({ path: path.join(out, `${test.view}-home-faq.png`), fullPage: false });
            }
            if (test.route.startsWith('/villes/') || test.route.startsWith('/expertises/')) {
                const summary = page.locator('details summary').first();
                await summary.scrollIntoViewIfNeeded();
                await summary.focus();
                await page.keyboard.press('Enter');
                result.faqKeyboard = await summary.evaluate((element) => ({
                    open: element.parentElement.open,
                    answer: element.parentElement.innerText,
                }));
                if (!result.faqKeyboard.open) result.failures.push('FAQ did not open with keyboard Enter');
            }
            if (test.admin) {
                result.scroll = await checkScroll(page);
                if (!result.scroll.valid) result.failures.push('Admin single viewport scroll model failed');
            }
            await delay(500);
            result.chartsAfter = (await page.evaluate(domSnapshot)).charts;
            result.chartsStable = chartsStable(result.dom.charts, result.chartsAfter);
            if (!result.chartsStable) result.failures.push('Visible chart dimensions missing or unstable');
            result.focus = await keyboardCheck(page, test.client);
            if (!result.focus.visible) result.failures.push('Tab did not focus a visible control');
            result.metrics = (await cdp.send('Performance.getMetrics')).metrics.filter(({ name }) =>
                ['JSHeapUsedSize', 'Nodes', 'LayoutCount', 'TaskDuration', 'ScriptDuration'].includes(name),
            );
        }
    } catch (error) {
        result.failures.push(error.message);
        try {
            result.dom = await page.evaluate(domSnapshot);
            await page.screenshot({ path: path.join(out, `${test.view}-${test.label}-failed.png`) });
        } catch {
            /* Navigation may have failed before a document exists. */
        }
    }
    result.requests = [...requests.values()];
    result.asset404s = result.requests.filter(
        (request) =>
            request.status === 404 &&
            request.url.startsWith(base) &&
            (request.type !== 'Document' || /\.[a-z0-9]+(?:\?|$)/i.test(new URL(request.url).pathname)),
    );
    result.hydrationErrors = [...result.errors, ...result.console.map(({ text }) => text)].filter((text) =>
        /hydration|hydrated|server rendered.*match/i.test(text),
    );
    // Keep every warning, including Recharts' initial (-1) warning; dimensions above explain its impact.
    result.chartWarnings = result.console.filter(({ text }) => /width.*-1|height.*-1|recharts/i.test(text));
    if (result.classification !== 'configuration-unavailable') {
        if (result.errors.length) result.failures.push(`${result.errors.length} page errors`);
        if (result.hydrationErrors.length) result.failures.push('Hydration errors');
        if (result.asset404s.length) result.failures.push('Local asset 404s');
    }
    await page.close();
    return result;
}
async function httpChecks(base, mode, logFile, fixture) {
    const results = [];
    const protectedRoutes = [
        '/admin',
        `${CLIENT_BASE}/dossier`,
        '/portal',
        '/portal/fixture-qa',
        '/espace/apres-connexion',
    ];
    if (mode === 'production') {
        for (const route of protectedRoutes) {
            const response = await fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
            const body = await response.text();
            const result = {
                route,
                status: response.status,
                location: response.headers.get('location'),
                bypass: response.headers.has('x-trouvable-dev-auth-bypass'),
            };
            result.classification = classifyAnonymous({
                ...result,
                base,
                configurationMissing: missingClerkConfiguration(body + fs.readFileSync(logFile, 'utf8')),
            });
            results.push(result);
        }
    }
    for (const route of ['/opengraph-image', '/twitter-image', '/ai/faq.json']) {
        const response = await fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(90000) });
        const bytes = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type');
        const result = { route, status: response.status, contentType, bytes: bytes.length };
        if (
            response.status >= 500 &&
            mode === 'production' &&
            missingClerkConfiguration(bytes.toString('utf8') + fs.readFileSync(logFile, 'utf8'))
        )
            result.classification = 'configuration-unavailable';
        else if (route.endsWith('.json')) {
            try {
                const json = JSON.parse(bytes.toString('utf8'));
                const { HOME_FAQS } = await import(
                    pathToFileURL(path.join(ROOT, 'src/features/public/home/home-faqs.js')).href
                );
                result.faqCount = json.faqs?.length;
                result.valid =
                    response.status === 200 &&
                    contentType?.includes('application/json') &&
                    Array.isArray(json.faqs) &&
                    HOME_FAQS.every(({ question, answer }) =>
                        json.faqs.some((faq) => faq.question === question && faq.answer === answer),
                    );
            } catch {
                result.valid = false;
            }
        } else {
            const png =
                bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            result.dimensions = png ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
            result.valid =
                response.status === 200 &&
                contentType?.includes('image/png') &&
                result.dimensions?.width === 1200 &&
                result.dimensions?.height === 630;
        }
        results.push(result);
    }
    if (mode === 'fixture') {
        const response = await fetch(base + '/clients/fixture-qa', {
            redirect: 'manual',
            signal: AbortSignal.timeout(30000),
        });
        results.push({
            route: '/clients/fixture-qa',
            status: response.status,
            ...checkUnpublishedProfile({
                status: response.status,
                body: await response.text(),
                requests: fixture.requests,
            }),
            contract: 'Synthetic unpublished client must not become publicly visible',
        });
    }
    return results;
}

async function runMode(chromium, mode, view, opts, report) {
    const out = path.join(opts.artifacts, mode, view);
    fs.mkdirSync(out, { recursive: true });
    const fixture = mode === 'fixture' ? await startFixture(opts.fixturePort, out) : null;
    let child;
    let browser;
    let logFd;
    let cleanupPromise;
    const cleanup = () =>
        (cleanupPromise ||= (async () => {
            try {
                await browser?.close();
            } finally {
                try {
                    await stopChild(child);
                } finally {
                    if (fixture) {
                        fixture.server.closeAllConnections();
                        await new Promise((resolve) => fixture.server.close(resolve));
                    }
                    if (logFd !== undefined) {
                        fs.closeSync(logFd);
                        logFd = undefined;
                    }
                }
            }
        })());
    const interrupt = () => {
        cleanup().finally(() => process.exit(130));
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const entry = {
        mode,
        view,
        contract:
            mode === 'fixture'
                ? 'Synthetic unpublished Supabase profile; read-only GET/HEAD; existing localhost development auth guard; anonymous mock Clerk UI. No proof of live authentication, membership or RLS.'
                : 'Next start with NODE_ENV=production, no bypass, no fake Clerk client, no service configuration. Missing Clerk configuration is reported as blocked coverage, never as proven authentication.',
        cases: [],
        http: [],
    };
    report.modes.push(entry);
    const save = () => fs.writeFileSync(path.join(opts.artifacts, 'browser-qa.json'), JSON.stringify(report, null, 2));
    try {
        assertNoNextEnvFiles(ROOT);
        const port = await availablePort(opts.port);
        if (port === fixture?.port) throw new Error('App and fixture ports must differ');
        const base = `http://${QA_APP_HOST}:${port}`;
        entry.base = base;
        entry.fixturePort = fixture?.port;
        const logFile = path.join(out, 'next.log');
        logFd = fs.openSync(logFile, 'w');
        const env = safeEnvironment(process.env, {
            mode,
            port,
            fixturePort: fixture?.port,
            artifacts: out,
            guard: GUARD,
            allowFonts: opts.allowFonts,
        });
        child = spawn(
            process.execPath,
            [
                path.join(ROOT, 'node_modules/next/dist/bin/next'),
                mode === 'fixture' ? 'dev' : 'start',
                ...(mode === 'fixture' ? ['--webpack'] : []),
                '--hostname',
                QA_APP_HOST,
                '--port',
                String(port),
            ],
            {
                cwd: ROOT,
                env,
                stdio: ['ignore', logFd, logFd],
                windowsHide: true,
                detached: process.platform !== 'win32',
            },
        );
        let spawnError;
        child.once('error', (error) => {
            spawnError = error;
        });
        await delay(100);
        if (spawnError) throw spawnError;
        await ready(child, logFile, base);
        entry.http = await httpChecks(base, mode, logFile, fixture);
        save();
        browser = await chromium.launch({
            headless: true,
            ...(opts.executable ? { executablePath: opts.executable } : {}),
            env: safeEnvironment(process.env, { mode: 'production', port, artifacts: out, guard: GUARD }),
        });
        const context = await browser.newContext({ locale: 'fr-CA', serviceWorkers: 'block' });
        if (mode === 'fixture') await context.addInitScript(mockClerk);
        const allowed = new Set([base, ...(fixture ? [`http://127.0.0.1:${fixture.port}`] : [])]);
        await context.route('**/*', (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (allowed.has(url.origin) && ['GET', 'HEAD'].includes(request.method())) return route.continue();
            return route.abort('blockedbyclient');
        });
        await context.routeWebSocket('**/*', (socket) => {
            const url = new URL(socket.url());
            if (url.protocol === 'ws:' && url.hostname === QA_APP_HOST && url.port === String(port))
                socket.connectToServer();
            else socket.close({ code: 1008, reason: 'QA blocks external websocket destinations' });
        });
        const cases = [
            ...PUBLIC.map((route) => ({ route, public: true })),
            ...AUTH.map((route) => ({ route, auth: true })),
            ...(mode === 'fixture'
                ? [
                      { route: '/admin', admin: true, client: true },
                      { route: '/admin/clients', admin: true },
                      { route: '/admin/clients/onboarding', admin: true },
                      { route: '/admin/geo-compare', admin: true },
                      ...ADMIN.map((route) => ({
                          route,
                          admin: true,
                          client: true,
                          ...(route === CLIENT_BASE ? { target: `${CLIENT_BASE}/dossier` } : {}),
                      })),
                      ...ALIASES.map((alias) => ({ ...alias, admin: true, client: true })),
                  ]
                : []),
        ];
        for (const [index, test] of cases.entries()) {
            const label = `${index}-${
                test.route
                    .split('?')[0]
                    .replace(/[^a-z0-9]+/gi, '-')
                    .replace(/^-|-$/g, '') || 'home'
            }`;
            console.log(`[QA ${mode}] ${view} ${test.route}`);
            entry.cases.push(await browserCase(context, { ...test, label, view }, base, out, mode, logFile));
            save();
        }
        await context.close();
        entry.fixtureWritesRejected = fixture?.requests.filter(({ method }) => !['GET', 'HEAD'].includes(method)) || [];
    } catch (error) {
        entry.error = error.message;
    } finally {
        await cleanup();
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        save();
    }
}

async function main() {
    const opts = options(process.argv.slice(2));
    if (opts.help) {
        console.log(
            'node scripts/qa/browser.mjs --artifacts <absolute-directory-outside-repo> [--mode all|production|fixture] [--executable <Chrome-path>] [--port 0] [--fixture-port 0] [--allow-fonts]\nRequires existing dependencies and, for production, a secret-free npm run build. Each mode/viewport owns a fresh Next child. Never builds, installs, loads env files, or submits forms. Default ports are free ephemeral ports. --allow-fonts permits only Google Fonts HTTPS for development compilation. Exit: 0 passed, 1 regression/setup failure, 2 configuration-blocked coverage.',
        );
        return;
    }
    assertNoNextEnvFiles(ROOT);
    opts.artifacts = resolveArtifacts(ROOT, opts.artifacts);
    fs.mkdirSync(opts.artifacts, { recursive: true });
    const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright/index.mjs')).href);
    const report = {
        method: 'Fresh local Next child per mode/viewport; browser Playwright/CDP Network and Performance; server fetch/http/DNS/socket guard; only this invocation’s app/fixture ports allowed. All warnings and blocked requests retained. Desktop 1440x900, mobile 390x844. Artifacts include screenshots and per-case CDP evidence.',
        startedAt: new Date().toISOString(),
        modes: [],
    };
    // Release the development compiler between viewports; keep Next memory safeguards active.
    for (const mode of opts.mode === 'all' ? ['production', 'fixture'] : [opts.mode]) {
        for (const view of Object.keys(VIEWS)) await runMode(chromium, mode, view, opts, report);
    }
    const failed = report.modes.some(
        (entry) =>
            entry.error ||
            entry.cases.some((test) => test.failures.length) ||
            entry.http.some((test) => test.classification?.startsWith('failed-') || test.valid === false),
    );
    const blocked = report.modes.some((entry) =>
        [...entry.cases, ...entry.http].some((test) => test.classification === 'configuration-unavailable'),
    );
    process.exitCode = failed ? 1 : blocked ? 2 : 0;
    report.finishedAt = new Date().toISOString();
    report.exitCode = process.exitCode;
    fs.writeFileSync(path.join(opts.artifacts, 'browser-qa.json'), JSON.stringify(report, null, 2));
    console.log(
        `QA artifacts: ${opts.artifacts}; exit ${process.exitCode}. Fixture screenshots do not establish real Clerk authentication or Supabase RLS.`,
    );
}
main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
