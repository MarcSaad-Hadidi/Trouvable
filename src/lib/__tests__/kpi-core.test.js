import { describe, expect, it } from 'vitest';

import {
    bucketMentionsByType,
    buildGeoKpiSnapshot,
    buildLastRunMap,
    computeGuardrails,
    deriveAuditMetrics,
    deriveMentionMetrics,
    derivePromptMetrics,
    deriveRunMetrics,
    enrichModelPerformanceWithSources,
    flattenSnapshotToLegacy,
    kpi,
} from '../operator-intelligence/kpi-core.js';

describe('kpi()', () => {
    it('wraps value with metadata', () => {
        const result = kpi(85, 'observed', 'high', ['test warning']);
        expect(result.value).toBe(85);
        expect(result.sourceType).toBe('observed');
        expect(result.confidence).toBe('high');
        expect(result.warnings).toEqual(['test warning']);
    });

    it('defaults warnings to empty array', () => {
        expect(kpi(null, 'derived', 'low').warnings).toEqual([]);
    });
});

describe('bucketMentionsByType()', () => {
    it('separates mentions into correct buckets', () => {
        const mentions = [
            { entity_type: 'source', business_name: 'yelp.ca' },
            { entity_type: 'competitor', business_name: 'Rival' },
            { entity_type: 'generic_mention', business_name: 'Random' },
            { entity_type: 'business', is_target: true, business_name: 'Us' },
            { entity_type: 'business', is_target: false, business_name: 'Other' },
        ];
        const result = bucketMentionsByType(mentions);
        expect(result.sources.length).toBe(1);
        expect(result.competitors.length).toBe(1);
        expect(result.targets.length).toBe(1);
        expect(result.generics.length).toBe(2);
    });

    it('handles empty input', () => {
        const result = bucketMentionsByType([]);
        expect(result.sources).toEqual([]);
        expect(result.competitors).toEqual([]);
        expect(result.generics).toEqual([]);
        expect(result.targets).toEqual([]);
    });

    it('handles null input', () => {
        const result = bucketMentionsByType(null);
        expect(result.sources).toEqual([]);
    });
});

describe('deriveAuditMetrics()', () => {
    it('handles null audit', () => {
        const result = deriveAuditMetrics(null);
        expect(result.seoScore.value).toBeNull();
        expect(result.geoScore.value).toBeNull();
        expect(result.seoScore.confidence).toBe('low');
        expect(result.llmStatus).toBe('none');
        expect(result.strengths).toEqual([]);
        expect(result.issues).toEqual([]);
    });

    it('derives metrics from valid audit', () => {
        const audit = {
            seo_score: 78,
            geo_score: 65,
            created_at: '2025-06-01T00:00:00Z',
            strengths: ['Good schema'],
            issues: ['Missing FAQ'],
            seo_breakdown: { overall: { llm_status: 'available' } },
        };
        const result = deriveAuditMetrics(audit);
        expect(result.seoScore.value).toBe(78);
        expect(result.seoScore.sourceType).toBe('observed');
        expect(result.seoScore.confidence).toBe('high');
        expect(result.geoScore.value).toBe(65);
        expect(result.lastAuditAt.value).toBe('2025-06-01T00:00:00Z');
        expect(result.llmStatus).toBe('available');
        expect(result.strengths).toEqual(['Good schema']);
    });

    it('adds warning when LLM failed', () => {
        const audit = {
            seo_score: 50,
            seo_breakdown: { overall: { llm_status: 'failed' } },
        };
        const result = deriveAuditMetrics(audit);
        expect(result.seoScore.warnings.length).toBeGreaterThan(0);
        expect(result.seoScore.warnings[0]).toMatch(/LLM/);
        expect(result.llmStatus).toBe('failed');
    });
});

