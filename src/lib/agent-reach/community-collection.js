import 'server-only';
import { collectViaWebSearch, isWebSearchAvailable } from './web-search-collector';

// ──────────────────────────────────────────────────────────────
// Reddit collector constants
// ──────────────────────────────────────────────────────────────

const REDDIT_SEARCH_ENDPOINT = 'https://www.reddit.com/search.json';

const REDDIT_SUBREDDIT_SEARCH_ENDPOINT = 'https://www.reddit.com/r/{subreddit}/search.json';

const REDDIT_TIMEOUT_MS = 12000;

const MAX_POSTS_PER_QUERY = 20;

const REDDIT_REQUEST_DELAY_MS = 1500;

const REDDIT_MAX_RETRIES = 2;

const REDDIT_RETRY_BASE_MS = 2000;

// Browser-like User-Agents to avoid 403 from Reddit anti-bot detection.
// Reddit's .json endpoints increasingly reject non-browser UAs.
const BROWSER_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

// ──────────────────────────────────────────────────────────────
// Failure classification constants
// ──────────────────────────────────────────────────────────────

/**
 * Failure classes for collection diagnostics.
 * These allow the pipeline to distinguish "we found nothing" from
 * "we could not access the source".
 */
export const COLLECTION_FAILURE_CLASS = {
    SOURCE_ACCESS_FAILURE: 'source_access_failure',
    SOURCE_RATE_LIMITED: 'source_rate_limited',
    SOURCE_AUTH_REQUIRED: 'source_auth_required',
    SEED_QUALITY_FAILURE: 'seed_quality_failure',
    TEMPORARY_NETWORK_FAILURE: 'temporary_network_failure',
    NO_SIGNAL_FOUND: 'no_signal_found',
    UNKNOWN_COLLECTION_FAILURE: 'unknown_collection_failure',
};

// ──────────────────────────────────────────────────────────────
// Stage 2 — Collect (Reddit)
// ──────────────────────────────────────────────────────────────

/**
 * Classifies an HTTP error status into a failure class.
 */
function classifyHttpError(status) {
    if (status === 403) return COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE;
    if (status === 401) return COLLECTION_FAILURE_CLASS.SOURCE_AUTH_REQUIRED;
    if (status === 429) return COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED;
    if (status >= 500) return COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE;
    return COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE;
}

/**
 * Classifies a non-HTTP error (timeout, network failure) into a failure class.
 */
function classifyNetworkError(err) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('abort') || msg.includes('timeout')) {
        return COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE;
    }
    if (msg.includes('enotfound') || msg.includes('econnrefused') || msg.includes('econnreset')) {
        return COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE;
    }
    return COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE;
}

