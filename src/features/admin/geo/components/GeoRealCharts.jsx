'use client';

import GeoChart from './GeoChart';
import {
    auditsToScoreSeries,
    queryRunsToVisibilitySeries,
    sourceMentionsTimelineToSeries,
    cumulativeVisibilityByTopModels,
} from '@/lib/geo-chart-utils';

/**
 * Graphiques alimentés uniquement par l’historique DB (recentAudits / recentQueryRuns).
 */
export function AuditScoresLineChart({ recentAudits }) {
    const built = auditsToScoreSeries(recentAudits);

    if (!built || built.seo.length < 1) {
        return (
            <div className="geo-premium-card p-6 border border-white/10 border-dashed">
                <div className="text-sm font-semibold text-white/90 mb-1">Évolution SEO &amp; GEO</div>
                <p className="text-xs text-white/35 mb-2">
                    Pas assez d’audits avec scores SEO et GEO pour tracer une courbe. Lancez des audits complets
                    (statut succès ou partiel avec scores).
                </p>
            </div>
        );
    }

    return (
        <div className="geo-premium-card p-5 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div>
                    <div className="text-sm font-semibold text-white/90">Évolution SEO &amp; GEO</div>
                    <p className="text-[11px] text-white/35 mt-0.5">
                        Données réelles : {built.seo.length} audit{built.seo.length > 1 ? 's' : ''} avec scores
                    </p>
                </div>
                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-[0.08em]">
                    <span className="text-emerald-400/90">● SEO</span>
                    <span className="text-violet-400/90">● GEO</span>
                </div>
            </div>
            <GeoChart
                id="audit-scores"
                series={[
                    { label: 'SEO', data: built.seo, color: '#34d399' },
                    { label: 'GEO', data: built.geo, color: '#a78bfa' },
                ]}
                options={{
                    height: 160,
                    min: 0,
                    max: 100,
                    unit: '',
                    grid: true,
                    gridVals: [0, 50, 100],
                    showLabels: true,
                    interactive: true,
                    labels: built.labels,
                }}
            />
        </div>
    );
}

export function QueryRunsVisibilityChart({ recentQueryRuns }) {
    const built = queryRunsToVisibilitySeries(recentQueryRuns);

    if (!built || built.visibility.length < 1) {
        return (
            <div className="geo-premium-card p-6 border border-white/10 border-dashed">
                <div className="text-sm font-semibold text-white/90 mb-1">Runs : marque détectée (proxy)</div>
                <p className="text-xs text-white/35">Aucun GEO query run enregistré pour ce graphique.</p>
            </div>
        );
    }

    return (
        <div className="geo-premium-card p-5 overflow-hidden">
            <div className="mb-3">
                <div className="text-sm font-semibold text-white/90">Marque mentionnée par run (proxy)</div>
                <p className="text-[11px] text-white/35 mt-0.5">
                    100 = marque cible détectée dans la réponse, 0 = non. {built.visibility.length} run
                    {built.visibility.length > 1 ? 's' : ''} (ordre chronologique)
                </p>
            </div>
            <GeoChart
                id="query-visibility"
                series={[{ label: 'Détection', data: built.visibility, color: '#5b73ff' }]}
                options={{
                    height: 140,
                    min: 0,
                    max: 100,
                    unit: '',
                    grid: true,
                    gridVals: [0, 50, 100],
                    showLabels: built.visibility.length <= 8,
                    interactive: true,
                    labels: built.labels,
                }}
            />
        </div>
    );
}

/**
 * Évolution du nombre de mentions « source » par jour (agrégation DB).
 */
export function SourcesTimelineChart({ sourceMentionsTimeline }) {
    const built = sourceMentionsTimelineToSeries(sourceMentionsTimeline);

    if (!built || built.counts.length < 2) {
        return (
            <div className="geo-premium-card p-6 border border-white/10 border-dashed">
                <div className="text-sm font-semibold text-white/90 mb-1">Citations : volume par jour</div>
                <p className="text-xs text-white/35">
                    Pas assez d’historique (au moins 2 jours avec des mentions source) pour afficher une courbe.
                </p>
            </div>
        );
    }

    const maxVal = Math.max(...built.counts, 1);

    return (
        <div className="geo-premium-card p-5 overflow-hidden">
            <div className="mb-3">
                <div className="text-sm font-semibold text-white/90">Mentions source par jour</div>
                <p className="text-[11px] text-white/35 mt-0.5">
                    Agrégation réelle : {built.counts.length} jour{built.counts.length > 1 ? 's' : ''}
                </p>
            </div>
            <GeoChart
                id="sources-timeline"
                series={[{ label: 'Sources', data: built.counts, color: '#c084fc' }]}
                options={{
                    height: 140,
                    min: 0,
                    max: maxVal,
                    unit: '',
                    grid: true,
                    showLabels: built.counts.length <= 14,
                    interactive: true,
                    labels: built.labels,
                }}
            />
        </div>
    );
}

/**
 * Tendance multi-modèles : taux de détection cumulé par jour (top providers réels).
 */
export function CumulativeModelVisibilityChart({ recentQueryRuns, title = 'Tendance visibilité IA', subtitle }) {
    const built = cumulativeVisibilityByTopModels(recentQueryRuns || [], 4);

    if (!built || !built.series?.length) {
        return (
            <div className="geo-premium-card p-6 border border-white/10 border-dashed">
                <div className="text-sm font-semibold text-white/90 mb-1">{title}</div>
                <p className="text-xs text-white/35">
                    Pas assez de runs sur plusieurs jours / modèles pour tracer une tendance cumulée.
                </p>
            </div>
        );
    }

    return (
        <div className="geo-premium-card p-5 overflow-hidden geo-premium-glow-violet">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div>
                    <div className="text-sm font-semibold text-white/95">{title}</div>
                    <p className="text-[11px] text-white/35 mt-0.5">
                        {subtitle ||
                            'Taux cumulé de détection marque par jour, modèles réellement utilisés dans vos runs'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end max-w-[240px]">
                    {built.series.map((s) => (
                        <span key={s.label} className="text-[10px] font-bold uppercase tracking-[0.06em] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                            <span className="text-white/50 truncate max-w-[104px]">{s.label}</span>
                        </span>
                    ))}
                </div>
            </div>
            <GeoChart
                id="cumulative-model-vis"
                series={built.series}
                options={{
                    height: 200,
                    min: 0,
                    max: 100,
                    unit: '',
                    grid: true,
                    gridVals: [0, 50, 100],
                    showLabels: built.labels.length <= 8,
                    interactive: true,
                    labels: built.labels,
                    fillArea: false,
                    lw: 2.5,
                }}
            />
        </div>
    );
}