describe('deriveRunMetrics()', () => {
    it('handles empty runs', () => {
        const result = deriveRunMetrics([], { totalQueryRuns: 0, brandRecommendations: 0 });
        expect(result.totalQueryRuns.value).toBe(0);
        expect(result.visibilityProxyPercent.value).toBeNull();
        expect(result.visibilityProxyReliability).toBeNull();
        expect(result.modelPerformance).toEqual([]);
        expect(result.sampleSizeWarning).toBeFalsy();
    });

    it('computes visibility proxy', () => {
        const runs = [
            { id: '1', provider: 'groq', model: 'llama', target_found: true },
            { id: '2', provider: 'groq', model: 'llama', target_found: false },
            { id: '3', provider: 'openai', model: 'gpt4', target_found: true },
        ];
        const result = deriveRunMetrics(runs, { totalQueryRuns: 10, brandRecommendations: 6 });
        expect(result.visibilityProxyPercent.value).toBe(60);
        expect(result.visibilityProxyReliability).toBe('high');
        expect(result.sampleSizeWarning).toBe(false);
    });

    it('flags low sample size', () => {
        const result = deriveRunMetrics([{ id: '1', provider: 'a', model: 'b' }], { totalQueryRuns: 3, brandRecommendations: 1 });
        expect(result.sampleSizeWarning).toBe(true);
        expect(result.visibilityProxyReliability).toBe('low');
        expect(result.visibilityProxyPercent.warnings.length).toBeGreaterThan(0);
    });

    it('aggregates model performance', () => {
        const runs = [
            { id: '1', provider: 'groq', model: 'llama', target_found: true },
            { id: '2', provider: 'groq', model: 'llama', target_found: false },
            { id: '3', provider: 'openai', model: 'gpt4', target_found: true },
        ];
        const result = deriveRunMetrics(runs, { totalQueryRuns: 3 });
        expect(result.modelPerformance.length).toBe(2);
        const groq = result.modelPerformance.find((m) => m.provider === 'groq');
        expect(groq.runs).toBe(2);
        expect(groq.targetFound).toBe(1);
        expect(groq.targetRatePercent).toBe(50);
    });

    it('computes average parse confidence', () => {
        const runs = [
            { id: '1', provider: 'a', model: 'b', parse_confidence: 0.8 },
            { id: '2', provider: 'a', model: 'b', parse_confidence: 0.6 },
            { id: '3', provider: 'a', model: 'b', parse_confidence: 0.4 },
        ];
        const result = deriveRunMetrics(runs, { totalQueryRuns: 3 });
        expect(result.avgParseConfidence.value).toBe(0.6);
    });

    it('computes parse failure rate', () => {
        const runs = [
            { id: '1', provider: 'a', model: 'b', parse_status: 'parsed_ok' },
            { id: '2', provider: 'a', model: 'b', parse_status: 'parsed_failed' },
            { id: '3', provider: 'a', model: 'b', parse_status: 'parsed_failed' },
            { id: '4', provider: 'a', model: 'b', parse_status: 'error' },
        ];
        const result = deriveRunMetrics(runs, { totalQueryRuns: 4 });
        expect(result.parseFailureRate.value).toBe(75);
    });

    it('returns null parse confidence when no runs have it', () => {
        const runs = [{ id: '1', provider: 'a', model: 'b' }];
        const result = deriveRunMetrics(runs, { totalQueryRuns: 1 });
        expect(result.avgParseConfidence.value).toBeNull();
    });
});

describe('deriveMentionMetrics()', () => {
    const baseMentions = [
        { entity_type: 'source', source_type: 'editorial', business_name: 'yelp.ca', query_run_id: 'r1', created_at: '2025-01-01', normalized_domain: 'yelp.ca' },
        { entity_type: 'source', source_type: 'client_own', business_name: 'mysite.com', query_run_id: 'r1', created_at: '2025-01-01', normalized_domain: 'mysite.com' },
        { entity_type: 'competitor', business_name: 'Rival Co', normalized_label: 'Rival Co', query_run_id: 'r1' },
        { entity_type: 'competitor', business_name: 'Rival Co', normalized_label: 'Rival Co', query_run_id: 'r2' },
        { entity_type: 'generic_mention', business_name: 'Random Biz', normalized_label: 'Random Biz', query_run_id: 'r1' },
        { entity_type: 'business', is_target: true, business_name: 'Target', query_run_id: 'r1' },
        { entity_type: 'business', is_target: false, business_name: 'OtherBiz', normalized_label: 'OtherBiz', query_run_id: 'r2' },
    ];
    const runs = [{ id: 'r1', provider: 'groq', model: 'llama' }, { id: 'r2', provider: 'openai', model: 'gpt4' }];

    it('counts entity types correctly', () => {
        const result = deriveMentionMetrics(baseMentions, runs);
        expect(result.confirmedCompetitorMentions.value).toBe(2);
        expect(result.confirmedCompetitorMentions.sourceType).toBe('observed');
        expect(result.genericMentions.value).toBe(2);
        expect(result.sourceMentions.value).toBe(2);
        expect(result.externalSourceMentions.value).toBe(1);
        expect(result.brandTargetMentions.value).toBe(1);
    });

    it('builds topCompetitors and topSources', () => {
        const result = deriveMentionMetrics(baseMentions, runs);
        expect(result.topCompetitors[0]).toEqual({ name: 'Rival Co', count: 2 });
        expect(result.topSources.length).toBeGreaterThan(0);
    });

    it('computes citation coverage', () => {
        const result = deriveMentionMetrics(baseMentions, runs);
        expect(result.citationCoveragePercent.value).toBe(50);
        expect(result.runsWithSourceCitation).toBe(1);
    });

    it('handles empty mentions', () => {
        const result = deriveMentionMetrics([], []);
        expect(result.confirmedCompetitorMentions.value).toBe(0);
        expect(result.sourceMentions.value).toBe(0);
        expect(result.citationCoveragePercent.value).toBeNull();
    });
});

