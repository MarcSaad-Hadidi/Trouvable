import 'server-only';

import crypto from 'crypto';

/**
 * Web-search-based community discovery collector.
 *
 * This module provides a fallback collection path for Veille sociale when
 * direct Reddit .json endpoints are blocked (HTTP 403). Instead of scraping
 * Reddit directly, it uses authenticated web search APIs (Tavily, Google CSE)
 * to discover community discussions, reviews, and forum threads about a
 * business — from Reddit and other community sources.
 *
 * Design:
 * - Uses the same seed queries as the Reddit collector
 * - Appends "site:reddit.com" to prioritize Reddit results where available
 * - Falls back to broader community results (forums, review sites, Q&A)
 * - Normalizes results into the same document format as Reddit posts
 * - Preserves all downstream pipeline stages (mentions, clusters, opportunities)
 *
 * Requires at least one of:
 * - TAVILY_API_KEY
 * - GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID
 */

const WEB_SEARCH_TIMEOUT_MS = 10000;
const WEB_SEARCH_MAX_RESULTS_PER_QUERY = 8;
const WEB_SEARCH_REQUEST_DELAY_MS = 500;

// Community source domains to prioritize in web search queries
const COMMUNITY_SOURCE_DOMAINS = [
    'reddit.com', 'quora.com', 'trustpilot.com', 'avis-verifies.com',
    'glassdoor.com', 'indeed.com', 'facebook.com', 'lesjeudis.com',
];

// ──────────────────────────────────────────────────────────────
// Provider: Tavily
// ──────────────────────────────────────────────────────────────

async function searchWithTavily({ query, maxResults = WEB_SEARCH_MAX_RESULTS_PER_QUERY, timeoutMs = WEB_SEARCH_TIMEOUT_MS }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                api_key: apiKey,
                query,
                max_results: Math.min(10, Math.max(1, maxResults)),
                search_depth: 'basic',
                include_domains: COMMUNITY_SOURCE_DOMAINS,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Tavily HTTP ${response.status}: ${body.slice(0, 200)}`);
        }
        const json = await response.json();
        return {
            provider: 'tavily',
            results: (json.results || []).map((item) => ({
                title: String(item.title || '').trim(),
                url: String(item.url || '').trim(),
                snippet: String(item.content || '').trim(),
                published_date: item.published_date || null,
                score: item.score || null,
            })),
        };
    } finally {
        clearTimeout(timer);
    }
}

// ──────────────────────────────────────────────────────────────
// Provider: Google CSE
// ──────────────────────────────────────────────────────────────

async function searchWithGoogleCse({ query, maxResults = WEB_SEARCH_MAX_RESULTS_PER_QUERY, timeoutMs = WEB_SEARCH_TIMEOUT_MS }) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    if (!apiKey || !engineId) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('key', apiKey);
        url.searchParams.set('cx', engineId);
        url.searchParams.set('q', query);
        url.searchParams.set('num', String(Math.min(10, Math.max(1, maxResults))));

        const response = await fetch(url.toString(), {
            method: 'GET',
            signal: controller.signal,
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Google CSE HTTP ${response.status}: ${body.slice(0, 200)}`);
        }
        const json = await response.json();
        return {
            provider: 'google_cse',
            results: (json.items || []).map((item) => ({
                title: String(item.title || '').trim(),
                url: String(item.link || '').trim(),
                snippet: String(item.snippet || '').trim(),
                published_date: null,
                score: null,
            })),
        };
    } finally {
        clearTimeout(timer);
    }
}

// ──────────────────────────────────────────────────────────────
// Unified search — try Tavily first, then Google CSE
//
// Returns a structured result that always distinguishes:
//   - provider succeeded with results → { provider, results: [...], providerError: null }
//   - provider succeeded with 0 results → { provider, results: [], providerError: null }
//   - no provider configured → null (caller should check isWebSearchAvailable)
//   - all providers failed → { provider: null, results: [], providerError: "..." }
// ──────────────────────────────────────────────────────────────

