import 'server-only';

import { z } from 'zod';

// ──────────────────────────────────────────────────────────────
// Domain constants
// ──────────────────────────────────────────────────────────────

export const COMMUNITY_SOURCES = ['reddit', 'web', 'github', 'x', 'youtube'];
export const COMMUNITY_RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'partial'];
export const COMMUNITY_MENTION_TYPES = ['complaint', 'question', 'theme', 'competitor', 'recommendation', 'opportunity', 'language'];
export const COMMUNITY_CLUSTER_TYPES = ['complaint', 'question', 'theme', 'competitor_complaint', 'language', 'source_bucket'];
export const COMMUNITY_OPPORTUNITY_TYPES = ['faq', 'content', 'differentiation', 'positioning', 'response', 'recurring_buyer_question', 'comparison_discussion', 'recurring_pain_point', 'response_opportunity', 'ai_mention_opportunity', 'content_opportunity'];
export const COMMUNITY_OPPORTUNITY_STATUSES = ['open', 'acted', 'dismissed', 'expired'];
export const COMMUNITY_EVIDENCE_LEVELS = ['low', 'medium', 'strong'];
export const COMMUNITY_PROVENANCE_LEVELS = ['observed', 'derived', 'inferred'];

// ──────────────────────────────────────────────────────────────
// Signal families v2 — operator-actionable intent categories
// Each family maps to a clear operator use case.
// ──────────────────────────────────────────────────────────────

export const SIGNAL_FAMILIES = {
    buyer_question: {
        id: 'buyer_question',
        label: 'Question acheteur',
        description: 'Prospects asking how to solve a problem or choose a provider.',
        operator_use: 'Respond directly, demonstrate expertise, capture lead.',
        mention_types: ['question'],
        keywords: ['how', 'comment', 'which', 'quel', 'best', 'meilleur', 'recommend', 'recommand', 'suggest', 'conseill', 'looking for', 'cherche', 'need', 'besoin'],
    },
    comparison_intent: {
        id: 'comparison_intent',
        label: 'Intention de comparaison',
        description: 'Users comparing tools, providers, or approaches.',
        operator_use: 'Position against competitors, create comparison content.',
        mention_types: ['competitor', 'question'],
        keywords: ['vs', 'versus', 'compare', 'comparer', 'alternative', 'instead', 'plutot', 'difference', 'mieux', 'better'],
    },
    best_tool_intent: {
        id: 'best_tool_intent',
        label: 'Recherche d\'outil',
        description: 'Users searching for the best tool or solution in a category.',
        operator_use: 'Appear in recommendation threads, create "best of" content.',
        mention_types: ['question', 'recommendation'],
        keywords: ['best', 'meilleur', 'top', 'tool', 'outil', 'software', 'logiciel', 'platform', 'plateforme', 'solution', 'app'],
    },
    pain_point: {
        id: 'pain_point',
        label: 'Point de douleur',
        description: 'Users expressing frustration with existing solutions.',
        operator_use: 'Address unmet needs, build content around pain relief.',
        mention_types: ['complaint'],
        keywords: ['frustrat', 'annoying', 'terrible', 'horrible', 'worst', 'pire', 'problem', 'probleme', 'issue', 'broken', 'casse', 'fail', 'echec', 'hate', 'deteste'],
    },
    competitor_weakness: {
        id: 'competitor_weakness',
        label: 'Faiblesse concurrent',
        description: 'Users complaining about competitors or their limitations.',
        operator_use: 'Differentiate on competitor weaknesses, create switching content.',
        mention_types: ['competitor', 'complaint'],
        keywords: ['expensive', 'cher', 'slow', 'lent', 'bad support', 'support nul', 'missing', 'manque', 'limited', 'limite', 'buggy', 'crash'],
    },
    response_opportunity: {
        id: 'response_opportunity',
        label: 'Opportunité de réponse',
        description: 'Active threads where a direct expert response would add value.',
        operator_use: 'Post a helpful reply, build authority and visibility.',
        mention_types: ['question', 'complaint'],
        keywords: ['help', 'aide', 'anyone', 'quelqu', 'advice', 'conseil', 'experience', 'recommendation', 'recommandation'],
    },
    ai_mention_opportunity: {
        id: 'ai_mention_opportunity',
        label: 'Opportunité mention IA',
        description: 'Discussions about AI tools, AI Overviews, or LLM-generated content where the brand could appear.',
        operator_use: 'Optimize for AI citation, create AI-referenceable content.',
        mention_types: ['theme', 'question'],
        keywords: ['ai', 'ia', 'chatgpt', 'gpt', 'gemini', 'claude', 'llm', 'ai overview', 'ai overviews', 'generated', 'genere', 'citation', 'cite', 'artificial intelligence', 'intelligence artificielle'],
    },
};

