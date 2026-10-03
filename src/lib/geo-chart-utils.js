/**
 * Prépare des séries pour GeoChart à partir de données DB (audits, query runs).
 * Aucune donnée inventée.
 */

/**
 * Audits avec seo_score et geo_score renseignés, tri chronologique croissant.
 * @returns {{ labels: string[], seo: number[], geo: number[] } | null}
 */
export function auditsToScoreSeries(audits) {
    if (!Array.isArray(audits) || audits.length === 0) return null;

    const sorted = [...audits]
        .filter((a) => a.seo_score !== null && a.seo_score !== undefined && a.geo_score !== null && a.geo_score !== undefined)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (sorted.length === 0) return null;

    const labels = sorted.map((a) =>
        new Date(a.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
        })
    );

    return {
        labels,
        seo: sorted.map((a) => Number(a.seo_score)),
        geo: sorted.map((a) => Number(a.geo_score)),
    };
}

/**
 * Runs terminés : proxy binaire marque détectée (100 / 0), ordre chronologique.
 */
/**
 * Timeline agrégée (mentions source par jour) — au moins 2 points pour un graphe utile.
 * @param {{ date: string, count: number }[]} timeline
 */
export function sourceMentionsTimelineToSeries(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) return null;
    const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return null;
    const labels = sorted.map((t) =>
        new Date(t.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    );
    return {
        labels,
        counts: sorted.map((t) => Number(t.count) || 0),
    };
}

/**
 * Taux de détection cumulé par jour calendaire, pour les N modèles les plus actifs.
 * Chaque point = % de runs terminés avec target_found jusqu’à la fin du jour (données réelles).
 */
export function cumulativeVisibilityByTopModels(runs, maxModels = 3) {
    if (!Array.isArray(runs) || runs.length < 2) return null;

    const completed = runs.filter((r) => r.status === 'completed' || r.status === null || r.status === undefined);
    if (completed.length < 2) return null;

    const modelKey = (r) => `${r.provider || 'unknown'}::${r.model || 'unknown'}`;
    const counts = new Map();
    for (const r of completed) {
        const k = modelKey(r);
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxModels)
        .map(([k]) => k);
    if (top.length === 0) return null;

    const dayKey = (iso) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const sortedAsc = [...completed].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const allDays = [...new Set(sortedAsc.map((r) => dayKey(r.created_at)))].sort();
    if (allDays.length < 2) return null;

    const COLORS = ['#a78bfa', '#5b73ff', '#34d399', '#f59e0b', '#ec4899'];

    const series = top.map((mk, si) => {
        const data = allDays.map((day) => {
            const end = new Date(day + 'T23:59:59.999Z').getTime();
            const rs = sortedAsc.filter(
                (r) => modelKey(r) === mk && new Date(r.created_at).getTime() <= end
            );
            if (rs.length === 0) return NaN;
            const found = rs.filter((r) => r.target_found).length;
            return Math.round((found / rs.length) * 100);
        });
        return {
            label: mk.replace('::', ' · '),
            color: COLORS[si % COLORS.length],
            data,
        };
    });

    const labels = allDays.map((d) =>
        new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    );

    return { labels, series };
}

export function queryRunsToVisibilitySeries(runs) {
    if (!Array.isArray(runs) || runs.length === 0) return null;

    const sorted = [...runs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (sorted.length === 0) return null;

    const labels = sorted.map((r) =>
        new Date(r.created_at).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })
    );

    return {
        labels,
        visibility: sorted.map((r) => (r.target_found ? 100 : 0)),
    };
}
