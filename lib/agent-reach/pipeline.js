import 'server-only';

import crypto from 'crypto';

import { resolveBusinessType } from '@/lib/ai/business-type-resolver';
import { executeTask } from '@/lib/ai/tasks/registry';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getOpportunitiesBySource as dbGetOpportunitiesBySource, createOpportunities as dbCreateOpportunities } from '@/lib/db/opportunities';
import { collectViaWebSearch, isWebSearchAvailable } from '@/lib/agent-reach/web-search-collector';
import {
    insertCollectionRun,
    updateCollectionRun,
    upsertDocuments,
    listDocuments,
    markDocumentsProcessed,
    insertMentions,
    deleteMentionsForDocuments,
    upsertClusters,
    clearClusters,
    upsertOpportunities,
} from '@/lib/db/community';
import {
    evidenceLevel,
    SIGNAL_FAMILIES,
    computeCompositeScore,
    MIN_KEYWORD_MATCHES_FOR_SIGNAL,
    STRONG_COMPLAINT_TERMS,
    WEAK_COMPLAINT_TERMS,
    matchesKeyword,
    isNegated,
} from '@/lib/agent-reach/contracts';

// Register Mistral-backed tasks (side-effect imports)
import '@/lib/ai/tasks/community-classify';
import '@/lib/ai/tasks/community-labels';
import '@/lib/ai/tasks/community-synthesize';

const COMMUNITY_USE_LLM_ENRICHMENT = process.env.COMMUNITY_USE_LLM_ENRICHMENT === 'true';
const LLM_ENRICHMENT_BATCH_SIZE = 10;

// ──────────────────────────────────────────────────────────────
// Mandate context helpers
// ──────────────────────────────────────────────────────────────

/**
 * Safely extracts structured social watch mandate context from a client record.
 * Returns a normalized object with defaults for every field, so downstream
 * consumers never need to null-check individual keys.
 */
export function getSocialWatchConfig(client) {
    const raw = client?.social_watch_config || {};
    return {
        goals: Array.isArray(raw.goals) ? raw.goals.filter(Boolean) : [],
        known_competitors: Array.isArray(raw.known_competitors) ? raw.known_competitors.filter(Boolean) : [],
        monitored_topics: Array.isArray(raw.monitored_topics) ? raw.monitored_topics.filter(Boolean) : [],
        target_customer_description: typeof raw.target_customer_description === 'string' ? raw.target_customer_description.trim() : '',
        language_priority: typeof raw.language_priority === 'string' ? raw.language_priority.trim() : 'fr',
        subreddit_targets: Array.isArray(raw.subreddit_targets) ? raw.subreddit_targets.filter(Boolean) : [],
    };
}

// ──────────────────────────────────────────────────────────────
// Reddit collector constants
// ──────────────────────────────────────────────────────────────

const REDDIT_SEARCH_ENDPOINT = 'https://www.reddit.com/search.json';
const REDDIT_SUBREDDIT_SEARCH_ENDPOINT = 'https://www.reddit.com/r/{subreddit}/search.json';
const REDDIT_TIMEOUT_MS = 12000;
const MAX_QUERY_SEEDS = 10;
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
// Text analysis constants (from social.js — canonical copies)
// Note: COMPLAINT_TERMS replaced by STRONG_COMPLAINT_TERMS and
// WEAK_COMPLAINT_TERMS in contracts.js for better precision.
// ──────────────────────────────────────────────────────────────

const QUESTION_HINTS = ['how', 'what', 'why', 'which', 'where', 'best', 'combien', 'comment', 'pourquoi', 'quel'];
const COMPETITOR_HINTS = ['vs', 'versus', 'alternative', 'alternatives', 'instead of', 'comparer', 'compare'];
const STOPWORDS = new Set([
    // English function words & generic terms
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'your', 'about', 'their', 'there', 'into',
    'when', 'where', 'what', 'how', 'why', 'which', 'best', 'near', 'been', 'being', 'were', 'will', 'would',
    'could', 'should', 'just', 'also', 'like', 'even', 'only', 'very', 'really', 'much', 'more', 'most', 'some',
    'many', 'than', 'then', 'them', 'they', 'these', 'those', 'such', 'each', 'every', 'other', 'another',
    'same', 'here', 'well', 'still', 'back', 'after', 'before', 'over', 'under', 'between', 'through', 'during',
    'because', 'since', 'while', 'though', 'although', 'until', 'unless', 'however', 'therefore', 'actually',
    'know', 'think', 'feel', 'want', 'need', 'make', 'take', 'give', 'come', 'going', 'does', 'done', 'doing',
    'thing', 'things', 'something', 'anything', 'everything', 'nothing', 'someone', 'anyone', 'everyone',
    'people', 'person', 'place', 'places', 'time', 'times', 'year', 'years', 'day', 'days', 'way', 'ways',
    'case', 'point', 'part', 'kind', 'type', 'sort', 'lot', 'lots', 'bit', 'stuff', 'area', 'around',
    'work', 'working', 'works', 'used', 'using', 'use', 'look', 'looking', 'looks', 'good', 'great',
    'right', 'said', 'say', 'says', 'told', 'tell', 'get', 'got', 'getting', 'pretty', 'literally',
    'too', 'but', 'not', 'out', 'its', 'can', 'had', 'was', 'are', 'all', 'you', 'now', 'new', 'old',
    'own', 'may', 'try', 'yes', 'per', 'put', 'end', 'big', 'long', 'real', 'able', 'sure', 'keep', 'help',
    'post', 'read', 'edit', 'link', 'thread', 'comment', 'reddit', 'subreddit', 'upvote', 'downvote',
    'site', 'service', 'business', 'company',
    // French function words & generic terms
    'les', 'des', 'pour', 'avec', 'dans', 'plus', 'tout', 'tous', 'chez', 'entre', 'sur', 'une', 'que',
    'qui', 'est', 'sont', 'aux', 'par', 'pas', 'mais', 'aussi', 'bien', 'fait', 'faire', 'peut', 'comme',
    'etre', 'avoir', 'tres', 'peu', 'bon', 'elle', 'elles', 'ils', 'nous', 'vous', 'leur', 'ses', 'son',
    'mon', 'mes', 'nos', 'vos', 'cela', 'ceci', 'celui', 'cette', 'ces', 'dont', 'donc', 'car', 'parce',
    'encore', 'deja', 'toujours', 'jamais', 'rien', 'quelque', 'autre', 'autres', 'meme', 'tant', 'assez',
    'gens', 'chose', 'choses', 'truc', 'trucs', 'moment', 'fois', 'jour', 'jours', 'temps', 'annee',
]);

// Minimum relevance score for a theme cluster to be displayed
export const THEME_RELEVANCE_THRESHOLD = 0.15;

