import { describe, expect, it } from 'vitest';
import { getFinalStableScores, getSeoGeoBucketsViewModel } from '../audit-lab-model.js';
describe('stable client audit scores', () => {
    it.each([null, undefined, '', '  ', true, false, {}, [], NaN, Infinity, -Infinity, 'invalid'])('rejects absent or invalid scores: %s', (value) => {
        const scores = getFinalStableScores({ seo_score: value, geo_score: value, geo_breakdown: { overall: { hybrid_score: value, deterministic_score: value } } });
        expect(scores.finalScore).toBeNull();
        expect(scores.seoScore).toBeNull();
        expect(scores.geoScore).toBeNull();
    });
    it('falls back from a null hybrid score to deterministic 72', () => {
        expect(getFinalStableScores({ geo_breakdown: { overall: { hybrid_score: null, deterministic_score: 72 } } }).finalScore).toBe(72);
    });
    it('retains zero, numeric strings and the persisted priority', () => {
        expect(getFinalStableScores({ seo_score: '60', geo_score: '65', geo_breakdown: { overall: { hybrid_score: 0, deterministic_score: 72 } } })).toMatchObject({ finalScore: 0, seoScore: 60, geoScore: 65, deterministicScore: 72 });
    });
    it('keeps an old record without scores unavailable', () => {
        expect(getFinalStableScores({}).finalScore).toBeNull();
    });
    it('keeps dimension diagnostics separate from the client score', () => {
        const audit = { seo_score: 50, geo_score: 60, geo_breakdown: { overall: { hybrid_score: 72 }, dimensions: [{ key: 'technical_seo', score: 95 }, { key: 'local_readiness', score: 30 }] } };
        expect(getFinalStableScores(audit).finalScore).toBe(72);
        expect(getSeoGeoBucketsViewModel(audit)).toMatchObject({ seo: { score: 95 }, geo: { score: 30 } });
    });
});
