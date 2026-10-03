import 'server-only';

import { LlmComparisonError, SOURCE_TYPES } from './response-contract';

const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_CONTENT_CHARS = 16_000;
const DEFAULT_PREVIEW_CHARS = 280;

let cheerioModulePromise = null;

function normalizeText(input = '') {
    return String(input || '')
        .replace(/\u0000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text = '', maxChars = DEFAULT_MAX_CONTENT_CHARS) {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

async function fetchWithTimeout(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Trouvable-Admin-LlmCompare/1.0',
                Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.7',
            },
            signal: controller.signal,
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new LlmComparisonError('timeout', `Extraction URL timeout apres ${timeoutMs}ms`);
        }
        throw new LlmComparisonError('extraction_error', `Erreur réseau lors de l'extraction : ${error?.message || 'Erreur inconnue (redirection infinie, etc.)'}`);
    } finally {
        clearTimeout(timer);
    }
}

async function getCheerio() {
    if (!cheerioModulePromise) {
        cheerioModulePromise = import('cheerio');
    }
    return cheerioModulePromise;
}

async function extractTextFromHtml(html) {
    const cheerio = await getCheerio();
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, svg, nav, footer, header, form').remove();
    const title = normalizeText($('title').first().text());
    const bodyText = normalizeText($('body').text() || $.root().text());
    return normalizeText(`${title ? `${title}. ` : ''}${bodyText}`);
}

export async function extractInputContent({
    url = null,
    text = null,
    sourceType = null,
    maxContentChars = DEFAULT_MAX_CONTENT_CHARS,
    previewChars = DEFAULT_PREVIEW_CHARS,
    fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
}) {
    const hasUrl = Boolean(String(url || '').trim());
    const hasText = Boolean(String(text || '').trim());
    const resolvedType = sourceType || (hasUrl ? SOURCE_TYPES.URL : SOURCE_TYPES.TEXT);

    if (!hasUrl && !hasText) {
        throw new LlmComparisonError('input_error', 'Vous devez fournir `url` ou `text`.');
    }

    if (resolvedType === SOURCE_TYPES.URL) {
        if (!hasUrl) {
            throw new LlmComparisonError('input_error', 'Le champ `url` est requis pour `source_type=url`.');
        }
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            throw new LlmComparisonError('input_error', 'URL invalide.');
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new LlmComparisonError('input_error', 'Seuls les protocoles http/https sont supportes.');
        }

        let response;
        let fetchFailed = false;
        let fetchErrorMsg = '';

        try {
            response = await fetchWithTimeout(parsedUrl.toString(), fetchTimeoutMs);
            if (!response.ok) {
                fetchFailed = true;
                fetchErrorMsg = `HTTP ${response.status}`;
            }
        } catch (fetchErr) {
            fetchFailed = true;
            fetchErrorMsg = fetchErr.message || 'Erreur réseau';
        }

        let extracted = '';
        if (!fetchFailed && response) {
            const contentType = String(response.headers.get('content-type') || '').toLowerCase();
            const body = await response.text();
            extracted = contentType.includes('html') ? await extractTextFromHtml(body) : normalizeText(body);
        } else {
            console.warn(`[extractInputContent] Fetch failed (${fetchErrorMsg}), falling back to Playwright for ${parsedUrl.toString()}`);
            const { createPlaywrightRenderer } = await import('../audit/playwright-renderer.js');
            const renderer = await createPlaywrightRenderer();
            try {
                if (renderer.available) {
                    const result = await renderer.render(parsedUrl.toString());
                    if (result.ok && result.html) {
                        extracted = await extractTextFromHtml(result.html);
                    } else {
                        throw new LlmComparisonError('extraction_error', `Impossible de récupérer l'URL (Playwright: ${result.error}).`);
                    }
                } else {
                    throw new LlmComparisonError('extraction_error', `Impossible de récupérer l'URL (fetch error: ${fetchErrorMsg}) et Playwright désactivé.`);
                }
            } finally {
                await renderer.close().catch(() => {});
            }
        }

        const normalized = truncate(extracted, maxContentChars);
        if (!normalized) {
            throw new LlmComparisonError('extraction_error', 'Aucun contenu exploitable extrait depuis l URL.');
        }

        return {
            source_type: SOURCE_TYPES.URL,
            url: parsedUrl.toString(),
            content: normalized,
            content_preview: normalized.slice(0, previewChars),
        };
    }

    const normalizedText = truncate(normalizeText(text), maxContentChars);
    if (!normalizedText) {
        throw new LlmComparisonError('input_error', 'Le champ `text` est vide apres normalisation.');
    }

    return {
        source_type: SOURCE_TYPES.TEXT,
        url: null,
        content: normalizedText,
        content_preview: normalizedText.slice(0, previewChars),
    };
}