// Relevance scoring weights:
// - TOKEN_MATCH_SCORE: awarded per anchor token found in the label
// - BIGRAM_EXACT_BONUS: extra bonus when a multi-word label exactly matches an anchor
// - PARTIAL_MATCH_SCORE: awarded for substring anchor matches (compound words)
// - MAX_RELEVANCE_SCORE: cap to prevent runaway scores
// Cluster score formula: mention_count × (1 + relevance), so relevance amplifies
// frequency but never replaces it. Zero-relevance themes are filtered out entirely.
const TOKEN_MATCH_SCORE = 0.5;
const BIGRAM_EXACT_BONUS = 0.5;
const PARTIAL_MATCH_SCORE = 0.3;
const MAX_RELEVANCE_SCORE = 2.0;
const MIN_PARTIAL_MATCH_LENGTH = 4;

// ──────────────────────────────────────────────────────────────
// Text helpers
// ──────────────────────────────────────────────────────────────

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        // Strip diacritics so accented text matches anchors (e.g. Montréal → montreal)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(value) {
    return normalizeText(value)
        .split(' ')
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function extractBigrams(tokens) {
    const bigrams = [];
    for (let i = 0; i < tokens.length - 1; i++) {
        bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
    return bigrams;
}

// ──────────────────────────────────────────────────────────────
// Client-context relevance scoring
// ──────────────────────────────────────────────────────────────

const INDUSTRY_VOCAB = {
    seo: ['seo', 'referencement', 'serp', 'ranking', 'rank', 'indexation', 'crawl', 'sitemap', 'backlink', 'backlinks', 'meta', 'metadata', 'schema', 'keyword', 'keywords', 'organic', 'search', 'optimization', 'optimisation'],
    geo: ['geo', 'local', 'localisation', 'maps', 'google-maps', 'google-business', 'gmb', 'fiche', 'annuaire', 'directory', 'listing', 'listings', 'geolocation', 'geolocalisation', 'proximite'],
    ai: ['ia', 'intelligence-artificielle', 'llm', 'gpt', 'chatgpt', 'gemini', 'mistral', 'openai', 'ai-overview', 'ai-overviews', 'citation', 'citations', 'generative', 'prompt', 'rag'],
    marketing: ['marketing', 'visibilite', 'visibility', 'branding', 'strategie', 'acquisition', 'conversion', 'leads', 'inbound', 'outbound', 'content', 'contenu', 'campagne', 'campaign'],
    agency: ['agence', 'agency', 'consultant', 'consulting', 'freelance', 'prestataire', 'cabinet', 'firme', 'firm', 'studio', 'expert', 'expertise'],
    web: ['web', 'website', 'site-web', 'digital', 'numerique', 'online', 'ligne', 'internet', 'app', 'application', 'plateforme', 'platform'],
};

const INTENT_VOCAB = [
    'recommandation', 'recommendation', 'recommander', 'recommend',
    'alternative', 'alternatives', 'compare', 'comparer', 'comparison', 'comparaison',
    'meilleur', 'meilleure', 'meilleurs', 'meilleures',
    'avis', 'review', 'reviews', 'opinion', 'opinions', 'temoignage',
    'prix', 'tarif', 'tarifs', 'pricing', 'cost', 'cout', 'devis', 'quote',
    'probleme', 'problem', 'issue', 'issues', 'erreur', 'error', 'bug',
    'question', 'questions', 'aide', 'help', 'support',
];

export function buildRelevanceAnchors(client) {
    const anchors = new Set();
    const clientName = normalizeText(client?.client_name || '');
    const rawBusinessType = normalizeText(client?.business_type || '');
    const city = normalizeText(client?.address?.city || client?.target_region || '');

    // Resolve richer context when raw business_type is weak
    const siteClassification = client?.site_classification || {};
    const resolved = resolveBusinessType(
        String(client?.business_type || '').trim(),
        siteClassification,
        String(client?.client_name || '').trim(),
    );
    const resolvedCategory = normalizeText(resolved.canonical_category || '');
    const resolvedOffering = normalizeText(resolved.offering_anchor || '');

    // Entity anchors — client name tokens
    for (const token of clientName.split(' ').filter(Boolean)) {
        if (token.length >= 2) anchors.add(token);
    }

    // Location anchors
    for (const token of city.split(' ').filter(Boolean)) {
        if (token.length >= 2) anchors.add(token);
    }

    // Business type anchors — combine raw + resolved
    const combinedBusinessText = [rawBusinessType, resolvedCategory, resolvedOffering].filter(Boolean).join(' ');
    for (const token of combinedBusinessText.split(' ').filter(Boolean)) {
        if (token.length >= 2 && !STOPWORDS.has(token)) anchors.add(token);
    }

    // Industry vocabulary — match relevant industries from combined context
    const contextHay = combinedBusinessText.toLowerCase();
    for (const vocab of Object.values(INDUSTRY_VOCAB)) {
        for (const term of vocab) {
            if (contextHay.includes(term) || clientName.includes(term)) {
                vocab.forEach((v) => anchors.add(v));
                break;
            }
        }
    }

    // Always include intent vocab as weak anchors (scored lower)
    // and industry-agnostic anchors
    for (const term of INTENT_VOCAB) {
        anchors.add(term);
    }

    // If business_type is weak/unknown, add safe cross-industry fallbacks
    if (!rawBusinessType || rawBusinessType.length < 3) {
        for (const vocab of Object.values(INDUSTRY_VOCAB)) {
            vocab.forEach((v) => anchors.add(v));
        }
    }

    return anchors;
}

export function scoreThemeRelevance(label, anchors) {
    if (!label || !anchors?.size) return 0;
    const normalized = normalizeText(label);
    const tokens = normalized.split(' ').filter(Boolean);

    let score = 0;

    // Exact full-label match bonus — only for multi-word labels
    if (tokens.length > 1 && anchors.has(normalized)) {
        score += BIGRAM_EXACT_BONUS;
    }

    // Token-level matches
    for (const token of tokens) {
        if (anchors.has(token)) {
            score += TOKEN_MATCH_SCORE;
        }
    }

    // Substring/partial matching for compound words or aliases.
    // Skip tokens already counted above to avoid double-scoring the same match.
    for (const anchor of anchors) {
        if (anchor.length >= MIN_PARTIAL_MATCH_LENGTH && normalized.includes(anchor) && !tokens.includes(anchor)) {
            score += PARTIAL_MATCH_SCORE;
        }
    }

    return Math.min(score, MAX_RELEVANCE_SCORE);
}

function dedupeHash(source, externalId, title) {
    const raw = `${source}:${externalId || ''}:${(title || '').trim().toLowerCase().slice(0, 120)}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

// ──────────────────────────────────────────────────────────────
// Stage 1 — Seed generation (multi-strategy, mandate-aware)
// ──────────────────────────────────────────────────────────────

/**
 * Seed strategies:
 *   brand       — brand name + region / brand + avis / alternatives
 *   buyer_intent — offering + recommandation / meilleur + offering + city
 *   pain        — offering + problème / complaint keywords + domain
 *   competitor  — competitor name + avis / vs competitor
 *   community   — subreddit-scoped queries when subreddit_targets are set
 *   topic       — monitored_topics direct search
 *
 * Each seed is tagged with a strategy label so diagnostics can report
 * which strategies are productive.
 */
export function buildSeedQueries(client) {
    const clientName = String(client?.client_name || '').trim();
    const rawBusinessType = String(client?.business_type || '').trim();
    const city = String(client?.address?.city || client?.target_region || '').trim();
    const seoDesc = String(client?.seo_description || '').trim();

    // Resolve richer context when raw business_type is weak
    const siteClassification = client?.site_classification || {};
    const resolved = resolveBusinessType(rawBusinessType, siteClassification, clientName);
    const categoryLabel = resolved.canonical_category && resolved.canonical_category !== 'unknown'
        ? resolved.canonical_category.replace(/_/g, ' ')
        : '';
    const offeringAnchor = String(resolved.offering_anchor || '').trim();

    // Pick the strongest business descriptor available
    const businessDesc = offeringAnchor || categoryLabel || rawBusinessType;

    // Extract mandate context (safe defaults if not configured)
    const mandate = getSocialWatchConfig(client);
    const lang = mandate.language_priority || 'fr';
    const isFrench = lang.startsWith('fr');

    const seeds = [];

    // ── Strategy: brand monitoring ──
    if (clientName) {
        if (city) seeds.push({ query: `${clientName} ${city}`, strategy: 'brand' });
        seeds.push({ query: `${clientName} ${isFrench ? 'avis' : 'review'}`, strategy: 'brand' });
        seeds.push({ query: `${clientName} alternatives`, strategy: 'brand' });
    }

    // ── Strategy: buyer intent ──
    if (businessDesc) {
        if (city) {
            seeds.push({ query: `${isFrench ? 'meilleur' : 'best'} ${businessDesc} ${city}`, strategy: 'buyer_intent' });
        }
        seeds.push({ query: `${businessDesc} ${isFrench ? 'recommandation' : 'recommendation'}${city ? ` ${city}` : ''}`, strategy: 'buyer_intent' });
    }

    // ── Strategy: pain / problem ──
    if (businessDesc) {
        seeds.push({ query: `${businessDesc} ${isFrench ? 'problème' : 'problem'}${city ? ` ${city}` : ''}`, strategy: 'pain' });
    }

    // ── Strategy: competitor patterns ──
    for (const comp of mandate.known_competitors.slice(0, 3)) {
        seeds.push({ query: `${comp} ${isFrench ? 'avis' : 'review'}`, strategy: 'competitor' });
        if (clientName) {
            seeds.push({ query: `${clientName} vs ${comp}`, strategy: 'competitor' });
        }
    }

    // ── Strategy: monitored topics ──
    for (const topic of mandate.monitored_topics.slice(0, 3)) {
        seeds.push({ query: `${topic}${city ? ` ${city}` : ''}`, strategy: 'topic' });
    }

    // ── Strategy: SEO description fallback ──
    // If we have very few seeds and a rich seo_description, extract a seed from it
    if (seeds.length < 4 && seoDesc.length > 20) {
        const descSeed = seoDesc.split(/[.,;!?]/).filter(Boolean)[0]?.trim();
        if (descSeed && descSeed.length > 10 && descSeed.length < 80) {
            seeds.push({ query: descSeed, strategy: 'seo_desc' });
        }
    }

    // Dedupe by query text, preserve first occurrence (strategy priority)
    const seen = new Set();
    const deduped = [];
    for (const seed of seeds) {
        const normalized = seed.query.trim().toLowerCase();
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            deduped.push(seed);
        }
    }

    return deduped.slice(0, MAX_QUERY_SEEDS);
}

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
// Stage 3 — Normalize & persist documents
// ──────────────────────────────────────────────────────────────

function toDocumentRows(rawPosts, clientId, collectionRunId, { sourceLabel = 'reddit' } = {}) {
    return rawPosts.map((post) => {
        const source = post._source_platform || sourceLabel;
        const externalId = post.id || null;
        return {
            client_id: clientId,
            collection_run_id: collectionRunId,
            source,
            external_id: externalId,
            url: post.permalink || null,
            title: post.title,
            body: post.body || null,
            author: null,
            published_at: post.created_at || null,
            source_metadata: {
                subreddit: post.subreddit || null,
                ups: post.ups || 0,
                ...(post._search_score !== undefined && post._search_score !== null ? { search_score: post._search_score } : {}),
            },
            normalized_content: normalizeText(`${post.title} ${post.body}`),
            language: 'fr',
            engagement_score: Math.min(post.ups || 0, 9999),
            seed_query: post.seed_query || null,
            dedupe_hash: dedupeHash(source, externalId || post.permalink, post.title),
            is_processed: false,
        };
    });
}

// ──────────────────────────────────────────────────────────────
// Signal family detection — tag mentions with operator-actionable families
// ──────────────────────────────────────────────────────────────

export function detectSignalFamilies(mentionType, label, snippet) {
    const families = [];
    const combined = `${label || ''} ${snippet || ''}`.toLowerCase();

    for (const [familyId, family] of Object.entries(SIGNAL_FAMILIES)) {
        // Check if mention type matches this family
        if (!family.mention_types.includes(mentionType)) continue;
        // Count keyword matches using word-boundary-aware matching
        let keywordMatches = 0;
        for (const kw of family.keywords) {
            if (matchesKeyword(combined, kw) && !isNegated(combined, kw)) {
                keywordMatches++;
            }
        }
        // Require minimum keyword count to reduce false positives
        if (keywordMatches >= MIN_KEYWORD_MATCHES_FOR_SIGNAL) {
            families.push(familyId);
        }
    }

    return families;
}

// ──────────────────────────────────────────────────────────────
// Stage 4 — Enrich: extract mentions from unprocessed documents
// ──────────────────────────────────────────────────────────────

export function extractMentionsFromDocuments(documents, clientId, relevanceAnchors = new Set()) {
    const mentions = [];

    for (const doc of documents) {
        const merged = `${doc.title || ''} ${doc.body || ''}`;
        const mergedLower = merged.toLowerCase();
        const titleLower = (doc.title || '').toLowerCase();

        // Question signals — require actual question structure, not just hint words
        const hasQuestionMark = (doc.title || '').includes('?');
        const hasQuestionPhrase = QUESTION_HINTS.some((h) => {
            // Require hint at start of title or after common separators for stronger signal
            const idx = titleLower.indexOf(`${h} `);
            return idx >= 0 && (idx === 0 || titleLower[idx - 1] === ' ' || titleLower[idx - 1] === ',');
        });
        const looksLikeQuestion = hasQuestionMark || (hasQuestionPhrase && titleLower.length < 200);
        if (looksLikeQuestion) {
            const questionLabel = (doc.title || '').replace(/\?+$/, '?');
            const questionSnippet = merged.slice(0, 300);
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'question',
                label: questionLabel,
                snippet: questionSnippet,
                evidence_level: hasQuestionMark ? 'low' : 'low',
                provenance: 'observed',
                source: doc.source,
                signal_families: detectSignalFamilies('question', questionLabel, questionSnippet),
            });
        }

        // Complaint signals — require stronger evidence to reduce false positives
        // Strong term: 1 match is sufficient (frustrating, terrible, scam, etc.)
        // Weak term: require ≥2 matches or co-occurrence with a strong term
        const strongMatches = STRONG_COMPLAINT_TERMS.filter(
            (term) => mergedLower.includes(term) && !isNegated(mergedLower, term),
        );
        const weakMatches = WEAK_COMPLAINT_TERMS.filter(
            (term) => matchesKeyword(mergedLower, term) && !isNegated(mergedLower, term),
        );
        const hasStrongComplaint = strongMatches.length >= 1;
        const hasWeakComplaint = weakMatches.length >= 2;
        const hasComplaint = hasStrongComplaint || hasWeakComplaint;

        if (hasComplaint) {
            const complaintLabel = doc.title || mergedLower.slice(0, 120);
            const complaintSnippet = merged.slice(0, 300);
            const evidenceFromComplaint = hasStrongComplaint ? 'medium' : 'low';
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'complaint',
                label: complaintLabel,
                snippet: complaintSnippet,
                evidence_level: evidenceFromComplaint,
                provenance: 'observed',
                source: doc.source,
                signal_families: detectSignalFamilies('complaint', complaintLabel, complaintSnippet),
            });
        }

        // Competitor signals — require comparison hint AND complaint evidence
        const hasCompetitor = COMPETITOR_HINTS.some((h) => matchesKeyword(mergedLower, h));
        if (hasCompetitor && hasComplaint) {
            const compLabel = doc.title || '';
            const compSnippet = merged.slice(0, 300);
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'competitor',
                label: compLabel,
                snippet: compSnippet,
                evidence_level: 'low',
                provenance: 'observed',
                source: doc.source,
                signal_families: detectSignalFamilies('competitor', compLabel, compSnippet),
            });
        }

        // Theme tokens — only emit if relevance meets the threshold.
        // A simple > 0 check is too permissive because intent vocab (help, support,
        // problem…) is always included as anchors and would match many irrelevant
        // documents. Requiring >= THEME_RELEVANCE_THRESHOLD ensures only genuinely
        // business-relevant tokens become theme mentions.
        const tokens = tokenize(merged);
        for (const token of tokens) {
            const relevance = scoreThemeRelevance(token, relevanceAnchors);
            if (relevance >= THEME_RELEVANCE_THRESHOLD) {
                mentions.push({
                    client_id: clientId,
                    document_id: doc.id,
                    mention_type: 'theme',
                    label: token,
                    snippet: null,
                    evidence_level: 'low',
                    provenance: 'derived',
                    source: doc.source,
                    signal_families: detectSignalFamilies('theme', token, mergedLower),
                });
            }
        }

        // Bigram theme candidates — phrase-level signals.
        // Same threshold applies: bigrams need real relevance, not just one
        // weak intent-vocab match from a constituent token.
        const bigrams = extractBigrams(tokens);
        for (const bigram of bigrams) {
            const relevance = scoreThemeRelevance(bigram, relevanceAnchors);
            if (relevance >= THEME_RELEVANCE_THRESHOLD) {
                mentions.push({
                    client_id: clientId,
                    document_id: doc.id,
                    mention_type: 'theme',
                    label: bigram,
                    snippet: null,
                    evidence_level: 'low',
                    provenance: 'derived',
                    source: doc.source,
                    signal_families: detectSignalFamilies('theme', bigram, mergedLower),
                });
            }
        }

        // Language signals — high-engagement titles
        const engagement = doc.engagement_score || 0;
        if ((doc.title || '').length >= 12 && engagement >= 5) {
            mentions.push({
                client_id: clientId,
                document_id: doc.id,
                mention_type: 'language',
                label: doc.title,
                snippet: merged.slice(0, 300),
                evidence_level: 'low',
                provenance: 'observed',
                source: doc.source,
                signal_families: [],
            });
        }
    }

    return mentions;
}

// ──────────────────────────────────────────────────────────────
// Stage 4b — LLM-powered mention extraction (Mistral)
// Falls back to keyword extraction on failure.
// ──────────────────────────────────────────────────────────────

async function extractMentionsWithLLM(documents, clientId, client) {
    const clientName = String(client?.client_name || '').trim();
    const businessType = String(client?.business_type || '').trim();
    const mandate = getSocialWatchConfig(client);

    const allMentions = [];

    // Batch documents to stay within token limits
    for (let i = 0; i < documents.length; i += LLM_ENRICHMENT_BATCH_SIZE) {
        const batch = documents.slice(i, i + LLM_ENRICHMENT_BATCH_SIZE);
        const docSummaries = batch.map((d) => ({
            id: d.id,
            title: d.title || '',
            body: (d.body || '').slice(0, 600),
            source: d.source || 'unknown',
        }));

        const result = await executeTask('community-classify', {
            clientId,
            clientName,
            businessType,
            competitors: mandate.known_competitors,
            documents: docSummaries,
            // Mandate context for richer classification
            mandateContext: {
                goals: mandate.goals,
                monitored_topics: mandate.monitored_topics,
                target_customer_description: mandate.target_customer_description,
                seo_description: String(client?.seo_description || '').trim(),
            },
        }, { clientId, triggerSource: 'pipeline' });

        if (result.data) {
            allMentions.push(...result.data);
        }
    }

    return allMentions;
}

// ──────────────────────────────────────────────────────────────
// Stage 5 — Cluster: aggregate mentions into clusters
// ──────────────────────────────────────────────────────────────

export function aggregateMentionsToClusters(mentions, clientId, relevanceAnchors = new Set(), scoringContext = {}) {
    const TYPE_TO_CLUSTER = {
        complaint: 'complaint',
        question: 'question',
        theme: 'theme',
        competitor: 'competitor_complaint',
        language: 'language',
    };

    const buckets = new Map();

    for (const mention of mentions) {
        const clusterType = TYPE_TO_CLUSTER[mention.mention_type];
        if (!clusterType) continue;
        const key = `${clusterType}::${mention.label}`;
        if (!buckets.has(key)) {
            buckets.set(key, {
                client_id: clientId,
                cluster_type: clusterType,
                label: mention.label,
                mention_count: 0,
                sources: new Set(),
                example_url: null,
                example_snippet: null,
                last_seen_at: null,
                metadata: {},
                _signal_families: new Set(),
            });
        }
        const bucket = buckets.get(key);
        bucket.mention_count += 1;
        if (mention.source) bucket.sources.add(mention.source);
        if (!bucket.example_snippet && mention.snippet) bucket.example_snippet = mention.snippet;
        // Aggregate signal families from mentions
        if (Array.isArray(mention.signal_families)) {
            for (const fam of mention.signal_families) bucket._signal_families.add(fam);
        }
    }

    // Also build source_bucket clusters from document metadata
    const sourceCounts = new Map();
    for (const mention of mentions) {
        const src = mention.source || 'unknown';
        sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
    }
    for (const [source, count] of sourceCounts) {
        const key = `source_bucket::${source}`;
        buckets.set(key, {
            client_id: clientId,
            cluster_type: 'source_bucket',
            label: source,
            mention_count: count,
            sources: new Set([source]),
            example_url: null,
            example_snippet: null,
            last_seen_at: null,
            metadata: {},
            _signal_families: new Set(),
        });
    }

    return [...buckets.values()]
        .filter((c) => {
            if (c.cluster_type === 'source_bucket') return true;
            if (c.mention_count < 2) return false;

            // Theme clusters must pass a relevance gate
            if (c.cluster_type === 'theme') {
                const relevance = scoreThemeRelevance(c.label, relevanceAnchors);
                if (relevance < THEME_RELEVANCE_THRESHOLD) return false;
            }

            return true;
        })
        .map((c) => {
            // Compute composite score v2 when scoring context is available
            const hasContext = scoringContext.anchors || scoringContext.city;
            let score;
            let scoreDimensions = null;

            if (hasContext && c.cluster_type !== 'source_bucket') {
                const composite = computeCompositeScore(c, scoringContext);
                score = composite.score;
                scoreDimensions = composite.dimensions;
            } else {
                // Fallback: relevance-weighted score for theme clusters, raw count for others
                score = c.mention_count;
                if (c.cluster_type === 'theme') {
                    const relevance = scoreThemeRelevance(c.label, relevanceAnchors);
                    score = c.mention_count * (1 + relevance);
                }
            }

            const signalFamilies = [...c._signal_families];
            const metadata = { ...c.metadata };
            if (signalFamilies.length > 0) metadata.signal_families = signalFamilies;
            if (scoreDimensions) metadata.score_dimensions = scoreDimensions;

            // Remove internal field
            const { _signal_families, ...rest } = c;

            return {
                ...rest,
                sources: [...c.sources],
                evidence_level: evidenceLevel(c.mention_count),
                score: Math.round(score * 100) / 100,
                last_seen_at: new Date().toISOString(),
                metadata,
            };
        });
}

// ──────────────────────────────────────────────────────────────
// Stage 6 — Derive opportunities from clusters
// ──────────────────────────────────────────────────────────────

export function deriveOpportunitiesFromClusters(clusters, clientId, relevanceAnchors = new Set()) {
    const opportunities = [];

    // Helper to build v2 metadata for an opportunity
    function buildOpportunityMeta(cluster, whyItMatters, suggestedAction, signalFamily) {
        return {
            why_it_matters: whyItMatters,
            suggested_action: suggestedAction,
            source_url: cluster.example_url || null,
            signal_family: signalFamily || null,
            composite_score: cluster.score || 0,
            score_dimensions: cluster.metadata?.score_dimensions || null,
            signal_families: cluster.metadata?.signal_families || [],
        };
    }

    // ── Recurring buyer questions → response_opportunity + faq ──
    const questions = clusters.filter((c) => c.cluster_type === 'question').slice(0, 6);
    for (const q of questions) {
        const families = q.metadata?.signal_families || [];
        const hasBuyerIntent = families.includes('buyer_question') || families.includes('best_tool_intent');
        const hasResponseOpp = families.includes('response_opportunity');

        // Always produce FAQ opportunity (backward compatible)
        opportunities.push({
            client_id: clientId,
            opportunity_type: hasBuyerIntent ? 'recurring_buyer_question' : 'faq',
            title: hasBuyerIntent ? `Question acheteur récurrente: ${q.label}` : `FAQ: ${q.label}`,
            rationale: hasBuyerIntent
                ? 'Question récurrente de prospects avec intention d\'achat ou de comparaison.'
                : 'Inféré des questions communautaires récurrentes observées.',
            evidence_level: q.evidence_level,
            mention_count: q.mention_count,
            provenance: 'inferred',
            source_cluster_id: q.id || null,
            status: 'open',
            metadata: buildOpportunityMeta(
                q,
                hasBuyerIntent
                    ? 'Ces questions viennent de prospects en phase de décision, et y répondre positionne votre expertise.'
                    : 'Ces questions reviennent régulièrement, et une page FAQ dédiée capterait ce trafic.',
                hasBuyerIntent
                    ? 'Répondez directement dans le fil ou créez du contenu ciblé pour cette question.'
                    : 'Créez une page FAQ ou un article de blog répondant précisément à cette question.',
                hasBuyerIntent ? 'buyer_question' : null,
            ),
        });

        // If response opportunity signal detected, also produce a response_opportunity
        if (hasResponseOpp) {
            opportunities.push({
                client_id: clientId,
                opportunity_type: 'response_opportunity',
                title: `Répondre au fil: ${q.label}`,
                rationale: 'Fil actif où une réponse experte ajouterait de la valeur et de la visibilité.',
                evidence_level: q.evidence_level,
                mention_count: q.mention_count,
                provenance: 'inferred',
                source_cluster_id: q.id || null,
                status: 'open',
                metadata: buildOpportunityMeta(
                    q,
                    'Ce fil est actif et recherche une expertise, et y répondre construit votre autorité.',
                    'Rédigez une réponse experte et utile dans le fil. Ne faites pas de promotion directe.',
                    'response_opportunity',
                ),
            });
        }
    }

    // ── Comparison discussions → comparison_discussion ──
    const comparisonClusters = clusters
        .filter((c) => (c.metadata?.signal_families || []).includes('comparison_intent'))
        .slice(0, 4);
    for (const comp of comparisonClusters) {
        opportunities.push({
            client_id: clientId,
            opportunity_type: 'comparison_discussion',
            title: `Discussion comparative: ${comp.label}`,
            rationale: 'Utilisateurs comparant des solutions, opportunité de positionnement.',
            evidence_level: comp.evidence_level,
            mention_count: comp.mention_count,
            provenance: 'inferred',
            source_cluster_id: comp.id || null,
            status: 'open',
            metadata: buildOpportunityMeta(
                comp,
                'Les utilisateurs comparent activement des solutions dans cette discussion. C\'est le moment idéal pour se positionner.',
                'Créez du contenu de comparaison honnête ou répondez avec des faits différenciants.',
                'comparison_intent',
            ),
        });
    }

    // ── Content opportunities from relevant themes ──
    const themes = clusters
        .filter((c) => c.cluster_type === 'theme')
        .filter((c) => scoreThemeRelevance(c.label, relevanceAnchors) >= THEME_RELEVANCE_THRESHOLD)
        .slice(0, 4);
    for (const theme of themes) {
        const hasAi = (theme.metadata?.signal_families || []).includes('ai_mention_opportunity');
        const oppType = hasAi ? 'ai_mention_opportunity' : 'content_opportunity';
        opportunities.push({
            client_id: clientId,
            opportunity_type: oppType,
            title: hasAi ? `Opportunité citation IA: ${theme.label}` : `Angle contenu: ${theme.label}`,
            rationale: hasAi
                ? 'Discussion liée à l\'IA où votre marque pourrait être citée par les assistants IA.'
                : 'Inféré des thèmes de discussion externe récurrents.',
            evidence_level: theme.evidence_level,
            mention_count: theme.mention_count,
            provenance: 'inferred',
            source_cluster_id: theme.id || null,
            status: 'open',
            metadata: buildOpportunityMeta(
                theme,
                hasAi
                    ? 'Les assistants IA citent du contenu bien structuré sur ce sujet, optimisez-le pour être référencé.'
                    : 'Ce thème revient fréquemment dans les discussions, et du contenu ciblé capterait ce trafic.',
                hasAi
                    ? 'Créez du contenu structuré (FAQ, guide) optimisé pour la citation par les AI Overviews.'
                    : 'Créez un article ou une page dédiée à ce sujet pour capter l\'intérêt communautaire.',
                hasAi ? 'ai_mention_opportunity' : null,
            ),
        });
    }

    // ── Recurring pain points from complaints ──
    const complaints = clusters.filter((c) => c.cluster_type === 'complaint').slice(0, 4);
    for (const complaint of complaints) {
        const hasPainPoint = (complaint.metadata?.signal_families || []).includes('pain_point');
        opportunities.push({
            client_id: clientId,
            opportunity_type: hasPainPoint ? 'recurring_pain_point' : 'content',
            title: hasPainPoint
                ? `Point de douleur récurrent: ${complaint.label}`
                : `Traiter la préoccupation: ${complaint.label}`,
            rationale: hasPainPoint
                ? 'Frustration récurrente détectée, et adresser ce point crée un avantage compétitif.'
                : 'Inféré du langage de plainte récurrent observé dans les discussions.',
            evidence_level: complaint.evidence_level,
            mention_count: complaint.mention_count,
            provenance: 'inferred',
            source_cluster_id: complaint.id || null,
            status: 'open',
            metadata: buildOpportunityMeta(
                complaint,
                hasPainPoint
                    ? 'Les utilisateurs expriment une frustration forte et répétée sur ce sujet, et y répondre vous différencie.'
                    : 'Cette préoccupation revient dans les discussions, et du contenu rassurant réduirait les frictions.',
                hasPainPoint
                    ? 'Montrez comment votre solution résout ce problème spécifique. Utilisez des témoignages si possible.'
                    : 'Créez du contenu adressant cette préoccupation et proposant votre approche.',
                hasPainPoint ? 'pain_point' : null,
            ),
        });
    }

    // ── Differentiation from competitor complaints ──
    const competitorComplaints = clusters.filter((c) => c.cluster_type === 'competitor_complaint').slice(0, 4);
    for (const cc of competitorComplaints) {
        const hasWeakness = (cc.metadata?.signal_families || []).includes('competitor_weakness');
        opportunities.push({
            client_id: clientId,
            opportunity_type: 'differentiation',
            title: hasWeakness
                ? `Faiblesse concurrentielle exploitable: ${cc.label}`
                : `Angle de différenciation: résoudre "${cc.label}"`,
            rationale: hasWeakness
                ? 'Les utilisateurs se plaignent d\'un concurrent sur ce point, ce qui crée une opportunité de différenciation directe.'
                : 'Inféré des patterns de plaintes où l\'opérateur peut mieux se différencier.',
            evidence_level: cc.evidence_level,
            mention_count: cc.mention_count,
            provenance: 'inferred',
            source_cluster_id: cc.id || null,
            status: 'open',
            metadata: buildOpportunityMeta(
                cc,
                hasWeakness
                    ? 'Les utilisateurs quittent un concurrent à cause de ce problème, positionnez-vous comme la meilleure alternative.'
                    : 'Ce pattern de plainte récurrent est une opportunité de différenciation.',
                hasWeakness
                    ? 'Créez du contenu de comparaison ciblé et des pages de migration/switching.'
                    : 'Mettez en avant votre avantage sur ce point dans vos pages clés.',
                hasWeakness ? 'competitor_weakness' : null,
            ),
        });
    }

    return opportunities;
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

// ──────────────────────────────────────────────────────────────
// Main pipeline orchestrator
// ──────────────────────────────────────────────────────────────

export async function runCommunityPipeline(clientId, { triggerSource = 'system' } = {}) {
    const client = await dbGetClientById(clientId).catch(() => null);
    if (!client) {
        return { success: false, error: 'Client introuvable', summary: {} };
    }

    const mandate = getSocialWatchConfig(client);
    const seedQueries = buildSeedQueries(client);

    // Serialize seeds for the collection run record (store query + strategy)
    const seedQueriesForRecord = seedQueries.map((s) =>
        typeof s === 'string' ? s : `[${s.strategy}] ${s.query}`
    );

    // Create collection run record
    const run = await insertCollectionRun({
        client_id: clientId,
        source: 'reddit',
        status: 'running',
        started_at: new Date().toISOString(),
        seed_queries: seedQueriesForRecord,
        trigger_source: triggerSource,
    });

    try {
        // Stage 2: Collect — Reddit first, web-search fallback if blocked
        let rawPosts;
        let seedDiagnostics;
        let collectionSource = 'reddit';
        let webSearchProvider = null;

        const redditResult = await collectRedditPosts(seedQueries, mandate.subreddit_targets);
        rawPosts = redditResult.posts;
        seedDiagnostics = redditResult.seedDiagnostics;

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

        // If collection completely failed (both Reddit and web-search), short-circuit
        // with an accurate diagnosis instead of proceeding with empty data.
        if (collectionOutcome.isAccessFailure && rawPosts.length === 0) {
            const diagnosis = buildCollectionDiagnosis(collectionOutcome.failureClass, collectionOutcome.summary);
            const webSearchStatus = isWebSearchAvailable()
                ? 'Web search fallback was attempted but returned no results.'
                : 'No web search fallback available (configure TAVILY_API_KEY or GOOGLE_SEARCH_API_KEY).';
            console.warn(`[Community] Collection blocked: ${collectionOutcome.failureClass} — ${collectionOutcome.summary.error}/${collectionOutcome.summary.total} seeds failed. ${webSearchStatus}`);

            await updateCollectionRun(run.id, {
                status: 'partial',
                finished_at: new Date().toISOString(),
                documents_collected: 0,
                documents_persisted: 0,
                documents_skipped: 0,
                error_message: `${diagnosis.description} ${webSearchStatus}`,
                run_context: {
                    seed_diagnostics: seedDiagnostics,
                    failure_class: collectionOutcome.failureClass,
                    collection_diagnosis: diagnosis,
                    is_access_failure: true,
                    collection_source: collectionSource,
                    web_search_available: isWebSearchAvailable(),
                    web_search_provider: webSearchProvider,
                    seed_strategies_used: [...new Set(seedQueries.map((s) => typeof s === 'string' ? 'legacy' : s.strategy))],
                    mandate_configured: mandate.goals.length > 0 || mandate.known_competitors.length > 0,
                },
            });

            return {
                success: false,
                error: `${diagnosis.description} ${webSearchStatus}`,
                summary: {
                    documents_collected: 0,
                    documents_persisted: 0,
                    documents_skipped: 0,
                    mentions_extracted: 0,
                    clusters_built: 0,
                    opportunities_derived: 0,
                    seed_diagnostics: seedDiagnostics,
                    failure_class: collectionOutcome.failureClass,
                    collection_diagnosis: diagnosis,
                    is_access_failure: true,
                    collection_source: collectionSource,
                    web_search_available: isWebSearchAvailable(),
                },
            };
        }

        // Stage 3: Normalize & persist
        // For web search results, each post has _source_platform (reddit, quora, web, etc.)
        // which takes precedence. The sourceLabel is only the fallback for untagged posts.
        const documentRows = toDocumentRows(rawPosts, clientId, run.id, { sourceLabel: collectionSource === 'web_search' ? 'web_search' : 'reddit' });
        const { persisted, skipped } = await upsertDocuments(documentRows);

        await updateCollectionRun(run.id, {
            documents_collected: rawPosts.length,
            documents_persisted: persisted,
            documents_skipped: skipped,
            ...(collectionSource !== 'reddit' ? { source: collectionSource } : {}),
        });

        // Build relevance anchors from client context
        const relevanceAnchors = buildRelevanceAnchors(client);

        // Stage 4: Enrich — extract mentions from unprocessed documents
        // Intentionally omits the source filter to process documents from both reddit
        // and web_search sources. The mention extraction and clustering logic is
        // source-agnostic — it operates on title/body text regardless of origin.
        const unprocessed = await listDocuments(clientId, { unprocessedOnly: true });
        let mentions;
        let enrichmentMethod = 'keyword';

        // LLM enrichment with validation safeguards
        if (COMMUNITY_USE_LLM_ENRICHMENT && unprocessed.length > 0) {
            const docCount = unprocessed.length;
            const estimatedBatches = Math.ceil(docCount / LLM_ENRICHMENT_BATCH_SIZE);
            console.warn(`[Community] LLM enrichment enabled — processing ${docCount} docs in ${estimatedBatches} batches for client ${clientId}`);

            try {
                const llmStart = Date.now();
                mentions = await extractMentionsWithLLM(unprocessed, clientId, client);
                const llmDuration = Date.now() - llmStart;

                // Validation: check that LLM produced reasonable output
                if (mentions.length === 0 && docCount > 0) {
                    console.warn(`[Community] LLM enrichment returned 0 mentions for ${docCount} docs — falling back to keyword`);
                    mentions = extractMentionsFromDocuments(unprocessed, clientId, relevanceAnchors);
                } else {
                    enrichmentMethod = 'llm';
                    console.warn(`[Community] LLM enrichment completed: ${mentions.length} mentions in ${llmDuration}ms`);
                }
            } catch (llmErr) {
                console.warn('[Community] LLM enrichment failed, falling back to keyword extraction:', llmErr?.message);
                mentions = extractMentionsFromDocuments(unprocessed, clientId, relevanceAnchors);
            }
        } else {
            mentions = extractMentionsFromDocuments(unprocessed, clientId, relevanceAnchors);
        }

        if (mentions.length > 0) {
            // Clear old mentions for these documents before re-inserting
            const docIds = unprocessed.map((d) => d.id);
            await deleteMentionsForDocuments(docIds);
            await insertMentions(mentions);
            await markDocumentsProcessed(docIds);
        }

        // Stage 5: Cluster — rebuild clusters from all mentions
        const allMentions = await listMentionsForClustering(clientId);
        await clearClusters(clientId);

        // Build scoring context for composite score v2
        const clientCity = String(client?.address?.city || client?.target_region || '').trim();
        const businessDesc = String(client?.business_type || '').trim();
        const scoringContext = {
            anchors: relevanceAnchors,
            mandate,
            businessDesc,
            city: clientCity,
        };

        const clusters = aggregateMentionsToClusters(allMentions, clientId, relevanceAnchors, scoringContext);
        const persistedClusters = clusters.length > 0 ? await upsertClusters(clusters) : [];

        // Stage 5.5: Optional — normalize cluster labels via LLM
        if (COMMUNITY_USE_LLM_ENRICHMENT && persistedClusters.length > 0) {
            try {
                const labelResult = await executeTask('community-labels', {
                    clusters: persistedClusters.map((c) => ({
                        label: c.label,
                        cluster_type: c.cluster_type,
                        mention_count: c.mention_count,
                    })),
                }, { clientId, triggerSource: 'pipeline' });

                if (labelResult.data && Array.isArray(labelResult.data)) {
                    const labelMap = new Map(labelResult.data.map((l) => [l.original, l]));
                    for (const cluster of persistedClusters) {
                        const normalized = labelMap.get(cluster.label);
                        if (normalized && normalized.normalized && !normalized.is_duplicate_of) {
                            cluster.label = normalized.normalized;
                        }
                    }
                }
            } catch (labelErr) {
                console.warn('[Community] Cluster label normalization failed (non-blocking):', labelErr?.message);
            }
        }

        // Stage 6: Derive opportunities
        let opportunities;

        if (COMMUNITY_USE_LLM_ENRICHMENT && persistedClusters.length > 0) {
            try {
                const synthResult = await executeTask('community-synthesize', {
                    clientId,
                    clientName: client?.client_name || '',
                    businessType: client?.business_type || '',
                    mandateContext: {
                        goals: mandate.goals,
                        monitored_topics: mandate.monitored_topics,
                        target_customer_description: mandate.target_customer_description,
                        businessDesc,
                        city: clientCity,
                    },
                    clusters: persistedClusters.map((c) => ({
                        label: c.label,
                        cluster_type: c.cluster_type,
                        mention_count: c.mention_count,
                        sources: c.sources || [],
                        signal_families: c.metadata?.signal_families || [],
                    })),
                }, { clientId, triggerSource: 'pipeline' });

                if (synthResult.data && Array.isArray(synthResult.data)) {
                    opportunities = synthResult.data
                        .filter((opp) => {
                            // Quality gate: reject weak-evidence opportunities from LLM
                            const headline = String(opp.headline || '').trim();
                            return headline.length >= 5;
                        })
                        .map((opp) => {
                            const matchedCluster = persistedClusters.find((c) => c.label === opp.cluster_label);
                            return {
                                client_id: clientId,
                                opportunity_type: opp.opportunity_type,
                                title: opp.headline,
                                rationale: opp.rationale,
                                evidence_level: opp.evidence_strength === 'strong' ? 'strong' : opp.evidence_strength === 'moderate' ? 'medium' : 'low',
                                mention_count: matchedCluster?.mention_count || 0,
                                provenance: 'inferred',
                                source_cluster_id: matchedCluster?.id || null,
                                status: 'open',
                                metadata: {
                                    why_it_matters: opp.why_it_matters || opp.rationale || null,
                                    suggested_action: opp.suggested_action || null,
                                    source_url: matchedCluster?.example_url || null,
                                    signal_family: matchedCluster?.metadata?.signal_families?.[0] || null,
                                    composite_score: matchedCluster?.score || 0,
                                    score_dimensions: matchedCluster?.metadata?.score_dimensions || null,
                                    signal_families: matchedCluster?.metadata?.signal_families || [],
                                    synthesis_source: 'llm',
                                },
                            };
                        });
                } else {
                    opportunities = deriveOpportunitiesFromClusters(persistedClusters, clientId, relevanceAnchors);
                }
            } catch (synthErr) {
                console.warn('[Community] Opportunity synthesis failed, falling back to rule-based:', synthErr?.message);
                opportunities = deriveOpportunitiesFromClusters(persistedClusters, clientId, relevanceAnchors);
            }
        } else {
            opportunities = deriveOpportunitiesFromClusters(persistedClusters, clientId, relevanceAnchors);
        }

        if (opportunities.length > 0) {
            await upsertOpportunities(opportunities);

            // Bridge: insert/update into main opportunities table so they appear
            // in the operator action queue (GeoAmeliorerView / File d'actions).
            // Dedup: use title + client_id + source=community to avoid duplicates.
            const mainOpps = opportunities.map((o) => ({
                client_id: o.client_id,
                title: o.title,
                description: o.rationale || '',
                category: o.opportunity_type || 'community',
                priority: o.evidence_level === 'strong' ? 'high' : o.evidence_level === 'medium' ? 'medium' : 'low',
                status: 'open',
                source: 'community',
                confidence: o.evidence_level || 'low',
                truth_class: o.provenance || 'inferred',
            }));

            // Fetch existing community opportunities for this client to avoid fire-and-forget duplication
            try {
                const existingOpps = await dbGetOpportunitiesBySource(clientId, 'community').catch(() => []);
                const existingTitles = new Set((existingOpps || []).map((e) => e.title));
                const newOpps = mainOpps.filter((o) => !existingTitles.has(o.title));

                if (newOpps.length > 0) {
                    await dbCreateOpportunities(newOpps).catch((bridgeErr) => {
                        console.error('[Community→Opportunities bridge] Failed to insert into main opportunities table:', bridgeErr?.message);
                    });
                }
            } catch {
                // Fallback: if dedup check fails, insert all (backward compatible)
                await dbCreateOpportunities(mainOpps).catch((bridgeErr) => {
                    console.error('[Community→Opportunities bridge] Failed to insert into main opportunities table:', bridgeErr?.message);
                });
            }
        }

        // Finalize run — include collection outcome classification
        const finalOutcome = collectionOutcome.failureClass
            ? { failure_class: collectionOutcome.failureClass, collection_diagnosis: buildCollectionDiagnosis(collectionOutcome.failureClass, collectionOutcome.summary) }
            : {};
        await updateCollectionRun(run.id, {
            status: 'completed',
            finished_at: new Date().toISOString(),
            run_context: {
                mentions_extracted: mentions.length,
                clusters_built: persistedClusters.length,
                opportunities_derived: opportunities.length,
                enrichment_method: enrichmentMethod,
                collection_source: collectionSource,
                web_search_provider: webSearchProvider,
                seed_diagnostics: seedDiagnostics,
                mandate_configured: mandate.goals.length > 0 || mandate.known_competitors.length > 0,
                seed_strategies_used: [...new Set(seedQueries.map((s) => typeof s === 'string' ? 'legacy' : s.strategy))],
                ...finalOutcome,
            },
        });

        return {
            success: true,
            error: null,
            summary: {
                documents_collected: rawPosts.length,
                documents_persisted: persisted,
                documents_skipped: skipped,
                mentions_extracted: mentions.length,
                clusters_built: persistedClusters.length,
                opportunities_derived: opportunities.length,
                seed_diagnostics: seedDiagnostics,
                failure_class: collectionOutcome.failureClass || null,
                collection_source: collectionSource,
                web_search_provider: webSearchProvider,
            },
        };
    } catch (err) {
        await updateCollectionRun(run.id, {
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: err?.message || 'Pipeline execution failed',
        }).catch(() => {});

        return {
            success: false,
            error: err?.message || 'Pipeline execution failed',
            summary: {},
        };
    }
}

// ──────────────────────────────────────────────────────────────
// Internal helper — fetch all mentions for re-clustering
// ──────────────────────────────────────────────────────────────

async function listMentionsForClustering(clientId) {
    const { getAdminSupabase } = await import('@/lib/supabase-admin');
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('community_mentions')
        .select('mention_type, label, snippet, source')
        .eq('client_id', clientId);
    if (error) throw new Error(`[Community] listMentionsForClustering: ${error.message}`);
    return data || [];
}