describe('derivePromptMetrics()', () => {
    it('handles empty tracked queries', () => {
        const result = derivePromptMetrics([], new Map());
        expect(result.total.value).toBe(0);
        expect(result.mentionRatePercent.value).toBeNull();
    });

    it('computes mention rate correctly', () => {
        const queries = [
            { id: 'q1', is_active: true },
            { id: 'q2', is_active: true },
            { id: 'q3', is_active: false },
            { id: 'q4', is_active: true },
        ];
        const lastRunMap = new Map([
            ['q1', { target_found: true }],
            ['q2', { target_found: false }],
            ['q3', { target_found: true }],
        ]);
        const result = derivePromptMetrics(queries, lastRunMap);
        expect(result.total.value).toBe(4);
        expect(result.active).toBe(3);
        expect(result.withTargetFound).toBe(2);
        expect(result.withRunNoTarget).toBe(1);
        expect(result.noRunYet).toBe(1);
        expect(result.mentionRatePercent.value).toBe(50);
    });
});

describe('computeGuardrails()', () => {
    it('warns on zero runs', () => {
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics(null),
            runs: deriveRunMetrics([], { totalQueryRuns: 0 }),
            mentions: deriveMentionMetrics([], []),
            prompts: derivePromptMetrics([], new Map()),
        });
        const codes = warnings.map((w) => w.code);
        expect(codes).toContain('NO_RUNS');
        expect(codes).toContain('NO_AUDIT');
        expect(codes).toContain('NO_PROMPTS');
    });

    it('warns on low sample size', () => {
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics({ seo_score: 50, geo_score: 50 }),
            runs: deriveRunMetrics([{ id: '1' }], { totalQueryRuns: 3 }),
            mentions: deriveMentionMetrics([], []),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        expect(warnings.some((w) => w.code === 'LOW_SAMPLE_SIZE')).toBe(true);
    });

    it('warns on unconfirmed competitors', () => {
        const mentions = [];
        for (let i = 0; i < 5; i++) {
            mentions.push({ entity_type: 'generic_mention', business_name: `Biz ${i}`, normalized_label: `Biz ${i}`, query_run_id: 'r1' });
        }
        const runs = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, provider: 'a', model: 'b' }));
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics({ seo_score: 50, geo_score: 50 }),
            runs: deriveRunMetrics(runs, { totalQueryRuns: 6 }),
            mentions: deriveMentionMetrics(mentions, runs),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        expect(warnings.some((w) => w.code === 'UNCONFIRMED_COMPETITORS')).toBe(true);
    });

    it('warns on LLM degraded mode', () => {
        const audit = deriveAuditMetrics({
            seo_score: 50, geo_score: 50,
            seo_breakdown: { overall: { llm_status: 'failed' } },
        });
        const warnings = computeGuardrails({
            audit,
            runs: deriveRunMetrics([], { totalQueryRuns: 10 }),
            mentions: deriveMentionMetrics([], []),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        expect(warnings.some((w) => w.code === 'LLM_DEGRADED')).toBe(true);
    });

    it('warns on low parse confidence', () => {
        const runs = Array.from({ length: 6 }, (_, i) => ({
            id: `r${i}`, provider: 'a', model: 'b', parse_confidence: 0.3,
        }));
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics({ seo_score: 50, geo_score: 50 }),
            runs: deriveRunMetrics(runs, { totalQueryRuns: 6 }),
            mentions: deriveMentionMetrics([], runs),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        expect(warnings.some((w) => w.code === 'LOW_PARSE_CONFIDENCE')).toBe(true);
    });

    it('warns on high parse failure rate', () => {
        const runs = [
            { id: 'r1', provider: 'a', model: 'b', parse_status: 'parsed_failed' },
            { id: 'r2', provider: 'a', model: 'b', parse_status: 'parsed_failed' },
            { id: 'r3', provider: 'a', model: 'b', parse_status: 'parsed_ok' },
        ];
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics({ seo_score: 50, geo_score: 50 }),
            runs: deriveRunMetrics(runs, { totalQueryRuns: 3 }),
            mentions: deriveMentionMetrics([], runs),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        expect(warnings.some((w) => w.code === 'HIGH_PARSE_FAILURE')).toBe(true);
    });

    it('does not warn on healthy parse metrics', () => {
        const runs = Array.from({ length: 10 }, (_, i) => ({
            id: `r${i}`, provider: 'a', model: 'b', parse_confidence: 0.9, parse_status: 'parsed_ok',
        }));
        const warnings = computeGuardrails({
            audit: deriveAuditMetrics({ seo_score: 80, geo_score: 70 }),
            runs: deriveRunMetrics(runs, { totalQueryRuns: 10 }),
            mentions: deriveMentionMetrics([], runs),
            prompts: derivePromptMetrics([{ id: 'q1' }], new Map()),
        });
        expect(warnings.some((w) => w.code === 'LOW_PARSE_CONFIDENCE')).toBe(false);
        expect(warnings.some((w) => w.code === 'HIGH_PARSE_FAILURE')).toBe(false);
    });
});

