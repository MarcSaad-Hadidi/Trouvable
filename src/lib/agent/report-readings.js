/** Numeric and freshness rules shared by the two audit-derived AGENT reports. */
const FRESHNESS_CALCULATED_HOURS = 24 * 60; // ≤ 60j
const FRESHNESS_STALE_HOURS = 24 * 180; // ≤ 180j

export function clamp(value, min = 0, max = 100) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

export function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function hoursSince(iso) {
    if (!iso) return null;
    const parsed = new Date(iso).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.floor((Date.now() - parsed) / 3600000);
}

export function deriveReliability(audit) {
    if (!audit || !audit.created_at) return 'unavailable';
    const hours = hoursSince(audit.created_at);
    if (hours === null) return 'unavailable';
    if (hours <= FRESHNESS_CALCULATED_HOURS) return 'calculated';
    if (hours <= FRESHNESS_STALE_HOURS) return 'stale';
    return 'low';
}
