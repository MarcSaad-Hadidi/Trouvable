import { describe, expect, it } from 'vitest';
import { scoreAuditV2 } from '../audit/score.js';
import { buildLayeredAuditObject } from '../audit/layered-audit.js';
import { readDimensions, readGeoScore, readOverallScore, readSeoScore } from '../audit/scores-facade.js';

function scanFixture() {
    return {
        source_url: 'https://atelier.example',
        resolved_url: 'https://atelier.example',
        scanned_pages: [{ url: 'https://atelier.example', success: true, page_type: 'homepage' }],
        extracted_data: {
            titles: ['Atelier de plomberie à Montréal'],
            descriptions: ['Services de plomberie résidentielle à Montréal : inspection, entretien et réparation.'],
            h1s: ['Plomberie à Montréal'],
            canonicals: ['https://atelier.example'],
            business_names: ['Atelier'],
            phones: ['514-555-0100'],
            emails: ['contact@atelier.example'],
            local_signals: { cities: ['Montréal'], address_lines: ['123 rue Principale'] },
            service_signals: { services: ['Plomberie'], keywords: ['plomberie'] },
            trust_signals: { proof_terms: ['10 ans expérience'], review_terms: ['avis clients'] },
            page_stats: { total_word_count: 620, contact_pages: 1, service_pages: 1 },
            layered_v1_layer1: {
                site_level_raw_scores: { overall: 98, categories: { technical_seo: 97 } },
            },
        },
    };
}

describe('layered audit score producer contract', () => {
    it('preserves the five dimensions emitted by scoreAuditV2 through persistence and score readings', () => {
        const scanResults = scanFixture();
        const scoring = scoreAuditV2(scanResults);
        const layered = buildLayeredAuditObject({ scanResults, scoring });
        const audit = { extracted_data: { layered_v1: layered } };

        expect(scoring.score_dimensions.map(({ key }) => key)).toEqual([
            'technical_seo',
            'local_readiness',
            'ai_answerability',
            'trust_signals',
            'identity_completeness',
        ]);
        expect(layered.final_trouvable_score.dimension_scores).not.toBeNull();
        for (const dimension of scoring.score_dimensions) {
            expect(layered.final_trouvable_score.dimension_scores[dimension.key]).toBe(dimension);
            expect(readDimensions(audit)[dimension.key]).toMatchObject({
                value: dimension.score,
                source: 'layered.final_trouvable_score.dimension_scores.' + dimension.key,
            });
        }
        expect(readSeoScore(audit).value).toBe(scoring.seo_score);
        expect(readGeoScore(audit).value).toBe(scoring.geo_score);
        expect(layered.dashboard_reporting_fields).toMatchObject({
            seo_score: scoring.seo_score,
            geo_score: scoring.geo_score,
        });
    });

    it('preserves an actual zero emitted by the current producer', () => {
        const scoring = scoreAuditV2({ scanned_pages: [], extracted_data: { has_noindex: true } });
        const layered = buildLayeredAuditObject({ scoring });
        expect(scoring.seo_score).toBe(0);
        expect(layered.dashboard_reporting_fields.seo_score).toBe(0);
        expect(readSeoScore({ extracted_data: { layered_v1: layered } }).value).toBe(0);
    });
    it('retains observed zero in the historical dimension object', () => {
        const dimensions = { technical_seo: { score: 0 }, local_readiness: { score: 0 } };
        const layered = buildLayeredAuditObject({ scoring: { dimensions } });
        expect(layered.final_trouvable_score.dimension_scores).toBe(dimensions);
        expect(layered.dashboard_reporting_fields).toMatchObject({ seo_score: 0, geo_score: 0 });
        const audit = { extracted_data: { layered_v1: layered } };
        expect(readSeoScore(audit).value).toBe(0);
        expect(readGeoScore(audit).value).toBe(0);
    });

    it.each([undefined, {}, { score_dimensions: [] }])('keeps absent dimensions unavailable: %j', (scoring) => {
        const layered = buildLayeredAuditObject({ scoring });
        expect(layered.final_trouvable_score.dimension_scores).toBeNull();
        expect(layered.dashboard_reporting_fields).toMatchObject({ seo_score: null, geo_score: null });
        const audit = { extracted_data: { layered_v1: layered } };
        expect(readSeoScore(audit).value).toBeNull();
        expect(readGeoScore(audit).value).toBeNull();
    });

    it('keeps historical dimensions authoritative when both formats are present', () => {
        const scoring = scoreAuditV2(scanFixture());
        const dimensions = { technical_seo: { score: 0 }, local_readiness: { score: 12 } };
        const layered = buildLayeredAuditObject({ scoring: { ...scoring, dimensions } });
        expect(layered.final_trouvable_score.dimension_scores).toBe(dimensions);
        expect(layered.dashboard_reporting_fields).toMatchObject({ seo_score: 0, geo_score: 12 });
    });

    it('keeps raw diagnostics and hybrid scores distinct from the final deterministic score', () => {
        const scanResults = scanFixture();
        const scoring = scoreAuditV2(scanResults);
        const layered = buildLayeredAuditObject({
            scanResults,
            scoring,
            hybrid: { deterministicScore: scoring.deterministic_score, hybridScore: 99 },
            layer2Expert: { summary_score: 96 },
        });
        expect(layered.site_level_raw_scores.overall).toBe(98);
        expect(layered.subsystem_scores.layer2_expert_summary.summary_score).toBe(96);
        expect(layered.final_trouvable_score.hybrid_score).toBe(99);
        expect(scoring.deterministic_score).not.toBe(98);
        expect(scoring.deterministic_score).not.toBe(99);
        expect(readOverallScore({ extracted_data: { layered_v1: layered } })).toMatchObject({
            value: scoring.deterministic_score,
            source: 'layered.final_trouvable_score.deterministic_score',
        });
    });
});