async function searchWeb({ query, maxResults = WEB_SEARCH_MAX_RESULTS_PER_QUERY }) {
    let lastProviderError = null;

    // Try Tavily first (better for community/discussion discovery)
    const tavilyConfigured = !!process.env.TAVILY_API_KEY;
    if (tavilyConfigured) {
        try {
            const tavily = await searchWithTavily({ query, maxResults });
            if (tavily) {
                // Provider call succeeded — return even if 0 results
                return { ...tavily, providerError: null };
            }
        } catch (err) {
            lastProviderError = err?.message || 'Tavily unknown error';
            console.warn('[Community/WebSearch] Tavily search failed:', lastProviderError);
        }
    }

    // Fall back to Google CSE
    const googleConfigured = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
    if (googleConfigured) {
        try {
            const google = await searchWithGoogleCse({ query, maxResults });
            if (google) {
                // Provider call succeeded — return even if 0 results
                return { ...google, providerError: null };
            }
        } catch (err) {
            lastProviderError = err?.message || 'Google CSE unknown error';
            console.warn('[Community/WebSearch] Google CSE search failed:', lastProviderError);
        }
    }

    // No provider was configured at all
    if (!tavilyConfigured && !googleConfigured) {
        return null;
    }

    // At least one provider was configured but all failed
    return { provider: null, results: [], providerError: lastProviderError };
}

// ──────────────────────────────────────────────────────────────
// Availability check
// ──────────────────────────────────────────────────────────────

/**
 * Returns true if at least one web search provider is configured.
 */
export function isWebSearchAvailable() {
    return !!(
        process.env.TAVILY_API_KEY
        || (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID)
    );
}

// ──────────────────────────────────────────────────────────────
// Source detection from URLs
// ──────────────────────────────────────────────────────────────

function detectSourceFromUrl(url) {
    if (!url) return 'web';
    try {
        const parsedHost = new URL(url).hostname.toLowerCase();
        if (parsedHost === 'reddit.com' || parsedHost.endsWith('.reddit.com')) return 'reddit';
        if (parsedHost === 'quora.com' || parsedHost.endsWith('.quora.com')) return 'quora';
        if (parsedHost === 'trustpilot.com' || parsedHost.endsWith('.trustpilot.com')) return 'trustpilot';
        if (parsedHost === 'facebook.com' || parsedHost.endsWith('.facebook.com')) return 'facebook';
        if (parsedHost === 'glassdoor.com' || parsedHost.endsWith('.glassdoor.com')) return 'glassdoor';
        if (parsedHost === 'indeed.com' || parsedHost.endsWith('.indeed.com')) return 'indeed';
        if (parsedHost === 'avis-verifies.com' || parsedHost.endsWith('.avis-verifies.com')) return 'avis_verifies';
    } catch {
        // Invalid URL — fall through to default
    }
    return 'web';
}

/**
 * Extract a pseudo-subreddit name from a Reddit URL.
 * e.g. "https://www.reddit.com/r/montreal/comments/..." → "montreal"
 */
function extractSubredditFromUrl(url) {
    if (!url) return null;
    const match = url.match(/reddit\.com\/r\/([^/]+)/i);
    return match ? match[1] : null;
}

// ──────────────────────────────────────────────────────────────
// Main collector — web-search-based community discovery
// ──────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Collect community discussions via web search APIs.
 * Uses the same seed queries as Reddit collection, but discovers threads
 * via Tavily/Google CSE instead of hitting Reddit directly.
 *
 * @param {Array<{query: string, strategy: string}>} seedQueries - Seed queries from buildSeedQueries()
 * @returns {{ posts: Array, seedDiagnostics: Array, provider: string }}
 */
