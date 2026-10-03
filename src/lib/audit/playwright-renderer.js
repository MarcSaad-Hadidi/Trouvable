import 'server-only';

const DEFAULT_RENDER_TIMEOUT_MS = 16000;
const DEFAULT_NETWORK_IDLE_WAIT_MS = 3200;
const DEFAULT_SETTLE_WAIT_MS = 450;

function getRendererUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko, TrouvableAuditBot/3.0 Rendered)';
}

function detectHydrationHints(html = '') {
    const hints = [];
    if (!html) return hints;
    if (html.includes('__NEXT_DATA__')) hints.push('next_data');
    if (html.includes('data-reactroot')) hints.push('react_root');
    if (html.includes('id="__nuxt"')) hints.push('nuxt_root');
    if (html.includes('id="root"')) hints.push('root_shell');
    if (html.includes('data-hydration')) hints.push('hydration_marker');
    return [...new Set(hints)];
}

function countWords(text = '') {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return 0;
    return normalized.split(' ').length;
}

function getHeadlessFlag() {
    return process.env.AUDIT_PLAYWRIGHT_HEADLESS === '0' ? false : true;
}

async function loadChromiumModule() {
    try {
        return await import('playwright-core');
    } catch {
        return import('playwright');
    }
}

/**
 * Connect to a remote browser via CDP WebSocket.
 * Compatible with Browserless BaaS V2 and any provider exposing a CDP WS endpoint.
 *
 * Set AUDIT_BROWSER_WS_ENDPOINT to a wss:// or ws:// URL (configured in Vercel env vars).
 * The token/secret must be part of the URL or query string — never hardcode it in source.
 */
async function connectRemoteBrowser(chromium) {
    const wsEndpoint = String(process.env.AUDIT_BROWSER_WS_ENDPOINT || '').trim();
    if (!wsEndpoint) return null;

    if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
        return {
            browser: null,
            reason: 'remote_browser_malformed',
            error: 'AUDIT_BROWSER_WS_ENDPOINT must start with ws:// or wss://',
        };
    }

    try {
        const browser = await chromium.connect(wsEndpoint, { timeout: 10_000 });
        return {
            browser,
            reason: 'remote_browser',
        };
    } catch (error) {
        // Sanitize: strip the endpoint URL and its query params from error messages to prevent secret leakage
        const rawMessage = error?.message || 'unknown error';
        let safeMessage = rawMessage.replaceAll(wsEndpoint, '<AUDIT_BROWSER_WS_ENDPOINT>');
        try {
            const parsed = new URL(wsEndpoint);
            if (parsed.search) {
                safeMessage = safeMessage.replaceAll(parsed.search, '');
            }
        } catch { /* ignore URL parse errors */ }
        return {
            browser: null,
            reason: 'remote_browser_failed',
            error: `Remote browser configured but connection failed: ${safeMessage}`,
        };
    }
}

async function launchServerlessChromium(chromium) {
    try {
        const chromiumBinary = await import('@sparticuz/chromium');
        const executablePath = await chromiumBinary.default.executablePath();
        const browser = await chromium.launch({
            executablePath,
            headless: true,
            args: chromiumBinary.default.args,
        });

        return {
            browser,
            reason: 'serverless_chromium',
        };
    } catch (error) {
        // Preserve the actual failure reason instead of silently returning null
        return {
            browser: null,
            reason: 'serverless_chromium_failed',
            error: error?.message || 'Unknown @sparticuz/chromium failure',
        };
    }
}

function isLocalBrowserAllowed() {
    return process.env.AUDIT_ALLOW_LOCAL_BROWSER === '1';
}

async function launchLocalBrowser(chromium) {
    if (!isLocalBrowserAllowed()) {
        return {
            browser: null,
            reason: 'local_chromium_disallowed',
            error: 'Local browser fallback is not allowed in this environment. Set AUDIT_ALLOW_LOCAL_BROWSER=1 to enable.',
        };
    }

    try {
        const browser = await chromium.launch({
            headless: getHeadlessFlag(),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        return {
            browser,
            reason: 'local_chromium',
        };
    } catch (error) {
        return {
            browser: null,
            reason: 'local_chromium_failed',
            error: error?.message || 'Local browser launch failed',
        };
    }
}

export async function createPlaywrightRenderer() {
    if (process.env.AUDIT_DISABLE_PLAYWRIGHT === '1') {
        return {
            available: false,
            reason: 'disabled_by_config',
            async render() {
                return { ok: false, error: 'Playwright rendering disabled by config. Falling back.' };
            },
            async close() { },
        };
    }

    try {
        const { chromium } = await loadChromiumModule();
        const remoteConnection = await connectRemoteBrowser(chromium);
        const serverlessConnection = remoteConnection ? null : await launchServerlessChromium(chromium);
        const localConnection = (remoteConnection || serverlessConnection?.browser) ? null : await launchLocalBrowser(chromium);

        const connection = [remoteConnection, serverlessConnection, localConnection].find((c) => c?.browser);
        if (!connection?.browser) {
            // Build a truthful failure chain from all attempted strategies
            const failureReasons = [
                remoteConnection?.error
                    ? `remote: ${remoteConnection.error}`
                    : remoteConnection === null
                        ? 'remote: no AUDIT_BROWSER_WS_ENDPOINT configured'
                        : null,
                serverlessConnection?.error ? `serverless: ${serverlessConnection.error}` : null,
                localConnection?.error ? `local: ${localConnection.error}` : null,
            ].filter(Boolean);

            throw new Error(
                `No browser strategy succeeded. ${failureReasons.join(' | ')}`
            );
        }

        const browser = connection.browser;
        const context = await browser.newContext({
            userAgent: getRendererUserAgent(),
            ignoreHTTPSErrors: true,
        });

        return {
            available: true,
            reason: connection.reason,
            async render(url) {
                const page = await context.newPage();
                try {
                    const timeoutMs = Number(process.env.AUDIT_PLAYWRIGHT_TIMEOUT_MS || DEFAULT_RENDER_TIMEOUT_MS);
                    const response = await page.goto(url, {
                        timeout: timeoutMs,
                        waitUntil: 'domcontentloaded',
                    });

                    await Promise.race([
                        page.waitForLoadState('networkidle', { timeout: DEFAULT_NETWORK_IDLE_WAIT_MS }),
                        page.waitForTimeout(DEFAULT_NETWORK_IDLE_WAIT_MS),
                    ]).catch(() => null);

                    await page.waitForTimeout(DEFAULT_SETTLE_WAIT_MS);

                    const finalUrl = page.url();
                    const html = await page.content();
                    const title = await page.title().catch(() => '');
                    const bodyText = await page.locator('body').innerText().catch(() => '');
                    const visibleWordCount = countWords(bodyText);
                    const hydrationHints = detectHydrationHints(html);
                    const appShellLikely = visibleWordCount < 120 && hydrationHints.length > 0;

                    return {
                        ok: true,
                        url,
                        finalUrl,
                        statusCode: response?.status() || null,
                        title: title || null,
                        html,
                        visibleWordCount,
                        hydrationHints,
                        appShellLikely,
                    };
                } catch (error) {
                    return {
                        ok: false,
                        url,
                        error: error?.message || 'Playwright render failed',
                    };
                } finally {
                    await page.close().catch(() => { });
                }
            },
            async close() {
                await context.close().catch(() => { });
                await browser.close().catch(() => { });
            },
        };
    } catch (error) {
        return {
            available: false,
            reason: error?.message || 'playwright_unavailable',
            async render() {
                return { ok: false, error: 'Playwright unavailable' };
            },
            async close() { },
        };
    }
}
