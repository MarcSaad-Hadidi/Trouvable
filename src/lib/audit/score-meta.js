/**
 * Scoring constants, dimension metadata, and shared utility functions.
 * Extracted from score.js so other modules (portal, UI, reports) can import
 * dimension definitions without pulling the full scoring engine.
 */

export const APPLICABILITY_MULTIPLIER = { high: 1, medium: 0.65, low: 0.3 };
export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export const DIMENSION_META = {
    technical_seo: {
        label: 'Technical SEO',
        description: 'Observed crawlability, indexing, metadata, and extractable on-page structure.',
        category: 'technical',
        provenance: 'observed',
    },
    local_readiness: {
        label: 'Local / GEO readiness',
        description: 'Observed local identity, service-area evidence, and local recommendation signals.',
        category: 'geo',
        provenance: 'observed',
    },
    ai_answerability: {
        label: 'AI answerability',
        description: 'Observed clarity, answer-friendly content, and extractable support for AI surfaces.',
        category: 'content',
        provenance: 'derived',
    },
    trust_signals: {
        label: 'Trust signals',
        description: 'Observed proof, credibility, and reassurance signals.',
        category: 'trust',
        provenance: 'observed',
    },
    identity_completeness: {
        label: 'Identity completeness',
        description: 'Observed business identity, contactability, and core business context completeness.',
        category: 'seo',
        provenance: 'observed',
    },
};

export function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

export function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function uniqueStrings(values = []) {
    return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim()))];
}

export function summarize(values = [], limit = 4) {
    return uniqueStrings(values).slice(0, limit).join(', ');
}

export function applicabilityMultiplier(level) {
    return APPLICABILITY_MULTIPLIER[level] ?? APPLICABILITY_MULTIPLIER.high;
}

export function applicabilityLabel(level) {
    if (level === 'high') return 'High relevance';
    if (level === 'medium') return 'Medium relevance';
    return 'Low relevance';
}