export const SIGNAL_FAMILY_IDS = Object.keys(SIGNAL_FAMILIES);

// ──────────────────────────────────────────────────────────────
// Quality constants — false positive control
// ──────────────────────────────────────────────────────────────

// Minimum keyword matches before a signal family is assigned.
// This prevents single weak keyword matches from tagging a family.
export const MIN_KEYWORD_MATCHES_FOR_SIGNAL = 2;

// Short keywords that MUST use word-boundary matching to avoid
// false positives inside longer words (e.g. "ai" in "maintain").
export const BOUNDARY_REQUIRED_KEYWORDS = new Set([
    'ai', 'ia', 'vs', 'app', 'bad', 'bug', 'help', 'aide', 'need', 'best',
    'top', 'cher', 'lent', 'cite', 'per', 'slow',
]);

// Strong complaint terms — a single match is sufficient evidence
export const STRONG_COMPLAINT_TERMS = [
    'frustrat', 'terrible', 'horrible', 'worst', 'pire', 'hate', 'deteste',
    'scam', 'arnaque', 'broken', 'casse', 'refund', 'cancel',
];

// Weak complaint terms — require ≥2 matches or co-occurrence with a strong term
export const WEAK_COMPLAINT_TERMS = [
    'slow', 'expensive', 'problem', 'issue', 'bad', 'delay', 'bug',
    'support', 'spam', 'cher', 'lent', 'probleme', 'decu', 'mauvais', 'retard',
];

