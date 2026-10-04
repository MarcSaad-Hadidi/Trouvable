import 'server-only';
import { resolveBusinessType } from '@/lib/ai/business-type-resolver';

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

const MAX_QUERY_SEEDS = 10;

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

export function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        // Strip diacritics so accented text matches anchors (e.g. Montréal → montreal)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function tokenize(value) {
    return normalizeText(value)
        .split(' ')
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

export function extractBigrams(tokens) {
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
