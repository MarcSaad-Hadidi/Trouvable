import { hasBlockedNavigationScheme } from '../url-hosts.js';

/**
 * Layer 1 URL utilities — canonical normalization, HTML filtering, and
 * same-origin link extraction. Ported from the geodaddy-cli `crawling.rs`
 * discipline so crawl membership is deterministic and deduplicated.
 *
 * Pure functions only; no I/O.
 */

const HTML_EXTENSION_RE = /\.(html?|php|aspx?|cfm|jsp)$/i;
const NON_HTML_EXTENSION_RE = /\.(pdf|zip|rar|7z|tar|gz|bz2|xz|exe|dmg|pkg|mp3|mp4|m4a|m4v|mov|avi|wmv|mkv|webm|wav|flac|ogg|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|heic|json|xml|rss|atom|csv|tsv|txt|woff2?|ttf|otf|eot|css|js|map)$/i;

/**
 * Canonical URL normalization used by the scan queue to dedupe URLs.
 * Rules:
 *  - drop fragment
 *  - normalize scheme + host to lowercase
 *  - strip trailing slash except for root
 *  - drop default ports (80/443)
 *  - keep query string but normalize empty query
 */
export function normalizeUrl(input, baseHref = null) {
    if (!input || typeof input !== 'string') return null;
    let href;
    try {
        href = baseHref ? new URL(input, baseHref).href : new URL(input).href;
    } catch {
        return null;
    }

    let parsed;
    try {
        parsed = new URL(href);
    } catch {
        return null;
    }

    if (!/^https?:$/.test(parsed.protocol)) return null;

    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
        parsed.port = '';
    }
    if (parsed.search === '?') parsed.search = '';

    let result = parsed.toString();
    if (parsed.pathname !== '/' && result.endsWith('/')) {
        result = result.slice(0, -1);
    }
    return result;
}

/**
 * Returns true for URLs that are very likely to serve HTML (or at least a
 * navigable page) so the crawler skips binaries and media. Mirrors geodaddy's
 * `is_html_url` discipline.
 */
export function isLikelyHtmlUrl(url) {
    if (!url) return false;
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    const path = parsed.pathname.toLowerCase();
    if (NON_HTML_EXTENSION_RE.test(path)) return false;
    if (HTML_EXTENSION_RE.test(path)) return true;
    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    if (lastSegment.includes('.') && !HTML_EXTENSION_RE.test(lastSegment)) return false;
    return true;
}

export function sameOrigin(aUrl, bUrl) {
    try {
        const a = new URL(aUrl);
        const b = new URL(bUrl);
        return a.hostname.toLowerCase() === b.hostname.toLowerCase();
    } catch {
        return false;
    }
}

/**
 * Extract same-origin HTML links from a cheerio document, normalized and
 * deduped. Returns entries of `{ normalized_url, anchor_text }` so Layer 1 can
 * score priority based on anchor context.
 */
export function extractSameOriginLinks($, baseHref) {
    if (!$ || !baseHref) return [];
    const seen = new Set();
    const results = [];
    $('a[href]').each((_, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref) return;
        const trimmed = rawHref.trim();
        if (!trimmed || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || hasBlockedNavigationScheme(trimmed)) return;
        const normalized = normalizeUrl(trimmed, baseHref);
        if (!normalized) return;
        if (!sameOrigin(normalized, baseHref)) return;
        if (!isLikelyHtmlUrl(normalized)) return;
        if (seen.has(normalized)) return;
        seen.add(normalized);
        const anchorText = ($(el).text() || '').replace(/\s+/g, ' ').trim().slice(0, 180);
        results.push({ normalized_url: normalized, anchor_text: anchorText });
    });
    return results;
}

export function originFor(url) {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

export function pathOnly(url) {
    try {
        const u = new URL(url);
        return (u.pathname || '/') + (u.search || '');
    } catch {
        return '/';
    }
}
