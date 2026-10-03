import { describe, expect, it } from 'vitest';

import {
    AGENT_SCORE_WEIGHTS,
    computeAgentScore,
    deriveAgentInputs,
    __internal__,
} from '../agent/score.js';

function approx(a, b, tol = 1) {
    return Math.abs(a - b) <= tol;
}

describe('AGENT score weights', () => {
    it('sums to 1.0 across the four sub-scores', () => {
        const sum = Object.values(AGENT_SCORE_WEIGHTS).reduce((acc, w) => acc + w, 0);
        expect(approx(sum, 1.0, 1e-9)).toBe(true);
    });

    it('holds the exact Phase 1 contract weights', () => {
        expect(AGENT_SCORE_WEIGHTS.visibility).toBe(0.40);
        expect(AGENT_SCORE_WEIGHTS.readiness).toBe(0.30);
        expect(AGENT_SCORE_WEIGHTS.actionability).toBe(0.25);
        expect(AGENT_SCORE_WEIGHTS.advanced_protocols).toBe(0.05);
    });
});

describe('computeAgentScore — all inputs present', () => {
    it('computes the full weighted mean', () => {
        const result = computeAgentScore({
            visibility: { score: 80, reliability: 'high' },
            readiness: { score: 60, reliability: 'calculated' },
            actionability: { score: 50, reliability: 'calculated' },
            advancedProtocols: { score: 20, reliability: 'calculated' },
            context: { lastAuditAt: new Date().toISOString() },
        });

        const expected = Math.round(80 * 0.4 + 60 * 0.3 + 50 * 0.25 + 20 * 0.05);
        expect(result.agent_score).toBe(expected);
        expect(result.provisional).toBe(false);
    });
});

describe('computeAgentScore — Phase 1 path (actionability + protocols null)', () => {
    it('renormalizes weights to visibility + readiness only', () => {
        const result = computeAgentScore({
            visibility: { score: 70, reliability: 'high' },
            readiness: { score: 60, reliability: 'calculated' },
            actionability: null,
            advancedProtocols: null,
            context: { lastAuditAt: new Date().toISOString() },
        });

        const expected = Math.round((70 * 0.4 + 60 * 0.3) / (0.4 + 0.3));
        expect(result.agent_score).toBe(expected);
        expect(result.provisional).toBe(true);
        expect(result.subscores.actionability.score).toBe(null);
        expect(result.subscores.actionability.provisional).toBe(true);
        expect(result.subscores.advanced_protocols.score).toBe(null);
        expect(result.subscores.advanced_protocols.provisional).toBe(true);
    });

    it('clamps scores into 0..100 and never returns NaN', () => {
        const result = computeAgentScore({
            visibility: { score: 150, reliability: 'medium' },
            readiness: { score: -20, reliability: 'calculated' },
        });
        expect(result.subscores.visibility.score).toBe(100);
        expect(result.subscores.readiness.score).toBe(0);
        expect(Number.isFinite(result.agent_score)).toBe(true);
    });
});

describe('computeAgentScore — empty / null data', () => {
    it('returns null score and unavailable confidence when all inputs are null', () => {
        const result = computeAgentScore({});
        expect(result.agent_score).toBe(null);
        expect(result.confidence).toBe('unavailable');
        expect(result.verdict).toBe('unavailable');
        expect(result.provisional).toBe(true);
    });

    it('returns score from single available sub-score when the other is null', () => {
        const result = computeAgentScore({
            visibility: { score: 80, reliability: 'medium' },
            readiness: null,
            context: { lastAuditAt: null },
        });
        expect(result.agent_score).toBe(80);
        expect(result.confidence).toBe('low');
        expect(result.provisional).toBe(true);
    });
});

describe('computeAgentScore — confidence tiers', () => {
    it('is high when both sub-scores available, reliability high, audit fresh', () => {
        const result = computeAgentScore({
            visibility: { score: 60, reliability: 'high' },
            readiness: { score: 55, reliability: 'calculated' },
            context: { lastAuditAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
        });
        expect(result.confidence).toBe('high');
    });

    it('is low when audit is older than 30 days', () => {
        const result = computeAgentScore({
            visibility: { score: 60, reliability: 'high' },
            readiness: { score: 55, reliability: 'calculated' },
            context: { lastAuditAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString() },
        });
        expect(result.confidence).toBe('low');
    });

    it('is medium when reliability is medium and audit 14–30 days', () => {
        const result = computeAgentScore({
            visibility: { score: 60, reliability: 'medium' },
            readiness: { score: 55, reliability: 'calculated' },
            context: { lastAuditAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString() },
        });
        expect(result.confidence).toBe('medium');
    });
});

describe('verdictForScore', () => {
    const { verdictForScore } = __internal__;
    it('maps score bands to verdict labels', () => {
        expect(verdictForScore(null)).toBe('unavailable');
        expect(verdictForScore(20)).toBe('a_reprendre');
        expect(verdictForScore(50)).toBe('a_consolider');
        expect(verdictForScore(80)).toBe('bon');
    });
});

describe('deriveAgentInputs', () => {
    it('maps overview + readiness slices to sub-score inputs', () => {
        const overviewSlice = {
            kpis: {
                mentionRatePercent: 40,
                visibilityProxyPercent: 30,
                citationCoveragePercent: 20,
                visibilityProxyReliability: 'medium',
            },
            visibility: { lastAuditAt: '2026-04-10T00:00:00Z', lastGeoRunAt: null },
        };
        const readinessSlice = { available: true, summary: { globalScore: 65 } };

        const inputs = deriveAgentInputs({ overviewSlice, readinessSlice });

        expect(inputs.visibility.score).toBe(Math.round((40 * 0.5 + 30 * 0.3 + 20 * 0.2) / 1.0));
        expect(inputs.visibility.reliability).toBe('medium');
        expect(inputs.readiness.score).toBe(65);
        expect(inputs.actionability).toBe(null);
        expect(inputs.advancedProtocols).toBe(null);
        expect(inputs.context.lastAuditAt).toBe('2026-04-10T00:00:00Z');
    });

    it('returns null visibility score when no components present', () => {
        const inputs = deriveAgentInputs({
            overviewSlice: { kpis: {}, visibility: {} },
            readinessSlice: { available: false },
        });
        expect(inputs.visibility.score).toBe(null);
        expect(inputs.readiness.score).toBe(null);
    });

    it('returns null readiness when slice is unavailable', () => {
        const inputs = deriveAgentInputs({
            overviewSlice: { kpis: { mentionRatePercent: 50 }, visibility: {} },
            readinessSlice: null,
        });
        expect(inputs.readiness.score).toBe(null);
    });
});


describe('visibility required source failures', () => {
    it('keeps an incomplete visibility computation unavailable', () => {
        const result = deriveAgentInputs({ overviewSlice: { dataSources: { mentions: 'unavailable' }, kpis: { mentionRatePercent: 100, visibilityProxyPercent: 80, citationCoveragePercent: null } } });
        expect(result.visibility).toMatchObject({ score: null, reliability: 'unavailable' });
    });
    it('retains visibility when an unrelated opportunities source fails', () => {
        const result = deriveAgentInputs({ overviewSlice: { dataSources: { openOpportunities: 'unavailable' }, kpis: { mentionRatePercent: 0, visibilityProxyPercent: 0, citationCoveragePercent: 0 } } });
        expect(result.visibility.score).toBe(0);
    });
});
