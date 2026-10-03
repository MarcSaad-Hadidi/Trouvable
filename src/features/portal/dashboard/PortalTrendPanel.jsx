'use client';

import { motion } from 'framer-motion';
import {
    TrendMaturityRibbon,
    TrendBaselineNarrativeBlock,
    TrendDualSection,
    MetricSparklineSlot,
} from './PortalTrendBaseline';

function deltaDisplay(delta, unit) {
    const suffix = unit === 'percent' ? ' pt' : '';
    if (delta > 0) return { text: `+${delta}${suffix}`, cls: 'text-emerald-400', sub: 'sur 30 jours' };
    if (delta < 0) return { text: `${delta}${suffix}`, cls: 'text-red-400/75', sub: 'sur 30 jours' };
    return { text: `stable`, cls: 'text-white/30', sub: 'sur 30 jours' };
}

/** Delta ou libellé premium quand la comparaison 30j n'est pas encore lisible. */
function deltaPresentation(delta, unit, coveragePoints) {
    if (delta != null) return deltaDisplay(delta, unit);
    if (coveragePoints <= 1) {
        return {
            text: 'Référence initiale',
            cls: 'text-white/38',
            sub: 'La variation apparaîtra après la prochaine mesure',
        };
    }
    return {
        text: 'En consolidation',
        cls: 'text-white/30',
        sub: 'Comparaison sur 30 jours dès que la fenêtre sera complète',
    };
}

function valueStr(latest, unit) {
    if (latest == null) return 'n.d.';
    return unit === 'percent' ? `${latest}%` : `${latest}`;
}

function fmtSnapshotDate(iso) {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString('fr-CA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return null;
    }
}

function deriveTrendNarrative(metrics) {
    const withDelta = metrics.filter((m) => m.delta != null);
    if (withDelta.length === 0) return null;

    const up = withDelta.filter((m) => m.delta > 0);
    const down = withDelta.filter((m) => m.delta < 0);

    if (up.length > 0 && down.length === 0) {
        return `Tous les indicateurs suivis sont en progression sur les 30 derniers jours. Le dossier évolue dans la bonne direction.`;
    }
    if (down.length > 0 && up.length === 0) {
        return `Certains indicateurs affichent un recul. L'équipe a identifié ces points d'attention et travaille sur les actions correctives.`;
    }
    if (up.length > down.length) {
        return `La tendance générale reste positive, avec ${up.length} indicateur${up.length > 1 ? 's' : ''} en hausse. ${down.length > 0 ? `${down.length} point${down.length > 1 ? 's' : ''} d'attention identifié${down.length > 1 ? 's' : ''}.` : ''}`;
    }
    return `Évolution mixte sur la période : ${up.length} indicateur${up.length > 1 ? 's' : ''} en hausse, ${down.length} en recul. L'analyse détaillée est en cours.`;
}

function EmptyStatePremium() {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.008] px-8 py-12 text-center">
            <div className="mx-auto mb-4 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                Historique à constituer
            </div>
            <p className="mx-auto max-w-md text-[14px] leading-[1.75] text-white/38">
                Les tendances du mandat apparaîtront ici après les premiers cycles de mesure. Dès qu&apos;une première
                photographie sera enregistrée, vous verrez vos indicateurs et le point de départ de votre dossier.
            </p>
        </div>
    );
}

function TrendNarrativeGap({ coveragePoints }) {
    if (coveragePoints < 2) return null;
    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.55 }}
            className="mb-6 rounded-lg border border-white/[0.04] bg-white/[0.015] px-4 py-3"
        >
            <p className="text-[13px] leading-[1.7] text-white/32">
                Les écarts sur 30 jours s&apos;afficheront dès que la base de comparaison sera suffisante. Les valeurs
                ci-dessous reflètent la dernière lecture disponible.
            </p>
        </motion.div>
    );
}

const ease = [0.16, 1, 0.3, 1];

