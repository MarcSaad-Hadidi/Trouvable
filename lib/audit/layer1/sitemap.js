/**
 * Layer 1 sitemap-first URL discovery.
 *
 * Tries, in order: robots.txt `Sitemap:` directives, then common sitemap paths.
 * Parses both sitemap index and urlset documents. Results are normalized and
 * same-origin filtered by the caller.
 */

import { normalizeUrl, sameOrigin, isLikelyHtmlUrl, originFor } from './url-utils.js';
import { fetchPublicResource } from '../url-safety.js';

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_SITEMAP_DOCS = 4;
const MAX_URLS_FROM_SITEMAP = 200;

function trouvableUserAgent() {
    return 'Mozilla/5.0 (TrouvableAuditBot/3.0; +https://trouvable.com/audit)';
}

async function fetchTextWithTimeout(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
    try {
        const response = await fetchPublicResource(url, {
            timeoutMs,
            headers: {
                'User-Agent': trouvableUserAgent(),
                Accept: 'application/xml, text/xml, text/plain, */*',
            },
        });
        if (!response.ok) {
            return { ok: false, status: response.status, body: '' };
        }
        const body = await response.text();
        return { ok: true, status: response.status, body };
    } catch (error) {
        return { ok: false, status: 0, body: '', error: error?.message || 'fetch_failed' };
    }
}

function parseSitemapsFromRobots(robotsText) {
    if (!robotsText) return [];
    const sitemaps = [];
    for (const rawLine of robotsText.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^sitemap\s*:\s*(.+)$/i);
        if (match?.[1]) {
            sitemaps.push(match[1].trim());
        }
    }
    return sitemaps;
}

/**
 * Pure XML extraction — tolerant of malformed sitemap docs. Returns
 * `{ sitemap_urls, page_urls }` where sitemap_urls are child sitemap indices.
 */
function parseSitemapXml(xmlText) {
    const sitemapUrls = [];
    const pageUrls = [];
    if (!xmlText || typeof xmlText !== 'string') return { sitemapUrls, pageUrls };

    const sitemapRegex = /<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi;
    const urlRegex = /<url>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/url>/gi;

    let match;
    while ((match = sitemapRegex.exec(xmlText)) !== null) {
        if (match[1]) sitemapUrls.push(match[1].trim());
    }
    while ((match = urlRegex.exec(xmlText)) !== null) {
        if (match[1]) pageUrls.push(match[1].trim());
    }

    if (sitemapUrls.length === 0 && pageUrls.length === 0) {
        const looseLocRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
        while ((match = looseLocRegex.exec(xmlText)) !== null) {
            if (match[1]) pageUrls.push(match[1].trim());
        }
    }

    return { sitemapUrls, pageUrls };
}

async function expandSitemap(sitemapUrl, visited, depth = 0) {
    if (depth > 2) return [];
    if (visited.size >= MAX_SITEMAP_DOCS) return [];
    if (visited.has(sitemapUrl)) return [];
    visited.add(sitemapUrl);

    const response = await fetchTextWithTimeout(sitemapUrl);
    if (!response.ok) return [];

    const { sitemapUrls, pageUrls } = parseSitemapXml(response.body);
    const discovered = [...pageUrls];

    for (const child of sitemapUrls) {
        if (visited.size >= MAX_SITEMAP_DOCS) break;
        const childPages = await expandSitemap(child, visited, depth + 1);
        discovered.push(...childPages);
        if (discovered.length >= MAX_URLS_FROM_SITEMAP) break;
    }

    return discovered;
}

/**
 * Discover a list of same-origin HTML URLs via sitemap-first strategy.
 *
 * @param {string} startUrl — any URL on the target origin.
 * @returns {Promise<{
 *   strategy: 'sitemap' | 'robots_sitemap' | 'none',
 *   sitemap_sources: string[],
 *   discovered_urls: string[],
 *   robots_present: boolean,
 *   errors: string[]
 * }>}
 */
export async function discoverSitemapUrls(startUrl) {
    const origin = originFor(startUrl);
    const result = {
        strategy: 'none',
        sitemap_sources: [],
        discovered_urls: [],
        robots_present: false,
        errors: [],
    };
    if (!origin) return result;

    const robotsResponse = await fetchTextWithTimeout(`${origin}/robots.txt`);
    let robotsSitemaps = [];
    if (robotsResponse.ok) {
        result.robots_present = true;
        robotsSitemaps = parseSitemapsFromRobots(robotsResponse.body);
    }

    const candidateSitemaps = [
        ...robotsSitemaps,
        `${origin}/sitemap.xml`,
        `${origin}/sitemap_index.xml`,
        `${origin}/sitemap-index.xml`,
        `${origin}/sitemap.xml.gz`,
    ];

    const visitedSitemaps = new Set();
    const aggregated = [];
    for (const candidate of candidateSitemaps) {
        if (visitedSitemaps.size >= MAX_SITEMAP_DOCS) break;
        const urls = await expandSitemap(candidate, visitedSitemaps);
        if (urls.length > 0) {
            result.sitemap_sources.push(candidate);
            aggregated.push(...urls);
        }
        if (aggregated.length >= MAX_URLS_FROM_SITEMAP) break;
    }

    const normalized = [];
    const seen = new Set();
    for (const raw of aggregated) {
        const normalizedUrl = normalizeUrl(raw);
        if (!normalizedUrl) continue;
        if (!sameOrigin(normalizedUrl, startUrl)) continue;
        if (!isLikelyHtmlUrl(normalizedUrl)) continue;
        if (seen.has(normalizedUrl)) continue;
        seen.add(normalizedUrl);
        normalized.push(normalizedUrl);
        if (normalized.length >= MAX_URLS_FROM_SITEMAP) break;
    }

    if (normalized.length > 0) {
        result.strategy = robotsSitemaps.length > 0 ? 'robots_sitemap' : 'sitemap';
    }
    result.discovered_urls = normalized;
    return result;
}