// Negation prefixes — when found before a term, the term is not a true signal
export const NEGATION_PATTERNS = [
    'no ', 'not ', 'never ', 'without ', 'dont ', "don't ", "isn't ", 'isnt ',
    'pas de ', 'pas un ', 'aucun ', 'sans ', 'jamais ',
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

// Word boundary character class used by matchesKeyword
const WORD_BOUNDARY_CHARS = '[\\s.,;:!?()\\[\\]"\'\/\\-]';

/**
 * Word-boundary-aware keyword matching.
 * Short keywords (in BOUNDARY_REQUIRED_KEYWORDS) are matched with word boundaries
 * to prevent false positives like "ai" inside "maintain".
 * Longer keywords use substring matching (original behavior).
 */
export function matchesKeyword(text, keyword) {
    if (BOUNDARY_REQUIRED_KEYWORDS.has(keyword)) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(?:^|${WORD_BOUNDARY_CHARS})${escaped}(?:$|${WORD_BOUNDARY_CHARS})`, 'i');
        return pattern.test(` ${text} `);
    }
    return text.includes(keyword);
}

/**
 * Checks if a term appears in text in a negated context.
 * Returns true if the term is preceded by a negation prefix within a 20-char window.
 */
export function isNegated(text, term) {
    const idx = text.indexOf(term);
    if (idx < 0) return false;
    const prefix = text.slice(Math.max(0, idx - 20), idx).toLowerCase();
    return NEGATION_PATTERNS.some((neg) => prefix.includes(neg.trim()));
}

export function evidenceLevel(count) {
    if (count >= 8) return 'strong';
    if (count >= 4) return 'medium';
    return 'low';
}

// ──────────────────────────────────────────────────────────────
// Composite scoring model v2
// Each dimension is 0–1, weighted and summed to a final score 0–100.
// Weights are intentionally explainable and tunable.
// ──────────────────────────────────────────────────────────────

// Weights MUST sum to 1.0 for the 0-100 range to be meaningful.
// If tuning individual weights, ensure the total remains 1.0.
export const SCORING_WEIGHTS = {
    business_relevance:      0.20, // Does this mention match the client's domain?
    geographic_proximity:    0.10, // Is there a geographic match?
    problem_intensity:       0.15, // How strong is the pain signal?
    buying_intent:           0.15, // Is the user actively looking to buy/switch?
    comparison_intent:       0.10, // Is this a comparison or "vs" discussion?
    execution_potential:     0.10, // Can the operator realistically act on this?
    ai_reusability:          0.05, // Can this feed AI content or citations?
    spam_risk_penalty:       0.10, // Negative: low-quality or spammy signal
    frequency:               0.05, // Raw mention count signal
};

const SPAM_INDICATORS = ['crypto', 'nft', 'onlyfans', 'casino', 'forex', 'earn money', 'gagner argent', 'free money', 'passive income', 'revenu passif', 'dropship'];

/**
 * Computes a composite score (0–100) for a cluster based on multiple dimensions.
 * Each dimension is normalized to 0–1 before weighting.
 *
 * @param {object} cluster - The cluster object with label, mention_count, cluster_type, metadata, sources
 * @param {object} context - { anchors, mandate, businessDesc, city }
 * @returns {{ score: number, dimensions: object }}
 */
export function computeCompositeScore(cluster, context = {}) {
    const { anchors, city = '' } = context;
    const label = String(cluster.label || '').toLowerCase();
    const snippet = String(cluster.example_snippet || '').toLowerCase();
    const combined = `${label} ${snippet}`;
    const mentionCount = cluster.mention_count || 0;

    // 1. Business relevance: how many anchor tokens appear in the label
    let businessRelevance = 0;
    if (anchors?.size) {
        let matches = 0;
        for (const anchor of anchors) {
            if (label.includes(anchor)) matches++;
        }
        businessRelevance = Math.min(matches / 3, 1);
    }

    // 2. Geographic proximity: does the label/snippet mention the city
    const cityNorm = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const geoProximity = cityNorm && combined.includes(cityNorm) ? 1 : 0;

    // 3. Problem intensity: presence of strong complaint/pain language
    const painTerms = ['frustrat', 'terrible', 'horrible', 'worst', 'pire', 'broken', 'casse', 'fail', 'echec', 'hate', 'deteste', 'scam', 'arnaque'];
    const painMatches = painTerms.filter((t) => combined.includes(t)).length;
    const problemIntensity = Math.min(painMatches / 2, 1);

    // 4. Buying intent: signals of active purchase consideration
    const buyTerms = ['recommend', 'recommand', 'looking for', 'cherche', 'need', 'besoin', 'best', 'meilleur', 'budget', 'pricing', 'prix', 'tarif', 'devis', 'quote', 'hire', 'embaucher'];
    const buyMatches = buyTerms.filter((t) => combined.includes(t)).length;
    const buyingIntent = Math.min(buyMatches / 2, 1);

    // 5. Comparison intent
    const compTerms = ['vs', 'versus', 'alternative', 'compare', 'comparer', 'instead', 'plutot', 'difference', 'mieux que', 'better than'];
    const compMatches = compTerms.filter((t) => combined.includes(t)).length;
    const comparisonIntent = Math.min(compMatches / 1.5, 1);

    // 6. Execution potential: can operator realistically act? (questions/complaints = high, themes = medium)
    const executionMap = { question: 0.9, complaint: 0.7, competitor_complaint: 0.8, theme: 0.4, language: 0.3, source_bucket: 0.1 };
    const executionPotential = executionMap[cluster.cluster_type] || 0.3;

    // 7. AI reusability: mentions of AI, LLMs, or citation-related terms
    const aiTerms = ['ai', 'ia', 'llm', 'gpt', 'chatgpt', 'gemini', 'claude', 'ai overview', 'citation', 'generative'];
    const aiMatches = aiTerms.filter((t) => combined.includes(t)).length;
    const aiReusability = Math.min(aiMatches / 2, 1);

    // 8. Spam risk: negative signal
    const spamMatches = SPAM_INDICATORS.filter((t) => combined.includes(t)).length;
    const spamRisk = Math.min(spamMatches / 1.5, 1);

    // 9. Frequency: log-scaled mention count
    const frequency = Math.min(Math.log2(mentionCount + 1) / 5, 1);

    // Combine weighted dimensions
    const raw =
        SCORING_WEIGHTS.business_relevance * businessRelevance +
        SCORING_WEIGHTS.geographic_proximity * geoProximity +
        SCORING_WEIGHTS.problem_intensity * problemIntensity +
        SCORING_WEIGHTS.buying_intent * buyingIntent +
        SCORING_WEIGHTS.comparison_intent * comparisonIntent +
        SCORING_WEIGHTS.execution_potential * executionPotential +
        SCORING_WEIGHTS.ai_reusability * aiReusability -
        SCORING_WEIGHTS.spam_risk_penalty * spamRisk +
        SCORING_WEIGHTS.frequency * frequency;

    // Niche boost: for businesses with few mentions, lower the denominator expectation.
    // +0.08 ≈ +8 points on the 100-point scale — enough to prevent niche signals from
    // being drowned out by execution_potential alone, without over-inflating weak signals.
    const nicheBoost = mentionCount <= 3 && businessRelevance >= 0.5 ? 0.08 : 0;

    const score = Math.round(Math.max(0, Math.min(100, (raw + nicheBoost) * 100)));

    return {
        score,
        dimensions: {
            business_relevance: Math.round(businessRelevance * 100) / 100,
            geographic_proximity: geoProximity,
            problem_intensity: Math.round(problemIntensity * 100) / 100,
            buying_intent: Math.round(buyingIntent * 100) / 100,
            comparison_intent: Math.round(comparisonIntent * 100) / 100,
            execution_potential: Math.round(executionPotential * 100) / 100,
            ai_reusability: Math.round(aiReusability * 100) / 100,
            spam_risk: Math.round(spamRisk * 100) / 100,
            frequency: Math.round(frequency * 100) / 100,
        },
    };
}

// ──────────────────────────────────────────────────────────────
// Zod schemas — collection run
// ──────────────────────────────────────────────────────────────

export const communityCollectionRunSchema = z.object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid(),
    source: z.enum(COMMUNITY_SOURCES),
    status: z.enum(COMMUNITY_RUN_STATUSES).default('pending'),
    started_at: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    documents_collected: z.number().int().default(0),
    documents_persisted: z.number().int().default(0),
    documents_skipped: z.number().int().default(0),
    error_message: z.string().nullable().optional(),
    seed_queries: z.array(z.string()).default([]),
    run_context: z.record(z.any()).default({}),
    trigger_source: z.enum(['cron', 'manual', 'retry', 'system']).default('system'),
});

// ──────────────────────────────────────────────────────────────
// Zod schemas — community document (raw + normalized)
// ──────────────────────────────────────────────────────────────

export const communityDocumentSchema = z.object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid(),
    collection_run_id: z.string().uuid().nullable().optional(),
    source: z.enum(COMMUNITY_SOURCES),
    external_id: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    published_at: z.string().nullable().optional(),
    source_metadata: z.record(z.any()).default({}),
    normalized_content: z.string().nullable().optional(),
    language: z.string().default('fr'),
    engagement_score: z.number().int().default(0),
    seed_query: z.string().nullable().optional(),
    dedupe_hash: z.string().nullable().optional(),
    is_processed: z.boolean().default(false),
});

// ──────────────────────────────────────────────────────────────
// Zod schemas — mention
// ──────────────────────────────────────────────────────────────

export const communityMentionSchema = z.object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid(),
    document_id: z.string().uuid(),
    mention_type: z.enum(COMMUNITY_MENTION_TYPES),
    label: z.string(),
    snippet: z.string().nullable().optional(),
    evidence_level: z.enum(COMMUNITY_EVIDENCE_LEVELS).default('low'),
    provenance: z.enum(COMMUNITY_PROVENANCE_LEVELS).default('observed'),
    source: z.enum(COMMUNITY_SOURCES),
});

// ──────────────────────────────────────────────────────────────
// Zod schemas — cluster
// ──────────────────────────────────────────────────────────────

export const communityClusterSchema = z.object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid(),
    cluster_type: z.enum(COMMUNITY_CLUSTER_TYPES),
    label: z.string(),
    mention_count: z.number().int().default(0),
    evidence_level: z.enum(COMMUNITY_EVIDENCE_LEVELS).default('low'),
    sources: z.array(z.string()).default([]),
    example_url: z.string().nullable().optional(),
    example_snippet: z.string().nullable().optional(),
    last_seen_at: z.string().nullable().optional(),
    score: z.number().default(0),
    metadata: z.record(z.any()).default({}),
});

// ──────────────────────────────────────────────────────────────
// Zod schemas — opportunity
// ──────────────────────────────────────────────────────────────

export const communityOpportunitySchema = z.object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid(),
    opportunity_type: z.enum(COMMUNITY_OPPORTUNITY_TYPES),
    title: z.string(),
    rationale: z.string().nullable().optional(),
    evidence_level: z.enum(COMMUNITY_EVIDENCE_LEVELS).default('low'),
    mention_count: z.number().int().default(0),
    provenance: z.enum(COMMUNITY_PROVENANCE_LEVELS).default('inferred'),
    source_cluster_id: z.string().uuid().nullable().optional(),
    status: z.enum(COMMUNITY_OPPORTUNITY_STATUSES).default('open'),
    metadata: z.record(z.any()).default({}),
    // v2 fields — stored in metadata for backward compatibility
    // metadata.why_it_matters: string — operator-facing explanation
    // metadata.suggested_action: string — concrete next step
    // metadata.source_url: string — evidence source URL
    // metadata.signal_family: string — originating signal family
    // metadata.composite_score: number — v2 composite score 0-100
    // metadata.score_dimensions: object — scoring breakdown
});

// ──────────────────────────────────────────────────────────────
// Connection status contract
// ──────────────────────────────────────────────────────────────

export const COMMUNITY_CONNECTION_STATES = ['not_connected', 'connected_empty', 'syncing', 'error', 'active'];

export const communityConnectionStatusSchema = z.object({
    status: z.enum(COMMUNITY_CONNECTION_STATES),
    connector: z.string().default('agent_reach'),
    last_synced_at: z.string().nullable().optional(),
    next_sync_at: z.string().nullable().optional(),
    message: z.string().optional(),
    caveat: z.string().nullable().optional(),
    detail: z.string().nullable().optional(),
});
