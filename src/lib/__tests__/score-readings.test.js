import { describe, expect, it } from 'vitest';
import { readSeoScore, readGeoScore, readOverallScore, readDimensions } from '../audit/scores-facade.js';
import { buildLayeredAuditObject } from '../audit/layered-audit.js';
import { computeDelta, buildMetricTrendSummary } from '../continuous/metrics-core.js';
describe('diagnostic and historical score readings', () => {
    it.each([null, undefined, '', '  ', false, true, {}, [], NaN, Infinity, 'invalid'])(
        'rejects invalid persisted numbers: %s',
        (value) => {
            expect(readSeoScore({ seo_score: value }).value).toBeNull();
            expect(readGeoScore({ geo_score: value }).value).toBeNull();
            expect(computeDelta(value, 50).latest).toBeNull();
        },
    );
    it('retains the existing structured dimension priority and provenance', () => {
        const audit = {
            seo_score: 50,
            geo_score: 60,
            extracted_data: {
                layered_v1: { dimension_scores: { technical_seo: { score: '80' }, local_readiness: 0 } },
            },
        };
        expect(readSeoScore(audit)).toMatchObject({
            value: 80,
            provenance: 'calculated',
            source: 'layered.dimension_scores.technical_seo',
        });
        expect(readGeoScore(audit).value).toBe(0);
        expect(readDimensions(audit).technical_seo.value).toBe(80);
        expect(readOverallScore(audit).value).toBe(40);
    });
    it('keeps missing historical rows unavailable', () => {
        expect(readOverallScore({}).provenance).toBe('unavailable');
        expect(
            buildMetricTrendSummary({
                snapshots: [{ snapshot_date: '2026-10-01', seo_score: '' }, { snapshot_date: '2026-10-02' }],
                metricKey: 'seo_score',
            }).latest,
        ).toBeNull();
    });
    it('retains observed zero in trends', () => {
        expect(computeDelta('0', 5)).toEqual({ latest: 0, previous: 5, delta: -5 });
    });
});