export async function collectViaWebSearch(seedQueries) {
    if (!isWebSearchAvailable()) {
        return {
            posts: [],
            seedDiagnostics: seedQueries.map((seed) => ({
                seed: typeof seed === 'string' ? seed : seed.query,
                strategy: typeof seed === 'string' ? 'legacy' : (seed.strategy || 'unknown'),
                subreddit: null,
                results: 0,
                status: 'error',
                detail: 'No web search provider configured (need TAVILY_API_KEY or GOOGLE_SEARCH_API_KEY)',
                http_status: null,
                failure_class: 'source_auth_required',
            })),
            provider: null,
        };
    }

    const seedDiagnostics = [];
    const allResults = [];
    let usedProvider = null;

    for (let i = 0; i < seedQueries.length; i++) {
        const seed = seedQueries[i];
        const query = typeof seed === 'string' ? seed : seed.query;
        const strategy = typeof seed === 'string' ? 'legacy' : (seed.strategy || 'unknown');

        // Append community-focused terms to improve discovery
        const searchQuery = `${query} site:reddit.com OR site:quora.com OR forum OR avis OR discussion`;

        try {
            const result = await searchWeb({ query: searchQuery });
            if (result && result.providerError) {
                // Provider was configured but the call failed — record as error
                seedDiagnostics.push({
                    seed: query,
                    strategy,
                    subreddit: null,
                    results: 0,
                    status: 'error',
                    detail: `Web search provider failed: ${result.providerError}`,
                    http_status: null,
                    failure_class: 'temporary_network_failure',
                });
            } else if (result && result.results.length > 0) {
                if (!usedProvider) usedProvider = result.provider;
                const posts = result.results
                    .filter((item) => item.url && item.title)
                    .map((item) => ({
                        id: null, // Will be generated from dedupe hash
                        title: item.title,
                        body: item.snippet || '',
                        subreddit: extractSubredditFromUrl(item.url) || null,
                        ups: 0,
                        created_at: item.published_date || null,
                        permalink: item.url,
                        seed_query: query,
                        _source_platform: detectSourceFromUrl(item.url),
                        _search_score: item.score || null,
                    }));
                seedDiagnostics.push({ seed: query, strategy, subreddit: null, results: posts.length, status: 'ok' });
                allResults.push(...posts);
            } else if (result && !result.providerError) {
                // Provider call succeeded genuinely but returned 0 results
                if (!usedProvider && result.provider) usedProvider = result.provider;
                seedDiagnostics.push({ seed: query, strategy, subreddit: null, results: 0, status: 'ok' });
            } else {
                // searchWeb returned null — no provider configured (shouldn't happen since
                // we check isWebSearchAvailable up front, but handle defensively)
                seedDiagnostics.push({
                    seed: query,
                    strategy,
                    subreddit: null,
                    results: 0,
                    status: 'error',
                    detail: 'No web search provider available',
                    http_status: null,
                    failure_class: 'source_auth_required',
                });
            }
        } catch (err) {
            seedDiagnostics.push({
                seed: query,
                strategy,
                subreddit: null,
                results: 0,
                status: 'error',
                detail: err?.message || 'unknown',
                http_status: null,
                failure_class: 'temporary_network_failure',
            });
        }

        // Small delay between requests to respect API rate limits
        if (i < seedQueries.length - 1) {
            await sleep(WEB_SEARCH_REQUEST_DELAY_MS);
        }
    }

    // Dedupe by URL (web search may return the same page for different queries).
    // Fallback: use a content hash when URL is missing (unlikely for web search results).
    const dedupe = new Map();
    for (const post of allResults) {
        const key = post.permalink
            || crypto.createHash('sha256').update(`${post.title}:${post.body || ''}`).digest('hex').slice(0, 32);
        if (!dedupe.has(key)) {
            dedupe.set(key, post);
        }
    }

    return {
        posts: [...dedupe.values()],
        seedDiagnostics,
        provider: usedProvider,
    };
}