function pickUserAgent() {
    return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REDDIT_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': pickUserAgent(),
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}`);
            err.httpStatus = response.status;
            throw err;
        }
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Fetch with retry and exponential backoff.
 * Retries on 429 (rate-limited) and 5xx (temporary server failures).
 * Does NOT retry on 403 (access blocked) — retrying won't help.
 */
async function fetchJsonWithRetry(url) {
    let lastError;
    for (let attempt = 0; attempt <= REDDIT_MAX_RETRIES; attempt++) {
        try {
            return await fetchJsonWithTimeout(url);
        } catch (err) {
            lastError = err;
            const status = err?.httpStatus;
            // Don't retry on 403 (blocked) or 401 (auth required) — these won't change
            if (status === 403 || status === 401) throw err;
            // Retry on 429 and 5xx
            if (attempt < REDDIT_MAX_RETRIES && (status === 429 || status >= 500 || !status)) {
                const delay = REDDIT_RETRY_BASE_MS * Math.pow(2, attempt);
                console.warn(`[Community] Reddit fetch retry ${attempt + 1}/${REDDIT_MAX_RETRIES} after ${delay}ms (${err?.message})`);
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

async function collectRedditPosts(seedQueries, subredditTargets = []) {
    const seedDiagnostics = [];

    // Build the full query list: global seeds + subreddit-scoped seeds
    const queryPlan = [];
    for (const seed of seedQueries) {
        const query = typeof seed === 'string' ? seed : seed.query;
        const strategy = typeof seed === 'string' ? 'legacy' : (seed.strategy || 'unknown');
        queryPlan.push({ query, strategy, subreddit: null });
    }

    // Add subreddit-targeted queries (use offering/topic terms within specific subreddits)
    for (const sub of subredditTargets.slice(0, 3)) {
        const cleanSub = sub.replace(/^r\//, '').trim();
        if (!cleanSub) continue;
        // Use first 2 global seeds scoped to this subreddit
        for (const seed of seedQueries.slice(0, 2)) {
            const query = typeof seed === 'string' ? seed : seed.query;
            queryPlan.push({ query, strategy: 'community', subreddit: cleanSub });
        }
    }

    // Process requests sequentially with delay to avoid rate limiting.
    // Reddit aggressively rate-limits concurrent requests from the same IP.
    const allPosts = [];
    for (let i = 0; i < queryPlan.length; i++) {
        const { query, strategy, subreddit } = queryPlan[i];
        let url;
        if (subreddit) {
            const base = REDDIT_SUBREDDIT_SEARCH_ENDPOINT.replace('{subreddit}', encodeURIComponent(subreddit));
            url = `${base}?q=${encodeURIComponent(query)}&restrict_sr=on&sort=top&t=year&limit=${MAX_POSTS_PER_QUERY}&raw_json=1`;
        } else {
            url = `${REDDIT_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&sort=top&t=year&limit=${MAX_POSTS_PER_QUERY}&raw_json=1`;
        }
        try {
            const json = await fetchJsonWithRetry(url);
            const children = json?.data?.children || [];
            const posts = children
                .map((item) => {
                    const node = item?.data || {};
                    return {
                        id: node.id || null,
                        title: String(node.title || '').trim(),
                        body: String(node.selftext || '').trim(),
                        subreddit: String(node.subreddit || '').trim(),
                        ups: Number(node.ups || 0),
                        created_at: node.created_utc ? new Date(node.created_utc * 1000).toISOString() : null,
                        permalink: node.permalink ? `https://www.reddit.com${node.permalink}` : null,
                        seed_query: query,
                    };
                })
                .filter((post) => post.id && post.title);
            seedDiagnostics.push({ seed: query, strategy, subreddit: subreddit || null, results: posts.length, status: 'ok' });
            allPosts.push(...posts);
        } catch (err) {
            const httpStatus = err?.httpStatus || null;
            const failureClass = httpStatus
                ? classifyHttpError(httpStatus)
                : classifyNetworkError(err);
            seedDiagnostics.push({
                seed: query,
                strategy,
                subreddit: subreddit || null,
                results: 0,
                status: 'error',
                detail: err?.message || 'unknown',
                http_status: httpStatus,
                failure_class: failureClass,
            });
        }
        // Delay between requests (skip after last)
        if (i < queryPlan.length - 1) {
            await sleep(REDDIT_REQUEST_DELAY_MS);
        }
    }

    const dedupe = new Map();
    for (const post of allPosts) {
        if (!dedupe.has(post.id)) dedupe.set(post.id, post);
    }
    return { posts: [...dedupe.values()], seedDiagnostics };
}

// ──────────────────────────────────────────────────────────────
// Collection outcome classification
// ──────────────────────────────────────────────────────────────

/**
 * Analyzes seed diagnostics to classify the overall collection outcome.
 * This allows the pipeline (and downstream consumers) to distinguish:
 *   - "we found nothing relevant" (no_signal_found)
 *   - "we could not access the source" (source_access_failure)
 *   - "we were rate-limited" (source_rate_limited)
 *   - "seeds are too narrow" (seed_quality_failure)
 *
 * Returns { failureClass, isAccessFailure, summary }
 */
