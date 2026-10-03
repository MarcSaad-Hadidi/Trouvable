export const TRUTH_ENGINE_VERSION = 'v1';

export const TRUTH_CLASSES = ['observed', 'derived', 'inferred', 'uncertain', 'recommended'];
export const CONFIDENCE_BANDS = ['low', 'medium', 'high'];
export const REVIEW_STATUSES = ['auto_accepted', 'needs_review', 'reviewed_confirmed', 'reviewed_rejected', 'blocked'];

export const PROBLEM_FAMILIES = ['identity', 'locality', 'schema', 'technical_seo', 'content', 'trust', 'competitor', 'citation', 'query_coverage', 'operations'];
export const PROBLEM_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const PROBLEM_IMPACTS = ['discoverability', 'recommendability', 'answerability', 'credibility', 'conversion', 'operability'];
export const PROBLEM_SURFACES = ['site', 'page', 'profile', 'query_run', 'query_set', 'citation', 'competitor_landscape', 'continuous_job', 'portal'];
export const PROBLEM_FIXABILITY = ['quick_win', 'standard', 'heavy_lift', 'operator_only', 'non_actionable'];

export function uniqueTruthyStrings(values = []) {
    return [...new Set(
        (values || [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    )];
}

export function slugifyTruthKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 96);
}

export function normalizeTruthClass(value, fallback = 'uncertain') {
    const normalized = String(value || '').trim().toLowerCase();
    if (TRUTH_CLASSES.includes(normalized)) return normalized;
    if (normalized === 'not_connected' || normalized === 'non_verifiable' || normalized === 'non-verifiable') return 'uncertain';
    if (normalized === 'weak') return 'uncertain';
    if (normalized === 'strong') return 'observed';
    return TRUTH_CLASSES.includes(fallback) ? fallback : 'uncertain';
}

export function normalizeConfidenceBand(value, fallback = 'medium') {
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (value >= 0.75) return 'high';
        if (value >= 0.45) return 'medium';
        return 'low';
    }

    const normalized = String(value || '').trim().toLowerCase();
    if (CONFIDENCE_BANDS.includes(normalized)) return normalized;
    if (normalized === 'strong') return 'high';
    if (normalized === 'weak' || normalized === 'unclear') return 'low';
    if (normalized === 'moderate') return 'medium';
    return CONFIDENCE_BANDS.includes(fallback) ? fallback : 'medium';
}

export function defaultReviewStatusForTruthClass(truthClass) {
    const normalized = normalizeTruthClass(truthClass);
    if (normalized === 'uncertain') return 'blocked';
    if (normalized === 'inferred' || normalized === 'recommended') return 'needs_review';
    return 'auto_accepted';
}

export function normalizeReviewStatus(value, fallback = null) {
    const normalized = String(value || '').trim().toLowerCase();
    if (REVIEW_STATUSES.includes(normalized)) return normalized;
    if (normalized === 'review_required' || normalized === 'pending_review') return 'needs_review';
    if (normalized === 'accepted' || normalized === 'confirmed') return 'reviewed_confirmed';
    if (normalized === 'rejected' || normalized === 'dismissed') return 'reviewed_rejected';
    if (fallback) return normalizeReviewStatus(fallback);
    return 'needs_review';
}