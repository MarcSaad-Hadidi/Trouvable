/**
 * AGENT score — Phase 3.
 *
 * Pure derivation module. No IO. Computed on read from already-derived slice
 * outputs (overview, readiness, actionability report, protocols report). The
 * score is NEVER persisted; do not add writes in this file.
 *
 * Weights (from approved brief):
 *   visibility          0.40
 *   readiness           0.30
 *   actionability       0.25
 *   advanced_protocols  0.05
 *
 * All four inputs are live-computed from Phase 3 onwards. Any missing input
 * is renormalized out of the weighted mean and the resulting agent_score is
 * flagged `provisional: true` whenever at least one input is null.
 */

export const AGENT_SCORE_WEIGHTS = Object.freeze({
    visibility: 0.4,
    readiness: 0.3,
    actionability: 0.25,
    advanced_protocols: 0.05,
});

const SUBSCORE_KEYS = ['visibility', 'readiness', 'actionability', 'advanced_protocols'];

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function clampScore(value) {
    if (!isFiniteNumber(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedMeanOverDefined(subscores) {
    let weightSum = 0;
    let weightedTotal = 0;

    for (const key of SUBSCORE_KEYS) {
        const entry = subscores[key];
        if (!entry || !isFiniteNumber(entry.score)) continue;
        const weight = AGENT_SCORE_WEIGHTS[key];
        weightSum += weight;
        weightedTotal += entry.score * weight;
    }

    if (weightSum === 0) return null;
    return Math.round(weightedTotal / weightSum);
}

function hoursSince(iso) {
    if (!iso) return null;
    const parsed = new Date(iso).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.floor((Date.now() - parsed) / 3600000);
}

function verdictForScore(score) {
    if (!isFiniteNumber(score)) return 'unavailable';
    if (score >= 75) return 'bon';
    if (score >= 50) return 'a_consolider';
    return 'a_reprendre';
}

function deriveConfidence({ visibility, readiness, visibilityReliability, lastAuditAt }) {
    const visibilityAvailable = Boolean(visibility && isFiniteNumber(visibility.score));
    const readinessAvailable = Boolean(readiness && isFiniteNumber(readiness.score));

    if (!visibilityAvailable && !readinessAvailable) return 'unavailable';

    const auditAgeHours = hoursSince(lastAuditAt);
    const auditTooOld = auditAgeHours !== null && auditAgeHours > 24 * 30;
    const auditStale = auditAgeHours !== null && auditAgeHours > 24 * 14;
    const onlyOneAvailable = visibilityAvailable !== readinessAvailable;

    if (onlyOneAvailable) return 'low';
    if (visibilityReliability === 'low' || auditTooOld) return 'low';
    if (visibilityReliability === 'high' && !auditStale) return 'high';
    return 'medium';
}

function buildSubscore({ key, score, reliability = null, provisional = false, reason = null }) {
    const clampedScore = isFiniteNumber(score) ? clampScore(score) : null;
    const effectiveProvisional = clampedScore === null ? true : provisional;
    const effectiveReason = clampedScore === null ? reason : null;
    return {
        key,
        weight: AGENT_SCORE_WEIGHTS[key],
        score: clampedScore,
        reliability,
        provisional: effectiveProvisional,
        reason: effectiveReason,
    };
}

/**
 * Compute the AGENT score from four sub-score inputs.
 *
 * @param {object} params
 * @param {{ score: number|null, reliability?: string|null }|null} params.visibility
 * @param {{ score: number|null, reliability?: string|null }|null} params.readiness
 * @param {{ score: number|null, reliability?: string|null }|null} [params.actionability]
 * @param {{ score: number|null, reliability?: string|null }|null} [params.advancedProtocols]
 * @param {{ lastAuditAt?: string|null }} [params.context]
 * @returns {{
 *   agent_score: number|null,
 *   weights: typeof AGENT_SCORE_WEIGHTS,
 *   subscores: { visibility: object, readiness: object, actionability: object, advanced_protocols: object },
 *   provisional: boolean,
 *   confidence: 'high'|'medium'|'low'|'unavailable',
 *   verdict: 'bon'|'a_consolider'|'a_reprendre'|'unavailable'
 * }}
 */
export function computeAgentScore(params = {}) {
    const {
        visibility = null,
        readiness = null,
        actionability = null,
        advancedProtocols = null,
        context = {},
    } = params || {};

    const subscores = {
        visibility: buildSubscore({
            key: 'visibility',
            score: visibility?.score,
            reliability: visibility?.reliability ?? null,
        }),
        readiness: buildSubscore({
            key: 'readiness',
            score: readiness?.score,
            reliability: readiness?.reliability ?? null,
        }),
        actionability: buildSubscore({
            key: 'actionability',
            score: actionability?.score ?? null,
            reliability: actionability?.reliability ?? null,
            provisional: false,
            reason: 'Non calculé — aucun audit disponible.',
        }),
        advanced_protocols: buildSubscore({
            key: 'advanced_protocols',
            score: advancedProtocols?.score ?? null,
            reliability: advancedProtocols?.reliability ?? null,
            provisional: false,
            reason: 'Non calculé — aucun audit disponible.',
        }),
    };

    const agentScore = weightedMeanOverDefined(subscores);
    const anyNull = SUBSCORE_KEYS.some((key) => !isFiniteNumber(subscores[key].score));
    const confidence = deriveConfidence({
        visibility,
        readiness,
        visibilityReliability: visibility?.reliability ?? null,
        lastAuditAt: context?.lastAuditAt ?? null,
    });

    return {
        agent_score: agentScore,
        weights: AGENT_SCORE_WEIGHTS,
        subscores,
        provisional: anyNull,
        confidence,
        verdict: verdictForScore(agentScore),
    };
}

// ──────────────────────────────────────────────────────────────
// Derivation from slice outputs
// ──────────────────────────────────────────────────────────────

const VISIBILITY_COMPONENT_WEIGHTS = Object.freeze({
    mentionRatePercent: 0.5,
    visibilityProxyPercent: 0.3,
    citationCoveragePercent: 0.2,
});

function deriveVisibilityFromOverview(overviewSlice) {
    if (!overviewSlice) return null;

    const kpis = overviewSlice.kpis || {};
    const sourceStates = overviewSlice.dataSources || {};
    if (
        ['runs', 'mentions', 'trackedQueries', 'totalQueryRuns', 'brandRecommendations'].some(
            (source) => sourceStates[source] === 'unavailable',
        )
    ) {
        return { score: null, reliability: 'unavailable', components: {} };
    }
    const components = {
        mentionRatePercent: isFiniteNumber(kpis.mentionRatePercent) ? kpis.mentionRatePercent : null,
        visibilityProxyPercent: isFiniteNumber(kpis.visibilityProxyPercent) ? kpis.visibilityProxyPercent : null,
        citationCoveragePercent: isFiniteNumber(kpis.citationCoveragePercent) ? kpis.citationCoveragePercent : null,
    };

    let weightSum = 0;
    let total = 0;
    for (const key of Object.keys(components)) {
        const value = components[key];
        if (!isFiniteNumber(value)) continue;
        const weight = VISIBILITY_COMPONENT_WEIGHTS[key];
        weightSum += weight;
        total += value * weight;
    }

    if (weightSum === 0) {
        return {
            score: null,
            reliability: kpis.visibilityProxyReliability || 'unavailable',
            components,
        };
    }

    return {
        score: Math.round(total / weightSum),
        reliability: kpis.visibilityProxyReliability || 'low',
        components,
    };
}

function deriveReadinessFromSlice(readinessSlice) {
    if (!readinessSlice || readinessSlice.available === false) {
        return { score: null, reliability: 'unavailable' };
    }
    const globalScore = readinessSlice?.summary?.globalScore;
    if (!isFiniteNumber(globalScore)) {
        return { score: null, reliability: 'unavailable' };
    }
    return { score: clampScore(globalScore), reliability: 'calculated' };
}

function deriveFromReport(report) {
    if (!report || report.available === false) return null;
    const score = report?.summary?.globalScore;
    if (!isFiniteNumber(score)) return null;
    return {
        score: clampScore(score),
        reliability: report.reliability || 'calculated',
    };
}

/**
 * Derive AGENT sub-score inputs from existing slice payloads.
 * Phase 3: all four inputs are live when their upstream reports are available.
 */
export function deriveAgentInputs({ overviewSlice, readinessSlice, actionabilityReport, protocolsReport } = {}) {
    return {
        visibility: deriveVisibilityFromOverview(overviewSlice),
        readiness: deriveReadinessFromSlice(readinessSlice),
        actionability: deriveFromReport(actionabilityReport),
        advancedProtocols: deriveFromReport(protocolsReport),
        context: {
            lastAuditAt: overviewSlice?.visibility?.lastAuditAt ?? null,
            lastRunAt: overviewSlice?.visibility?.lastGeoRunAt ?? null,
        },
    };
}

export const __internal__ = {
    deriveConfidence,
    weightedMeanOverDefined,
    verdictForScore,
    VISIBILITY_COMPONENT_WEIGHTS,
};
