/**
 * scores-facade — lecture canonique des scores d'audit.
 *
 * Contexte :
 *   - Les audits exposent à la fois des champs legacy (`seo_score`, `geo_score`,
 *     `seo_breakdown`, `geo_breakdown`) et la nouvelle structure layered
 *     (`extracted_data.layered_v1.dimension_scores`, `layer1`, `layer2`).
 *   - Les surfaces consommatrices mélangent les deux, créant des incohérences
 *     subtiles (ex. un badge "Santé SEO" basé sur `seo_score` pendant que la
 *     surface Lab affiche `dimension_scores.technical_seo`).
 *
 * Cette façade fournit des accesseurs uniques + métadonnées sur la provenance
 * (measured | calculated | ai | unavailable) alignés sur les libellés produit
 * (Mesurée / Calculée / Analyse IA / Indisponible).
 *
 * Règle d'or : aucune surface ne doit lire directement `audit.seo_score` ;
 * passer par `readSeoScore(audit)` pour bénéficier des fallbacks + provenance.
 */

import { finiteNumberOrNull } from '../numbers.js';

function clampScore(value) {
    const numeric = finiteNumberOrNull(value);
    if (numeric === null) return null;
    if (numeric < 0) return 0;
    if (numeric > 100) return 100;
    return Math.round(numeric);
}

function firstNumber(...candidates) {
    for (const candidate of candidates) {
        const parsed = clampScore(candidate);
        if (parsed !== null) return parsed;
    }
    return null;
}

function getLayeredRoot(audit) {
    const extracted = audit?.extracted_data;
    if (!extracted || typeof extracted !== 'object') return null;
    return extracted.layered_v1 && typeof extracted.layered_v1 === 'object'
        ? extracted.layered_v1
        : null;
}

function getDimensionScores(audit) {
    const layered = getLayeredRoot(audit);
    if (layered?.dimension_scores && typeof layered.dimension_scores === 'object') {
        return layered.dimension_scores;
    }
    const extracted = audit?.extracted_data;
    if (extracted?.dimension_scores && typeof extracted.dimension_scores === 'object') {
        return extracted.dimension_scores;
    }
    return null;
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

function provenanceLabel(kind) {
    switch (kind) {
        case 'measured':
            return 'Mesurée';
        case 'calculated':
            return 'Calculée';
        case 'ai':
            return 'Analyse IA';
        default:
            return 'Indisponible';
    }
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
    const dimensionScores = getDimensionScores(audit);
    const layeredValue = dimensionValue(dimensionScores, 'technical_seo');
    if (layeredValue !== null) {
        return {
            value: layeredValue,
            provenance: 'calculated',
            provenanceLabel: provenanceLabel('calculated'),
            source: 'layered.dimension_scores.technical_seo',
        };
    }

    const legacy = firstNumber(audit?.seo_score, audit?.breakdown?.technical_seo?.score);
    if (legacy !== null) {
        return {
            value: legacy,
            provenance: 'calculated',
            provenanceLabel: provenanceLabel('calculated'),
            source: 'legacy.seo_score',
        };
    }

    return {
        value: null,
        provenance: 'unavailable',
        provenanceLabel: provenanceLabel('unavailable'),
        source: 'none',
    };
}

/** @returns {ScoreReading} */
export function readGeoScore(audit) {
    const dimensionScores = getDimensionScores(audit);
    const layeredValue = dimensionValue(dimensionScores, 'local_readiness')
        ?? dimensionValue(dimensionScores, 'ai_answerability');
    if (layeredValue !== null) {
        return {
            value: layeredValue,
            provenance: 'calculated',
            provenanceLabel: provenanceLabel('calculated'),
            source: 'layered.dimension_scores.local_readiness',
        };
    }

    const legacy = firstNumber(audit?.geo_score, audit?.breakdown?.local_readiness?.score);
    if (legacy !== null) {
        return {
            value: legacy,
            provenance: 'calculated',
            provenanceLabel: provenanceLabel('calculated'),
            source: 'legacy.geo_score',
        };
    }

    return {
        value: null,
        provenance: 'unavailable',
        provenanceLabel: provenanceLabel('unavailable'),
        source: 'none',
    };
}

/** @returns {ScoreReading} */
export function readOverallScore(audit) {
    const overall = firstNumber(
        audit?.deterministic_score,
        audit?.overall_score,
        audit?.breakdown?.overall?.score,
    );
    if (overall !== null) {
        return {
            value: overall,
            provenance: 'calculated',
            provenanceLabel: provenanceLabel('calculated'),
            source: 'deterministic_score',
        };
    }

    const seo = readSeoScore(audit);
    const geo = readGeoScore(audit);
    if (seo.value !== null && geo.value !== null) {
        return {
            value: Math.round((seo.value + geo.value) / 2),
            provenance: 'calculated',
            provenanceLabel: provenanceLabel('calculated'),
            source: 'derived.seo+geo/2',
        };
    }

    return {
        value: null,
        provenance: 'unavailable',
        provenanceLabel: provenanceLabel('unavailable'),
        source: 'none',
    };
}

/**
 * Lecture des 5 dimensions canoniques.
 *
 * @returns {Record<string, ScoreReading>}
 */
export function readDimensions(audit) {
    const keys = [
        'technical_seo',
        'local_readiness',
        'ai_answerability',
        'trust_signals',
        'identity_completeness',
    ];
    const dimensionScores = getDimensionScores(audit);
    const result = {};
    for (const key of keys) {
        const value = dimensionValue(dimensionScores, key);
        if (value !== null) {
            result[key] = {
                value,
                provenance: 'calculated',
                provenanceLabel: provenanceLabel('calculated'),
                source: `layered.dimension_scores.${key}`,
            };
        } else {
            const legacyValue = firstNumber(audit?.breakdown?.[key]?.score);
            result[key] = legacyValue !== null
                ? {
                    value: legacyValue,
                    provenance: 'calculated',
                    provenanceLabel: provenanceLabel('calculated'),
                    source: `legacy.breakdown.${key}`,
                }
                : {
                    value: null,
                    provenance: 'unavailable',
                    provenanceLabel: provenanceLabel('unavailable'),
                    source: 'none',
                };
        }
    }
    return result;
}

export function hasLayeredAudit(audit) {
    return getLayeredRoot(audit) !== null;
}

export function getAuditReliability(audit) {
    if (hasLayeredAudit(audit)) return 'calculated';
    if (readSeoScore(audit).value !== null || readGeoScore(audit).value !== null) return 'calculated';
    return 'unavailable';
}