export function classifyCollectionOutcome(seedDiagnostics, postsCount) {
    if (!Array.isArray(seedDiagnostics) || seedDiagnostics.length === 0) {
        return {
            failureClass: postsCount > 0 ? null : COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE,
            isAccessFailure: false,
            summary: { ok: 0, error: 0, total: 0, errorBreakdown: {} },
        };
    }

    const total = seedDiagnostics.length;
    const okSeeds = seedDiagnostics.filter((s) => s.status === 'ok');
    const errorSeeds = seedDiagnostics.filter((s) => s.status === 'error');
    const okCount = okSeeds.length;
    const errorCount = errorSeeds.length;

    // Count error types
    const errorBreakdown = {};
    for (const sd of errorSeeds) {
        const cls = sd.failure_class || COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE;
        errorBreakdown[cls] = (errorBreakdown[cls] || 0) + 1;
    }

    const summary = { ok: okCount, error: errorCount, total, errorBreakdown };

    // If we got posts, collection succeeded (possibly partially)
    if (postsCount > 0) {
        return { failureClass: null, isAccessFailure: false, summary };
    }

    // All seeds errored
    if (errorCount === total) {
        // Majority are 403 → source access failure
        const accessCount = errorBreakdown[COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE] || 0;
        const rateLimitCount = errorBreakdown[COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED] || 0;
        const networkCount = errorBreakdown[COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE] || 0;

        if (accessCount >= total * 0.5) {
            return { failureClass: COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE, isAccessFailure: true, summary };
        }
        if (rateLimitCount >= total * 0.5) {
            return { failureClass: COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED, isAccessFailure: true, summary };
        }
        if (networkCount >= total * 0.5) {
            return { failureClass: COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE, isAccessFailure: true, summary };
        }
        return { failureClass: COLLECTION_FAILURE_CLASS.UNKNOWN_COLLECTION_FAILURE, isAccessFailure: true, summary };
    }

    // Some seeds succeeded but returned 0 results, some errored
    if (errorCount > 0 && okCount > 0) {
        // Check if all OK seeds returned 0 results
        const allOkZero = okSeeds.every((s) => s.results === 0);
        if (allOkZero) {
            // OK seeds returned nothing, error seeds failed — mixed failure
            if (errorCount > okCount) {
                const accessCount = errorBreakdown[COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE] || 0;
                if (accessCount > 0) {
                    return { failureClass: COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE, isAccessFailure: true, summary };
                }
            }
            return { failureClass: COLLECTION_FAILURE_CLASS.SEED_QUALITY_FAILURE, isAccessFailure: false, summary };
        }
    }

    // All seeds OK but 0 posts — seeds are too narrow or no market signal
    if (okCount === total) {
        const allZero = okSeeds.every((s) => s.results === 0);
        if (allZero) {
            return { failureClass: COLLECTION_FAILURE_CLASS.SEED_QUALITY_FAILURE, isAccessFailure: false, summary };
        }
    }

    return { failureClass: COLLECTION_FAILURE_CLASS.NO_SIGNAL_FOUND, isAccessFailure: false, summary };
}

/**
 * Builds a human-readable operator-facing diagnosis message (in French)
 * based on the collection outcome classification.
 */
