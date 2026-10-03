/**
 * Core hardening tests — covers the gaps identified during engine finalization:
 * - flattenSnapshotToLegacy shape (no ambiguous keys)
 * - bucketMentionsByType edge cases
 * - deriveAuditMetrics degraded mode (llm_status: failed, skipped)
 * - computeGuardrails combined scenarios
 * - getLatestOpportunities classification logic (extracted)
 * - extraction-v2 competitor/generic deeper separation
 * - citation source confidence & typing
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    bucketMentionsByType,
    buildGeoKpiSnapshot,
    buildLastRunMap,
    computeGuardrails,
    deriveAuditMetrics,
    deriveMentionMetrics,
    derivePromptMetrics,
    deriveRunMetrics,
    flattenSnapshotToLegacy,
} from '../operator-intelligence/kpi-core.js';

import { buildExtractionArtifacts } from '../queries/extraction-v2.js';
import { classifySourceType, computeSourceConfidence } from '../geo-query-utils.js';

// ─── flattenSnapshotToLegacy — shape contract ────────────────────────────────

describe('flattenSnapshotToLegacy — shape contract', () => {
    function makeSnapshot() {
        const audit = deriveAuditMetrics({ seo_score: 80, geo_score: 60, created_at: '2025-06-01', strengths: ['s'], issues: ['i'] });
        const runs = deriveRunMetrics([{ id: 'r1', provider: 'a', model: 'b' }], { totalQueryRuns: 5, brandRecommendations: 2 });
        const mentions = deriveMentionMetrics([], []);
        const prompts = derivePromptMetrics([], new Map());
        return buildGeoKpiSnapshot({ audit, runs, mentions, prompts, counts: { openOpportunities: 1 }, lastRunAt: '2025-06-01' });
    }

    it('does NOT expose confirmedCompetitorMentions key (ambiguity removed)', () => {
        const legacy = flattenSnapshotToLegacy(makeSnapshot(), null);
        expect(legacy).not.toHaveProperty('confirmedCompetitorMentions');
        expect(legacy).toHaveProperty('competitorMentions');
    });

    it('includes all expected scalar KPI keys', () => {
        const legacy = flattenSnapshotToLegacy(makeSnapshot(), { id: 'a1' });
        const expectedKeys = [
            'seoScore', 'geoScore', 'totalQueryRuns', 'openOpportunities',
            'visibilityProxyPercent', 'visibilityProxyReliability',
            'competitorMentions', 'genericMentions', 'sourceMentions',
            'avgParseConfidence', 'parseFailureRate', 'guardrails',
            'trackedPromptStats', 'modelPerformance', 'latestAudit',
        ];
        for (const key of expectedKeys) {
            expect(legacy).toHaveProperty(key);
        }
    });

    it('trackedPromptStats has consistent shape', () => {
        const legacy = flattenSnapshotToLegacy(makeSnapshot(), null);
        expect(legacy.trackedPromptStats).toEqual({
            total: expect.any(Number),
            withTargetFound: expect.any(Number),
            withRunNoTarget: expect.any(Number),
            noRunYet: expect.any(Number),
            mentionRatePercent: expect.toBeOneOf([null, expect.any(Number)]),
        });
    });
});

// ─── bucketMentionsByType — deeper edge cases ────────────────────────────────

describe('bucketMentionsByType — edge cases', () => {
    it('treats is_target=true business as target, not generic', () => {
        const rows = [
            { entity_type: 'business', is_target: true, business_name: 'MyBiz' },
        ];
        const result = bucketMentionsByType(rows);
        expect(result.targets.length).toBe(1);
        expect(result.generics.length).toBe(0);
    });

    it('treats entity_type=business with is_target=false as generic', () => {
        const rows = [
            { entity_type: 'business', is_target: false, business_name: 'OtherBiz' },
        ];
        const result = bucketMentionsByType(rows);
        expect(result.generics.length).toBe(1);
        expect(result.targets.length).toBe(0);
    });

    it('ignores unknown entity_type rows', () => {
        const rows = [
            { entity_type: 'unknown_type', business_name: 'X' },
        ];
        const result = bucketMentionsByType(rows);
        expect(result.sources.length).toBe(0);
        expect(result.competitors.length).toBe(0);
        expect(result.generics.length).toBe(0);
        expect(result.targets.length).toBe(0);
    });

    it('handles mentions without entity_type (defaults to business → generic)', () => {
        const rows = [
            { business_name: 'NoType', is_target: false },
        ];
        const result = bucketMentionsByType(rows);
        expect(result.generics.length).toBe(1);
    });
});

// ─── deriveAuditMetrics — degraded mode ──────────────────────────────────────

describe('deriveAuditMetrics — LLM degraded / hybrid modes', () => {
    it('surfaces llm_status=failed from seo_breakdown', () => {
        const audit = {
            seo_score: 65,
            geo_score: 55,
            seo_breakdown: { overall: { llm_status: 'failed', llm_used: false, llm_degraded_mode: true } },
        };
        const result = deriveAuditMetrics(audit);
        expect(result.llmStatus).toBe('failed');
        expect(result.seoScore.warnings.some((w) => /LLM/.test(w))).toBe(true);
    });

    it('surfaces llm_status=skipped with appropriate warning', () => {
        const audit = {
            seo_score: 70,
            geo_score: 60,
            geo_breakdown: { overall: { llm_status: 'skipped' } },
        };
        const result = deriveAuditMetrics(audit);
        expect(result.llmStatus).toBe('skipped');
        expect(result.seoScore.warnings.some((w) => /non exécutée/.test(w))).toBe(true);
    });

    it('falls back to geo_breakdown when seo_breakdown has no llm_status', () => {
        const audit = {
            seo_score: 50,
            seo_breakdown: { overall: {} },
            geo_breakdown: { overall: { llm_status: 'available' } },
        };
        const result = deriveAuditMetrics(audit);
        expect(result.llmStatus).toBe('available');
    });

    it('returns unknown when neither breakdown has llm_status', () => {
        const audit = { seo_score: 50 };
        const result = deriveAuditMetrics(audit);
        expect(result.llmStatus).toBe('unknown');
    });

    it('keeps scores at high confidence even in degraded mode', () => {
        const audit = {
            seo_score: 70,
            geo_score: 55,
            seo_breakdown: { overall: { llm_status: 'failed' } },
        };
        const result = deriveAuditMetrics(audit);
        expect(result.seoScore.confidence).toBe('high');
        expect(result.geoScore.confidence).toBe('high');
    });
});

// ─── computeGuardrails — combined scenarios ─────────────────────────────────

describe('computeGuardrails — combined scenarios', () => {
    it('triggers both LLM_DEGRADED and HIGH_PARSE_FAILURE simultaneously', () => {
        const runs = Array.from({ length: 6 }, (_, i) => ({
            id: `r${i}`, provider: 'a', model: 'b', parse_status: 'parsed_failed',
        }));
        const audit = deriveAuditMetrics({
            seo_score: 50, geo_score: 50,
            seo_breakdown: { overall: { llm_status: 'failed' } },
        });
        const warnings = computeGuardrails({
            audit,
            runs: deriveRunMetrics(runs, { totalQueryRuns: 6 }),
            mentions: deriveMentionMetrics([], runs),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        const codes = warnings.map((w) => w.code);
        expect(codes).toContain('LLM_DEGRADED');
        expect(codes).toContain('HIGH_PARSE_FAILURE');
    });

    it('does not produce NO_AUDIT when scores exist', () => {
        const audit = deriveAuditMetrics({ seo_score: 80, geo_score: 70 });
        const warnings = computeGuardrails({
            audit,
            runs: deriveRunMetrics([], { totalQueryRuns: 0 }),
            mentions: deriveMentionMetrics([], []),
            prompts: derivePromptMetrics([], new Map()),
        });
        expect(warnings.some((w) => w.code === 'NO_AUDIT')).toBe(false);
    });

    it('severities are always info or warning', () => {
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics(null),
            runs: deriveRunMetrics([], { totalQueryRuns: 0 }),
            mentions: deriveMentionMetrics([], []),
            prompts: derivePromptMetrics([], new Map()),
        });
        for (const w of warnings) {
            expect(['info', 'warning']).toContain(w.severity);
        }
    });
});

// ─── Opportunity classification logic ────────────────────────────────────────

describe('opportunity classification (getLatestOpportunities logic)', () => {
    function classifyOpportunities(allOpps, latestAuditId) {
        const active = [];
        const stale = [];
        for (const o of allOpps) {
            if (o.status !== 'open') {
                active.push(o);
            } else if (!latestAuditId || o.audit_id === latestAuditId || !o.audit_id) {
                active.push(o);
            } else {
                stale.push(o);
            }
        }
        return { active, stale };
    }

    it('non-open status always goes to active', () => {
        const { active, stale } = classifyOpportunities([
            { id: 1, status: 'dismissed', audit_id: 'old-audit' },
            { id: 2, status: 'in_progress', audit_id: 'old-audit' },
        ], 'latest-audit');
        expect(active.length).toBe(2);
        expect(stale.length).toBe(0);
    });

    it('open opp matching latest audit goes to active', () => {
        const { active, stale } = classifyOpportunities([
            { id: 1, status: 'open', audit_id: 'latest-audit' },
        ], 'latest-audit');
        expect(active.length).toBe(1);
        expect(stale.length).toBe(0);
    });

    it('open opp from old audit goes to stale', () => {
        const { active, stale } = classifyOpportunities([
            { id: 1, status: 'open', audit_id: 'old-audit' },
        ], 'latest-audit');
        expect(active.length).toBe(0);
        expect(stale.length).toBe(1);
    });

    it('open opp without audit_id goes to active', () => {
        const { active, stale } = classifyOpportunities([
            { id: 1, status: 'open', audit_id: null },
        ], 'latest-audit');
        expect(active.length).toBe(1);
        expect(stale.length).toBe(0);
    });

    it('when no latest audit, all open opps go to active', () => {
        const { active, stale } = classifyOpportunities([
            { id: 1, status: 'open', audit_id: 'some-audit' },
            { id: 2, status: 'open', audit_id: null },
        ], null);
        expect(active.length).toBe(2);
        expect(stale.length).toBe(0);
    });
});

// ─── extraction-v2 — competitor vs generic separation ─────────────────────────

describe('extraction-v2 — competitor/generic separation', () => {
    const baseParams = {
        queryText: 'Best electrician in Montreal',
        responseText: 'Master Electric is a top electrician. Budget Sparks also available. Pro Wire competitors. Visit https://yelp.com/biz/master.',
        analysis: {
            mentioned_businesses: [
                { name: 'Master Electric', position: 1, context: 'Master Electric is a top electrician', is_target: true, sentiment: 'positive' },
                { name: 'Budget Sparks', position: 2, context: 'Budget Sparks also available', is_target: false, sentiment: 'neutral' },
                { name: 'Pro Wire', position: 3, context: 'Pro Wire competitors rival', is_target: false, sentiment: 'neutral' },
            ],
        },
        clientName: 'Master Electric',
        clientDomain: 'https://masterelectric.com',
        competitorAliases: [],
        knownCompetitors: ['Budget Sparks'],
    };

    it('known competitor gets entity_type=competitor', () => {
        const result = buildExtractionArtifacts(baseParams);
        const budgetSparks = result.mentionRows.find((r) => r.business_name === 'Budget Sparks');
        expect(budgetSparks).toBeTruthy();
        expect(budgetSparks.entity_type).toBe('competitor');
    });

    it('unknown business with competitor context gets entity_type=competitor', () => {
        const result = buildExtractionArtifacts(baseParams);
        const proWire = result.mentionRows.find((r) => r.business_name === 'Pro Wire');
        expect(proWire).toBeTruthy();
        expect(proWire.entity_type).toBe('competitor');
    });

    it('unknown business without competitor signals gets entity_type=generic_mention', () => {
        const params = {
            ...baseParams,
            knownCompetitors: [],
            analysis: {
                mentioned_businesses: [
                    { name: 'Master Electric', position: 1, context: 'top electrician', is_target: true, sentiment: 'positive' },
                    { name: 'Random Cafe', position: 2, context: 'Random Cafe is nearby the location', is_target: false, sentiment: 'neutral' },
                ],
            },
        };
        const result = buildExtractionArtifacts(params);
        const cafe = result.mentionRows.find((r) => r.business_name === 'Random Cafe');
        expect(cafe).toBeTruthy();
        expect(cafe.entity_type).toBe('generic_mention');
    });

    it('target business gets entity_type=business and is_target=true', () => {
        const result = buildExtractionArtifacts(baseParams);
        const target = result.mentionRows.find((r) => r.is_target === true);
        expect(target).toBeTruthy();
        expect(target.entity_type).toBe('business');
    });

    it('diagnostics.entity_breakdown separates competitors, generics, and sources', () => {
        const result = buildExtractionArtifacts(baseParams);
        const eb = result.diagnostics.entity_breakdown;
        expect(eb).toBeDefined();
        expect(typeof eb.competitors).toBe('number');
        expect(typeof eb.generic_mentions).toBe('number');
        expect(typeof eb.sources).toBe('number');
        expect(typeof eb.external_sources).toBe('number');
    });
});

// ─── Citation source typing and confidence ───────────────────────────────────

describe('citation source typing and confidence', () => {
    it('review platforms get high confidence (>= 0.85)', () => {
        const conf = computeSourceConfidence('https://yelp.com/biz/test', 'yelp.com', 'review_platform');
        expect(conf).toBeGreaterThanOrEqual(0.85);
    });

    it('client_own gets low confidence (<= 0.6)', () => {
        const conf = computeSourceConfidence('https://mysite.com/about', 'mysite.com', 'client_own');
        expect(conf).toBeLessThanOrEqual(0.6);
    });

    it('classifySourceType distinguishes review from editorial from social', () => {
        expect(classifySourceType('trustpilot.com')).toBe('review_platform');
        expect(classifySourceType('facebook.com')).toBe('social');
        expect(classifySourceType('random-blog.com')).toBe('editorial');
    });

    it('extraction-v2 builds source mentions with correct source_type', () => {
        const result = buildExtractionArtifacts({
            queryText: 'Best plumber Montreal',
            responseText: 'Check reviews on https://yelp.com/biz/abc and visit https://facebook.com/abc for updates.',
            analysis: {
                mentioned_businesses: [
                    { name: 'ABC Plumbing', position: 1, context: 'ABC is top', is_target: true, sentiment: 'positive' },
                ],
            },
            clientName: 'ABC Plumbing',
            clientDomain: 'https://abcplumbing.com',
            competitorAliases: [],
            knownCompetitors: [],
        });
        const sources = result.mentionRows.filter((r) => r.entity_type === 'source');
        const yelp = sources.find((s) => s.normalized_domain === 'yelp.com');
        const fb = sources.find((s) => s.normalized_domain === 'facebook.com');
        expect(yelp?.source_type).toBe('review_platform');
        expect(fb?.source_type).toBe('social');
    });
});

// ─── buildLastRunMap — ordering ──────────────────────────────────────────────

describe('buildLastRunMap — edge cases', () => {
    it('picks latest run per tracked_query_id by created_at', () => {
        const runs = [
            { id: 'old', tracked_query_id: 'q1', created_at: '2025-01-01' },
            { id: 'new', tracked_query_id: 'q1', created_at: '2025-06-01' },
        ];
        const map = buildLastRunMap(runs);
        expect(map.get('q1').id).toBe('new');
    });

    it('returns empty map for empty input', () => {
        const map = buildLastRunMap([]);
        expect(map.size).toBe(0);
    });

    it('ignores runs without tracked_query_id', () => {
        const runs = [
            { id: 'r1', tracked_query_id: null, created_at: '2025-01-01' },
        ];
        const map = buildLastRunMap(runs);
        expect(map.size).toBe(0);
    });
});
