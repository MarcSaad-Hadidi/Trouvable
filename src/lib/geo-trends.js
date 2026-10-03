/**
 * Tendances dérivées de séries réelles uniquement (pas de valeurs inventées).
 */

/**
 * Compare la moitié récente des runs à la moitié plus ancienne (ordre chronologique).
 * Retourne des points de pourcentage (ex. +12) ou null si données insuffisantes.
 * @param {Array<{ target_found?: boolean, created_at?: string, status?: string }>} runs
 * @returns {number | null}
 */
export function visibilityTrendPercentPoints(runs) {
    if (!Array.isArray(runs) || runs.length < 4) return null;
    const completed = runs.filter((r) => r.status === 'completed' || r.status === null || r.status === undefined);
    if (completed.length < 4) return null;
    const sorted = [...completed].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);
    const rate = (arr) => (arr.length === 0 ? 0 : arr.filter((r) => r.target_found).length / arr.length);
    return Math.round((rate(second) - rate(first)) * 100);
}
