/**
 * Lecture des scores et dimensions d'audit avec leur source effective.
 * Les dimensions finales layered et les formats historiques restent lisibles.
 * Ces accesseurs servent les consommateurs de la façade ; d'autres surfaces
 * lisent encore les colonnes legacy directement. Les scores hybrides et les
 * diagnostics des sous-systèmes restent des concepts distincts.
 */

import { finiteNumberOrNull } from '../numbers.js';

function clampScore(value) {
    const numeric = finiteNumberOrNull(value);
    if (numeric === null) return null;
    if (numeric < 0) return 0;
    if (numeric > 100) return 100;
    return Math.round(numeric);
}

function firstScore(...candidates) {
    for (const [candidate, source] of candidates) {
        const value = clampScore(candidate);
        if (value !== null) return { value, source };
    }
    return { value: null, source: 'none' };
}

function getLayeredRoot(audit) {
    const extracted = audit?.extracted_data;
    if (!extracted || typeof extracted !== 'object') return null;
    return extracted.layered_v1 && typeof extracted.layered_v1 === 'object' ? extracted.layered_v1 : null;
}

function getDimensionScores(audit) {
    const layered = getLayeredRoot(audit);
    return [
        {
            scores: layered?.final_trouvable_score?.dimension_scores,
            source: 'layered.final_trouvable_score.dimension_scores',
        },
        { scores: layered?.dimension_scores, source: 'layered.dimension_scores' },
        { scores: audit?.extracted_data?.dimension_scores, source: 'extracted.dimension_scores' },
    ].filter(({ scores }) => scores && typeof scores === 'object');
}

function dimensionValue(dimensionScores, key) {
    if (!dimensionScores) return null;
    const raw = dimensionScores[key];
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') {
        return clampScore(raw.score ?? raw.value ?? raw.normalized ?? null);
    }
    return clampScore(raw);
}

function getDimensionReading(audit, key) {
    for (const { scores, source } of getDimensionScores(audit)) {
        const value = dimensionValue(scores, key);
        if (value !== null) return { value, source: source + '.' + key };
    }
    return { value: null, source: 'none' };
}

/** @returns {ScoreReading} */
function scoreReading({ value, source }) {
    return {
        value,
        provenance: value === null ? 'unavailable' : 'calculated',
        provenanceLabel: value === null ? 'Indisponible' : 'Calculée',
        source,
    };
}

/**
 * @typedef {Object} ScoreReading
 * @property {number|null} value — score normalisé 0-100 (null si indisponible)
 * @property {'measured'|'calculated'|'ai'|'unavailable'} provenance
 * @property {string} provenanceLabel — libellé UI (Mesurée/Calculée/Analyse IA/Indisponible)
 * @property {string} source — identifiant technique (ex. 'layered.dimension_scores.technical_seo')
 */

/** @returns {ScoreReading} */
export function readSeoScore(audit) {
    const layered = getDimensionReading(audit, 'technical_seo');
    return scoreReading(
        firstScore(
            [layered.value, layered.source],
            [audit?.seo_score, 'legacy.seo_score'],
            [audit?.breakdown?.technical_seo?.score, 'legacy.breakdown.technical_seo'],
        ),
    );
}

/** @returns {ScoreReading} */
export function readGeoScore(audit) {
    const local = getDimensionReading(audit, 'local_readiness');
    const layered = local.value !== null ? local : getDimensionReading(audit, 'ai_answerability');
    return scoreReading(
        firstScore(
            [layered.value, layered.source],
            [audit?.geo_score, 'legacy.geo_score'],
            [audit?.breakdown?.local_readiness?.score, 'legacy.breakdown.local_readiness'],
        ),
    );
}

/** @returns {ScoreReading} */
export function readOverallScore(audit) {
    // Preserve historical overall priority before deterministic persisted alternatives.
    const reading = firstScore(
        [audit?.deterministic_score, 'deterministic_score'],
        [audit?.overall_score, 'overall_score'],
        [audit?.breakdown?.overall?.score, 'legacy.breakdown.overall.score'],
        [
            getLayeredRoot(audit)?.final_trouvable_score?.deterministic_score,
            'layered.final_trouvable_score.deterministic_score',
        ],
        [audit?.seo_breakdown?.overall?.deterministic_score, 'legacy.seo_breakdown.overall.deterministic_score'],
        [audit?.geo_breakdown?.overall?.deterministic_score, 'legacy.geo_breakdown.overall.deterministic_score'],
    );
    if (reading.value !== null) return scoreReading(reading);

    const seo = readSeoScore(audit);
    const geo = readGeoScore(audit);
    return scoreReading(
        seo.value !== null && geo.value !== null
            ? { value: Math.round((seo.value + geo.value) / 2), source: 'derived.seo+geo/2' }
            : reading,
    );
}

/**
 * Lecture des 5 dimensions canoniques.
 *
 * @returns {Record<string, ScoreReading>}
 */
export function readDimensions(audit) {
    const keys = ['technical_seo', 'local_readiness', 'ai_answerability', 'trust_signals', 'identity_completeness'];
    const result = {};
    for (const key of keys) {
        const layered = getDimensionReading(audit, key);
        result[key] = scoreReading(
            firstScore([layered.value, layered.source], [audit?.breakdown?.[key]?.score, 'legacy.breakdown.' + key]),
        );
    }
    return result;
}