describe('persisted layered score sources', () => {
    it('reads dimensions and deterministic final score from the actual audit producer', () => {
        const layered = buildLayeredAuditObject({
            scoring: {
                deterministic_score: 58,
                dimensions: {
                    technical_seo: { score: 81 },
                    local_readiness: { score: 0 },
                    ai_answerability: { score: 42 },
                    trust_signals: { score: 64 },
                    identity_completeness: { score: 73 },
                },
            },
            hybrid: { deterministicScore: 58, hybridScore: 99 },
            scanResults: { extracted_data: { layered_v1_layer1: { site_level_raw_scores: { overall: 98 } } } },
            layer2Expert: { summary_score: 97 },
        });
        const audit = { seo_score: 2, geo_score: 3, extracted_data: { layered_v1: layered } };
        expect(readSeoScore(audit)).toMatchObject({
            value: 81,
            provenance: 'calculated',
            source: 'layered.final_trouvable_score.dimension_scores.technical_seo',
        });
        expect(readGeoScore(audit)).toMatchObject({
            value: 0,
            provenance: 'calculated',
            source: 'layered.final_trouvable_score.dimension_scores.local_readiness',
        });
        expect(readOverallScore(audit)).toMatchObject({
            value: 58,
            source: 'layered.final_trouvable_score.deterministic_score',
        });
        expect(readDimensions(audit).trust_signals).toMatchObject({
            value: 64,
            source: 'layered.final_trouvable_score.dimension_scores.trust_signals',
        });
        expect(readDimensions(audit).identity_completeness.value).toBe(73);
    });
    it('reports AI answerability as the source when local readiness is absent', () => {
        const layered = buildLayeredAuditObject({
            scoring: { deterministic_score: 18, dimensions: { ai_answerability: { score: 0 } } },
        });
        expect(readGeoScore({ extracted_data: { layered_v1: layered } })).toMatchObject({
            value: 0,
            provenance: 'calculated',
            provenanceLabel: 'Calculée',
            source: 'layered.final_trouvable_score.dimension_scores.ai_answerability',
        });
        expect(
            readGeoScore({ extracted_data: { layered_v1: { dimension_scores: { ai_answerability: 67 } } } }),
        ).toMatchObject({ value: 67, source: 'layered.dimension_scores.ai_answerability' });
    });
    it('retains historical dimension containers and identifies the selected one', () => {
        const audit = {
            extracted_data: {
                dimension_scores: { technical_seo: { value: '70' }, local_readiness: { normalized: 0 } },
            },
        };
        expect(readSeoScore(audit)).toMatchObject({ value: 70, source: 'extracted.dimension_scores.technical_seo' });
        expect(readGeoScore(audit)).toMatchObject({ value: 0, source: 'extracted.dimension_scores.local_readiness' });
        expect(readDimensions(audit).local_readiness.source).toBe('extracted.dimension_scores.local_readiness');
    });
    it('uses valid historical values when canonical dimension fields are invalid', () => {
        const audit = {
            seo_score: 22,
            geo_score: 23,
            extracted_data: {
                layered_v1: {
                    final_trouvable_score: {
                        dimension_scores: { technical_seo: { score: '' }, local_readiness: { score: false } },
                    },
                    dimension_scores: { technical_seo: { score: 0 }, local_readiness: { score: 61 } },
                },
            },
        };
        expect(readSeoScore(audit)).toMatchObject({ value: 0, source: 'layered.dimension_scores.technical_seo' });
        expect(readGeoScore(audit)).toMatchObject({ value: 61, source: 'layered.dimension_scores.local_readiness' });
        expect(
            readSeoScore({
                seo_score: 0,
                extracted_data: {
                    layered_v1: { final_trouvable_score: { dimension_scores: { technical_seo: { score: Infinity } } } },
                },
            }),
        ).toMatchObject({ value: 0, source: 'legacy.seo_score' });
    });
    it('prioritizes canonical dimensions then historical containers, and local readiness over answerability', () => {
        const audit = {
            extracted_data: {
                layered_v1: {
                    final_trouvable_score: {
                        dimension_scores: { technical_seo: 31, local_readiness: 0, ai_answerability: 90 },
                    },
                    dimension_scores: { technical_seo: 81, local_readiness: 82 },
                },
                dimension_scores: { technical_seo: 91 },
            },
        };
        expect(readSeoScore(audit).value).toBe(31);
        expect(readGeoScore(audit)).toMatchObject({
            value: 0,
            source: 'layered.final_trouvable_score.dimension_scores.local_readiness',
        });
    });
    it.each([
        [{ overall_score: 0 }, 0, 'overall_score'],
        [{ breakdown: { overall: { score: 53 } } }, 53, 'legacy.breakdown.overall.score'],
        [
            { seo_breakdown: { overall: { deterministic_score: 0 } } },
            0,
            'legacy.seo_breakdown.overall.deterministic_score',
        ],
        [
            { geo_breakdown: { overall: { deterministic_score: 64 } } },
            64,
            'legacy.geo_breakdown.overall.deterministic_score',
        ],
        [{ breakdown: { technical_seo: { score: 0 } } }, null, 'none'],
    ])('reports the actual overall fallback source for %j', (audit, value, source) => {
        expect(readOverallScore(audit)).toMatchObject({ value, source });
    });
    it('keeps historical overall priority before canonical and persisted breakdown alternatives', () => {
        const audit = {
            deterministic_score: 0,
            overall_score: 92,
            breakdown: { overall: { score: 93 } },
            extracted_data: { layered_v1: { final_trouvable_score: { deterministic_score: 94 } } },
            seo_breakdown: { overall: { deterministic_score: 95 } },
            geo_breakdown: { overall: { deterministic_score: 96 } },
        };
        expect(readOverallScore(audit)).toMatchObject({ value: 0, source: 'deterministic_score' });
        audit.deterministic_score = null;
        expect(readOverallScore(audit)).toMatchObject({ value: 92, source: 'overall_score' });
        audit.overall_score = '';
        expect(readOverallScore(audit)).toMatchObject({ value: 93, source: 'legacy.breakdown.overall.score' });
        audit.breakdown.overall.score = false;
        expect(readOverallScore(audit)).toMatchObject({
            value: 94,
            source: 'layered.final_trouvable_score.deterministic_score',
        });
        audit.extracted_data.layered_v1.final_trouvable_score.deterministic_score = Infinity;
        expect(readOverallScore(audit)).toMatchObject({
            value: 95,
            source: 'legacy.seo_breakdown.overall.deterministic_score',
        });
        audit.seo_breakdown.overall.deterministic_score = undefined;
        expect(readOverallScore(audit)).toMatchObject({
            value: 96,
            source: 'legacy.geo_breakdown.overall.deterministic_score',
        });
    });
    it('reports the actual legacy SEO and GEO breakdown fallbacks', () => {
        const audit = { breakdown: { technical_seo: { score: 0 }, local_readiness: { score: 45 } } };
        expect(readSeoScore(audit)).toMatchObject({ value: 0, source: 'legacy.breakdown.technical_seo' });
        expect(readGeoScore(audit)).toMatchObject({ value: 45, source: 'legacy.breakdown.local_readiness' });
        expect(readOverallScore(audit)).toMatchObject({ value: 23, source: 'derived.seo+geo/2' });
    });
    it('never substitutes a hybrid or subsystem diagnostic for the deterministic overall score', () => {
        const audit = {
            hybrid_score: 99,
            extracted_data: {
                layered_v1: {
                    final_trouvable_score: { hybrid_score: 98 },
                    site_level_raw_scores: { overall: 97 },
                    subsystem_scores: {
                        layer1_raw_scan: { overall: 96 },
                        layer2_expert_summary: { summary_score: 95 },
                    },
                },
            },
        };
        expect(readOverallScore(audit)).toMatchObject({ value: null, provenance: 'unavailable', source: 'none' });
        expect(readSeoScore(audit).value).toBeNull();
        expect(readGeoScore(audit).value).toBeNull();
    });
});
