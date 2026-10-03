import { describe, expect, it } from 'vitest';
import { readSeoScore, readGeoScore, readOverallScore, readDimensions } from '../audit/scores-facade.js';
import { computeDelta, buildMetricTrendSummary } from '../continuous/metrics-core.js';
describe('diagnostic and historical score readings', () => {
    it.each([null, undefined, '', '  ', false, true, {}, [], NaN, Infinity, 'invalid'])('rejects invalid persisted numbers: %s', (value) => {
        expect(readSeoScore({ seo_score: value }).value).toBeNull();
        expect(readGeoScore({ geo_score: value }).value).toBeNull();
        expect(computeDelta(value, 50).latest).toBeNull();
    });
    it('retains the existing structured dimension priority and provenance', () => {
        const audit = { seo_score: 50, geo_score: 60, extracted_data: { layered_v1: { dimension_scores: { technical_seo: { score: '80' }, local_readiness: 0 } } } };
        expect(readSeoScore(audit)).toMatchObject({ value: 80, provenance: 'calculated', source: 'layered.dimension_scores.technical_seo' });
        expect(readGeoScore(audit).value).toBe(0);
        expect(readDimensions(audit).technical_seo.value).toBe(80);
        expect(readOverallScore(audit).value).toBe(40);
    });
    it('keeps missing historical rows unavailable', () => {
        expect(readOverallScore({}).provenance).toBe('unavailable');
        expect(buildMetricTrendSummary({ snapshots: [{ snapshot_date: '2026-10-01', seo_score: '' }, { snapshot_date: '2026-10-02' }], metricKey: 'seo_score' }).latest).toBeNull();
    });
    it('retains observed zero in trends', () => {
        expect(computeDelta('0', 5)).toEqual({ latest: 0, previous: 5, delta: -5 });
    });
});