export default function PortalTrendPanel({ trendSummary }) {
    const metrics = trendSummary?.metrics || [];
    const coverage = trendSummary?.coverage || {};
    const sparklines = trendSummary?.sparklines || {};
    const points = coverage.points ?? 0;

    const narrative = deriveTrendNarrative(metrics);
    const showBaselineNarrative = points === 1;
    const showGapNarrative = points >= 2 && !narrative;

    return (
        <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0d] shadow-[0_24px_70px_rgba(0,0,0,0.4)]"
        >
            <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent" />

            <div className="px-8 pb-0 pt-8 md:px-10 md:pt-10">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]/45">
                            Évolution
                        </div>
                        <h2 className="text-[20px] font-bold tracking-[-0.03em] text-white">Tendances du mandat</h2>
                    </div>
                </div>

                {points > 0 && (
                    <TrendMaturityRibbon points={points} startDate={coverage.startDate} endDate={coverage.endDate} />
                )}

                {showBaselineNarrative && <TrendBaselineNarrativeBlock points={points} />}

                {narrative && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="mb-6 border-l-2 border-emerald-400/15 pl-5"
                    >
                        <p className="max-w-2xl text-[14px] leading-[1.72] text-white/35">{narrative}</p>
                    </motion.div>
                )}

                {showGapNarrative && <TrendNarrativeGap coveragePoints={points} />}
            </div>

            <TrendDualSection sparklines={sparklines} metrics={metrics} coveragePoints={points} />

            {points === 0 ? (
                <div className="px-8 pb-8 md:px-10 md:pb-10">
                    <EmptyStatePremium />
                </div>
            ) : (
                <div className="border-t border-white/[0.03]">
                    {points === 1 && (
                        <div className="px-7 py-3 md:px-10 border-b border-white/[0.03]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/18">
                                Point de départ par indicateur
                            </p>
                        </div>
                    )}
                    <div className="grid divide-y divide-white/[0.03] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
                        {metrics.map((metric, i) => {
                            const d = deltaPresentation(metric.delta, metric.unit, points);
                            const sparkColor =
                                metric.delta > 0 ? '#34d399' : metric.delta < 0 ? '#f87171' : '#94a3b8';
                            const sparkData = sparklines[metric.key] || [];

                            return (
                                <motion.div
                                    key={metric.key}
                                    initial={{ opacity: 0, y: 12 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-30px' }}
                                    transition={{ delay: i * 0.07, duration: 0.5, ease: 'easeOut' }}
                                    className="group relative px-7 py-6 transition-colors duration-300 hover:bg-white/[0.01]"
                                >
                                    <div className="mb-4 flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/22">
                                            {metric.label}
                                        </span>
                                        <MetricSparklineSlot
                                            data={sparkData}
                                            color={sparkColor}
                                            width={56}
                                            height={22}
                                            strokeWidth={1.5}
                                        />
                                    </div>

                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <div className="text-[28px] font-black tabular-nums tracking-[-0.03em] text-white">
                                                {valueStr(metric.latest, metric.unit)}
                                            </div>
                                            {points === 1 && metric.latestDate && (
                                                <div className="mt-1 text-[10px] text-white/18 tabular-nums">
                                                    Relevé · {fmtSnapshotDate(metric.latestDate) || metric.latestDate}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                                            <span
                                                className={`text-[12px] sm:text-[13px] font-bold tabular-nums leading-tight ${d.cls}`}
                                            >
                                                {d.text}
                                            </span>
                                            {d.sub && (
                                                <span className="max-w-[140px] text-[9px] leading-snug text-white/18">
                                                    {d.sub}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {metric.latest != null && metric.unit === 'percent' && (
                                        <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/[0.025]">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                whileInView={{ width: `${Math.min(metric.latest, 100)}%` }}
                                                viewport={{ once: true }}
                                                transition={{ delay: 0.5 + i * 0.1, duration: 1.2, ease }}
                                                className="h-full rounded-full"
                                                style={{
                                                    background: `linear-gradient(90deg, ${sparkColor}55, ${sparkColor}18)`,
                                                }}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.section>
    );
}
