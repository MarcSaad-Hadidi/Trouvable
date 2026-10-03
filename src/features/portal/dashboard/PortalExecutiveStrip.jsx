'use client';

import { motion } from 'framer-motion';
import PremiumSparkline from '@/components/shared/metrics/PremiumSparkline';

function deriveOverallState(visibility, completeness) {
    const seo = visibility.seo_score;
    const geo = visibility.geo_score;
    const avg = seo != null && geo != null ? Math.round((seo + geo) / 2) : (seo ?? geo ?? null);

    if (avg == null)
        return { label: "En cours d'évaluation", sub: 'Premiers résultats en préparation', accent: 'text-white/50', bar: 0 };
    if (avg >= 75)
        return { label: 'Excellent', sub: `Score consolidé ${avg}/100`, accent: 'text-emerald-400', bar: avg };
    if (avg >= 50)
        return { label: 'En progression', sub: `Score consolidé ${avg}/100`, accent: 'text-[#7b8fff]', bar: avg };
    return { label: 'Chantier en cours', sub: `Score consolidé ${avg}/100`, accent: 'text-amber-300', bar: avg };
}

function deriveWorkState(items) {
    const count = items.length;
    if (count === 0) return { label: 'Aucune activité', sub: "Prochaine intervention en attente", accent: 'text-white/50', bar: 0 };

    const latest = items[0];
    const dateStr = latest?.created_at
        ? new Date(latest.created_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })
        : null;

    return {
        label: `${count} intervention${count > 1 ? 's' : ''}`,
        sub: dateStr ? `Dernière · ${dateStr}` : (latest?.title || ''),
        accent: 'text-white',
        bar: Math.min(count * 18, 100),
    };
}

function deriveTrendState(trendSummary) {
    const metrics = trendSummary?.metrics || [];
    const withDelta = metrics.filter((m) => m.delta != null);

    if (withDelta.length === 0)
        return { label: 'En attente', sub: 'Tendances bientôt disponibles', accent: 'text-white/50', bar: 0 };

    const up = withDelta.filter((m) => m.delta > 0).length;
    const down = withDelta.filter((m) => m.delta < 0).length;
    const ratio = Math.round((up / withDelta.length) * 100);

    if (up > down)
        return { label: 'Tendance positive', sub: `${up}/${withDelta.length} indicateur${up > 1 ? 's' : ''} en hausse`, accent: 'text-emerald-400', bar: ratio };
    if (down > up)
        return { label: "Points d'attention", sub: `${down}/${withDelta.length} en recul`, accent: 'text-amber-300', bar: ratio };
    return { label: 'Stabilité', sub: 'Indicateurs stables sur 30 jours', accent: 'text-white/50', bar: 50 };
}

const TILES = [
    { key: 'state', title: 'État du mandat', barColor: 'from-[#5b73ff]/40 to-[#5b73ff]/10', sparkKey: 'seo_score', sparkColor: '#5b73ff' },
    { key: 'work', title: 'Activité récente', barColor: 'from-[#a78bfa]/40 to-[#a78bfa]/10', sparkKey: null, sparkColor: '#a78bfa' },
    { key: 'trend', title: 'Évolution 30j', barColor: 'from-emerald-400/40 to-emerald-400/10', sparkKey: 'visibility_proxy_percent', sparkColor: '#34d399' },
];

const ease = [0.16, 1, 0.3, 1];

export default function PortalExecutiveStrip({ visibility, completeness, recentWorkItems, trendSummary, dataSources = {} }) {
    const sparklines = trendSummary?.sparklines || {};
    const unavailable = { label: 'Indisponible', sub: 'La source de données ne répond pas.', accent: 'text-white/50', bar: 0 };
    const states = {
        state: dataSources.workspace === 'unavailable' ? unavailable : deriveOverallState(visibility, completeness),
        work: dataSources.actions === 'unavailable' ? unavailable : deriveWorkState(recentWorkItems),
        trend: dataSources.history === 'unavailable' ? unavailable : deriveTrendState(trendSummary),
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-[24px] border border-white/[0.05] bg-[#0a0a0d] shadow-[0_20px_60px_rgba(0,0,0,0.38)]"
        >
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <div className="grid grid-cols-1 divide-y divide-white/[0.04] md:grid-cols-3 md:divide-x md:divide-y-0">
                {TILES.map((tile, i) => {
                    const data = states[tile.key];
                    const sparkData = tile.sparkKey ? sparklines[tile.sparkKey] || [] : [];
                    const hasSparkData = sparkData.filter((v) => v != null).length >= 2;

                    return (
                        <motion.div
                            key={tile.key}
                            initial={{ opacity: 0, y: 14 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
                            className="group relative px-7 py-6 transition-colors duration-300 hover:bg-white/[0.012]"
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">
                                    {tile.title}
                                </span>
                                {hasSparkData && (
                                    <PremiumSparkline
                                        data={sparkData}
                                        color={tile.sparkColor}
                                        width={64}
                                        height={24}
                                        strokeWidth={1.5}
                                        showEndDot={false}
                                        showArea={false}
                                    />
                                )}
                            </div>

                            <div className={`mb-1 text-[18px] font-bold tracking-[-0.02em] ${data.accent}`}>
                                {data.label}
                            </div>

                            <div className="mb-5 text-[13px] leading-relaxed text-white/30">{data.sub}</div>

                            {data.bar > 0 && (
                                <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.03]">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${data.bar}%` }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.4 + i * 0.12, duration: 1, ease }}
                                        className={`h-full rounded-full bg-gradient-to-r ${tile.barColor}`}
                                    />
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