describe('buildGeoKpiSnapshot()', () => {
    it('assembles snapshot with guardrails', () => {
        const audit = deriveAuditMetrics({ seo_score: 80, geo_score: 70 });
        const runs = deriveRunMetrics([{ id: '1' }], { totalQueryRuns: 1 });
        const mentions = deriveMentionMetrics([], []);
        const prompts = derivePromptMetrics([], new Map());
        const snapshot = buildGeoKpiSnapshot({
            audit, runs, mentions, prompts,
            counts: { openOpportunities: 2 },
            lastRunAt: '2025-01-01',
        });
        expect(snapshot.audit).toBe(audit);
        expect(snapshot.runs).toBe(runs);
        expect(snapshot.guardrails).toBeDefined();
        expect(Array.isArray(snapshot.guardrails)).toBe(true);
    });
});

describe('enrichModelPerformanceWithSources()', () => {
    it('adds source counts to model performance', () => {
        const modelPerf = [
            { provider: 'groq', model: 'llama', runs: 3, targetFound: 1, sources: 0 },
        ];
        const mentions = [
            { entity_type: 'source', query_run_id: 'r1' },
            { entity_type: 'source', query_run_id: 'r2' },
            { entity_type: 'competitor', query_run_id: 'r1' },
        ];
        const runs = [
            { id: 'r1', provider: 'groq', model: 'llama' },
            { id: 'r2', provider: 'groq', model: 'llama' },
        ];
        const result = enrichModelPerformanceWithSources(modelPerf, mentions, runs);
        expect(result[0].sources).toBe(2);
    });
});

describe('flattenSnapshotToLegacy()', () => {
    it('produces backward-compatible shape', () => {
        const audit = deriveAuditMetrics({ seo_score: 85, geo_score: 70, created_at: '2025-01-01', strengths: ['s1'], issues: ['i1'] });
        const runs = deriveRunMetrics([{ id: '1' }], { totalQueryRuns: 10, brandRecommendations: 5 });
        const mentions = deriveMentionMetrics([], []);
        const prompts = derivePromptMetrics([{ id: 'q1' }], new Map());
        const snapshot = buildGeoKpiSnapshot({
            audit, runs, mentions, prompts,
            counts: { openOpportunities: 3, pendingMerge: 1, activeTrackedQueries: 5, totalTrackedQueries: 8, totalQueryRuns: 10, brandRecommendations: 5 },
            lastRunAt: '2025-01-01',
        });
        const legacy = flattenSnapshotToLegacy(snapshot, { id: 'audit-1', seo_score: 85 });

        expect(legacy.seoScore).toBe(85);
        expect(legacy.geoScore).toBe(70);
        expect(legacy.totalQueryRuns).toBe(10);
        expect(legacy.openOpportunities).toBe(3);
        expect(legacy.visibilityProxyPercent).toBe(50);
        expect(legacy.trackedPromptStats.total).toBe(1);
        expect(legacy.trackedPromptStats.noRunYet).toBe(1);
        expect(legacy.latestAudit).toEqual({ id: 'audit-1', seo_score: 85 });
        expect(legacy.guardrails).toBeDefined();
        expect(legacy).toHaveProperty('avgParseConfidence');
        expect(legacy).toHaveProperty('parseFailureRate');
    });
});

describe('buildLastRunMap()', () => {
    it('maps latest run per tracked query', () => {
        const runs = [
            { id: 'r1', tracked_query_id: 'q1', created_at: '2025-01-02' },
            { id: 'r2', tracked_query_id: 'q1', created_at: '2025-01-01' },
            { id: 'r3', tracked_query_id: 'q2', created_at: '2025-01-01' },
            { id: 'r4', tracked_query_id: null, created_at: '2025-01-01' },
        ];
        const map = buildLastRunMap(runs);
        expect(map.size).toBe(2);
        expect(map.get('q1').id).toBe('r1');
        expect(map.get('q2').id).toBe('r3');
    });
});
