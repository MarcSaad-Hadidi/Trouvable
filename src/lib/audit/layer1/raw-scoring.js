/**
 * Layer 1 raw category scoring — diagnostic only.
 *
 * Aggregates per-page deterministic checks into site-level category scores
 * (technical, content, geo, ai_readiness, trust). These scores are NEVER the
 * canonical Trouvable product score; they exist so operators can quickly see
 * scan-level health alongside the Trouvable-native weighted dimensions in
 * Layer 4.
 */

import { PAGE_CHECK_STATUS } from './page-checks.js';

function weightedStatusScore(status) {
    switch (status) {
        case PAGE_CHECK_STATUS.PASS: return 1;
        case PAGE_CHECK_STATUS.WARN: return 0.4;
        case PAGE_CHECK_STATUS.FAIL: return 0;
        default: return null;
    }
}

function roundScore(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * @param {Array<{ page_url: string, checks: Array<object> }>} pageResults
 * @returns {object} raw category scores + check counts
 */
export function aggregateRawScores(pageResults = []) {
    const categories = {};
    const checkIdCounts = new Map();

    let totalChecks = 0;
    let totalPass = 0;
    let totalWarn = 0;
    let totalFail = 0;
    let totalSkip = 0;

    for (const entry of pageResults) {
        const checks = Array.isArray(entry?.checks) ? entry.checks : [];
        for (const check of checks) {
            totalChecks += 1;
            if (check.status === PAGE_CHECK_STATUS.PASS) totalPass += 1;
            else if (check.status === PAGE_CHECK_STATUS.WARN) totalWarn += 1;
            else if (check.status === PAGE_CHECK_STATUS.FAIL) totalFail += 1;
            else totalSkip += 1;

            const weight = Number(check.weight) > 0 ? Number(check.weight) : 1;
            const category = check.category || 'other';
            if (!categories[category]) {
                categories[category] = { weighted_total: 0, weighted_achieved: 0, pass: 0, warn: 0, fail: 0, skip: 0 };
            }

            const categoryBucket = categories[category];
            const normalized = weightedStatusScore(check.status);
            if (normalized === null) {
                categoryBucket.skip += 1;
                continue;
            }
            categoryBucket.weighted_total += weight;
            categoryBucket.weighted_achieved += weight * normalized;
            if (check.status === PAGE_CHECK_STATUS.PASS) categoryBucket.pass += 1;
            else if (check.status === PAGE_CHECK_STATUS.WARN) categoryBucket.warn += 1;
            else if (check.status === PAGE_CHECK_STATUS.FAIL) categoryBucket.fail += 1;

            checkIdCounts.set(check.check_id, (checkIdCounts.get(check.check_id) || 0) + 1);
        }
    }

    const categoryScores = {};
    for (const [category, bucket] of Object.entries(categories)) {
        const score = bucket.weighted_total > 0
            ? (bucket.weighted_achieved / bucket.weighted_total) * 100
            : 0;
        categoryScores[category] = {
            score: roundScore(score),
            pass: bucket.pass,
            warn: bucket.warn,
            fail: bucket.fail,
            skip: bucket.skip,
        };
    }

    const overallTotal = Object.values(categories).reduce((acc, b) => acc + b.weighted_total, 0);
    const overallAchieved = Object.values(categories).reduce((acc, b) => acc + b.weighted_achieved, 0);
    const overall = overallTotal > 0 ? roundScore((overallAchieved / overallTotal) * 100) : 0;

    return {
        overall,
        categories: categoryScores,
        totals: {
            checks: totalChecks,
            pass: totalPass,
            warn: totalWarn,
            fail: totalFail,
            skip: totalSkip,
        },
        distinct_check_ids: checkIdCounts.size,
    };
}
