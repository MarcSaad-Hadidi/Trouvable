import 'server-only';

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no']);

export function isDailyFirstMode() {
    const raw = String(process.env.CONTINUOUS_DAILY_FIRST_MODE ?? '1').trim().toLowerCase();
    return !DISABLED_VALUES.has(raw);
}

export function getDailyCadenceFloorMinutes() {
    return 1440;
}

export function enforceDailyCadenceMinutes(cadenceMinutes) {
    const numeric = Number(cadenceMinutes);
    if (!Number.isFinite(numeric)) return getDailyCadenceFloorMinutes();
    if (!isDailyFirstMode()) return numeric;
    return Math.max(getDailyCadenceFloorMinutes(), Math.round(numeric));
}

export function getContinuousModeLabelFr() {
    return isDailyFirstMode() ? 'quotidien_hobby' : 'cadence_libre';
}