export function buildCollectionDiagnosis(failureClass, diagnosticSummary) {
    const { error, total, errorBreakdown } = diagnosticSummary || {};
    const accessErrors = errorBreakdown?.[COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE] || 0;

    switch (failureClass) {
    case COLLECTION_FAILURE_CLASS.SOURCE_ACCESS_FAILURE:
        return {
            title: 'Échec d\'accès aux sources',
            description: `${accessErrors}/${total} seed(s) ont été bloqués par la source (HTTP 403). `
                    + 'Il s\'agit d\'un blocage technique d\'accès, pas d\'une absence de signal marché. '
                    + 'Les seeds peuvent être pertinents, le problème est l\'accès à la source.',
            severity: 'error',
            operatorAction: 'Le problème est technique : la source bloque les requêtes. Aucune conclusion marché ne peut être tirée de cette collecte.',
            isAccessFailure: true,
        };
    case COLLECTION_FAILURE_CLASS.SOURCE_RATE_LIMITED:
        return {
            title: 'Source temporairement limitée',
            description: `La source a limité le débit des requêtes (${error}/${total} seeds en erreur). `
                    + 'Cela devrait se résoudre automatiquement lors de la prochaine collecte.',
            severity: 'warning',
            operatorAction: 'Attendez la prochaine exécution planifiée. Si le problème persiste, réduisez le nombre de seeds.',
            isAccessFailure: true,
        };
    case COLLECTION_FAILURE_CLASS.TEMPORARY_NETWORK_FAILURE:
        return {
            title: 'Erreur réseau temporaire',
            description: `${error}/${total} seed(s) ont échoué à cause d'erreurs réseau temporaires. `
                    + 'La prochaine collecte devrait fonctionner normalement.',
            severity: 'warning',
            operatorAction: 'Erreur transitoire, la prochaine exécution devrait réussir.',
            isAccessFailure: true,
        };
    case COLLECTION_FAILURE_CLASS.SEED_QUALITY_FAILURE:
        return {
            title: 'Seeds sans résultats',
            description: `Les ${total} seed(s) testés n'ont retourné aucune discussion. `
                    + 'Cela peut signifier un marché de niche, des seeds trop spécifiques, ou un volume communautaire faible.',
            severity: 'info',
            operatorAction: 'Affinez les seeds ou ajoutez des termes plus larges dans la configuration Veille sociale.',
            isAccessFailure: false,
        };
    case COLLECTION_FAILURE_CLASS.NO_SIGNAL_FOUND:
        return {
            title: 'Aucun signal pertinent détecté',
            description: 'La collecte a fonctionné mais n\'a pas trouvé de discussions pertinentes pour ce profil.',
            severity: 'info',
            operatorAction: 'Élargissez les seeds ou vérifiez que le secteur a une présence communautaire en ligne.',
            isAccessFailure: false,
        };
    default:
        return {
            title: 'Échec de collecte : cause indéterminée',
            description: `La collecte a échoué (${error}/${total} seeds en erreur). Vérifiez les logs pour plus de détails.`,
            severity: 'warning',
            operatorAction: 'Vérifiez la configuration et relancez la collecte.',
            isAccessFailure: false,
        };
    }
}

export async function collectCommunityPosts(seedQueries, subredditTargets) {
    // Reddit first, web-search fallback when source access fails.
    let collectionSource = 'reddit';
    let webSearchProvider = null;

    const redditResult = await collectRedditPosts(seedQueries, subredditTargets);
    let rawPosts = redditResult.posts;
    let seedDiagnostics = redditResult.seedDiagnostics;

    const redditOutcome = classifyCollectionOutcome(seedDiagnostics, rawPosts.length);

    // ── Web-search fallback: if Reddit is blocked, try web search APIs ──
    if (redditOutcome.isAccessFailure && rawPosts.length === 0 && isWebSearchAvailable()) {
        console.warn(`[Community] Reddit blocked (${redditOutcome.failureClass}) — falling back to web search`);

        const webResult = await collectViaWebSearch(seedQueries);
        if (webResult.posts.length > 0) {
            rawPosts = webResult.posts;
            seedDiagnostics = webResult.seedDiagnostics;
            collectionSource = 'web_search';
            webSearchProvider = webResult.provider;
            console.warn(`[Community] Web search fallback collected ${rawPosts.length} results via ${webSearchProvider}`);
        } else {
            // Web search also found nothing — merge diagnostics for full picture
            console.warn('[Community] Web search fallback also returned 0 results');
            seedDiagnostics = [
                ...redditResult.seedDiagnostics.map((sd) => ({ ...sd, collector: 'reddit' })),
                ...webResult.seedDiagnostics.map((sd) => ({ ...sd, collector: 'web_search' })),
            ];
        }
    }

    // ── Classify final collection outcome ──
    const collectionOutcome = classifyCollectionOutcome(seedDiagnostics, rawPosts.length);
    return { rawPosts, seedDiagnostics, collectionSource, webSearchProvider, collectionOutcome };
}
