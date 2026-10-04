import { finiteNumberOrNull as toNumber } from '../numbers.js';

export function computeDelta(latestValue, previousValue) {
    const latest = toNumber(latestValue);
    const previous = toNumber(previousValue);
    if (latest === null || latest === undefined) return { latest: null, previous, delta: null };
    if (previous === null || previous === undefined) return { latest, previous: null, delta: null };
    return {
        latest,
        previous,
        delta: Math.round((latest - previous) * 100) / 100,
    };
}

export function buildMetricTrendSummary({ snapshots = [], metricKey, days = 30 }) {
    const now = Date.now();
    const windowStart = now - days * 24 * 60 * 60 * 1000;

    const series = (snapshots || [])
        .map((row) => ({
            date: row.snapshot_date || String(row.captured_at || '').slice(0, 10),
            value: toNumber(row[metricKey]),
        }))
        .filter((row) => row.date && row.value !== null && row.value !== undefined)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const seriesInWindow = series.filter((row) => {
        const ts = new Date(`${row.date}T00:00:00.000Z`).getTime();
        return Number.isFinite(ts) && ts >= windowStart;
    });

    const latestPoint = seriesInWindow.at(-1) || series.at(-1) || null;
    const previousPoint =
        (seriesInWindow.length >= 2 ? seriesInWindow.at(-2) : null) ||
        (series.length >= 2 ? series.at(-2) : null) ||
        null;

    const delta = computeDelta(latestPoint?.value ?? null, previousPoint?.value ?? null);

    return {
        latest: latestPoint?.value ?? null,
        previous: previousPoint?.value ?? null,
        delta: delta.delta,
        latestDate: latestPoint?.date || null,
        previousDate: previousPoint?.date || null,
        points: seriesInWindow,
    };
}

export function classifyFreshness(iso, staleHours = 72) {
    if (!iso) return { state: 'missing', hours: null };
    const timestamp = new Date(iso).getTime();
    if (!Number.isFinite(timestamp)) return { state: 'missing', hours: null };
    const diffMs = Date.now() - timestamp;
    const hours = Math.round(diffMs / (1000 * 60 * 60));

    if (hours <= Math.max(24, Math.floor(staleHours / 2))) {
        return { state: 'fresh', hours };
    }

    if (hours <= staleHours) {
        return { state: 'warning', hours };
    }

    return { state: 'stale', hours };
}

export function splitImprovingDeclining(metricRows = []) {
    const improving = [];
    const declining = [];

    for (const metric of metricRows) {
        if (metric.delta === null || metric.delta === undefined) continue;
        if (metric.delta > 0) improving.push(metric);
        else if (metric.delta < 0) declining.push(metric);
    }

    improving.sort((a, b) => b.delta - a.delta);
    declining.sort((a, b) => a.delta - b.delta);

    return {
        improving: improving.slice(0, 5),
        declining: declining.slice(0, 5),
    };
}
