'use client';

import { motion } from 'framer-motion';
import PremiumSparkline from '@/components/shared/metrics/PremiumSparkline';

/**
 * Bandeau de maturité + message pour première mesure / historique en construction.
 */
export function TrendMaturityRibbon({ points, startDate, endDate }) {
    if (points <= 0) return null;

    const isFirst = points === 1;
    const isBuilding = points === 2;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-white/[0.015] to-transparent px-5 py-4"
        >
            <div className="flex flex-wrap items-center gap-2">
                {isFirst && (
                    <span className="inline-flex items-center rounded-full border border-[#7b8fff]/25 bg-[#5b73ff]/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a5b4fc]">
                        Première mesure
                    </span>
                )}
                {isBuilding && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300/80">
                        Historique en construction
                    </span>
                )}
                {points > 2 && points < 5 && (
                    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                        Base de comparaison en consolidation
                    </span>
                )}
                {points >= 5 && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/55">
                        Historique établi
                    </span>
                )}
            </div>
            <div className="text-[11px] tabular-nums text-white/28">
                {points} mesure{points > 1 ? 's' : ''}
                {startDate ? ` · ${startDate}` : ''}
                {endDate && endDate !== startDate ? ` ? ${endDate}` : ''}
            </div>
        </motion.div>
    );
}

/**
 * Bloc narratif premium : baseline / pas encore de tendance calculée.
 */
export function TrendBaselineNarrativeBlock({ points }) {
    if (points !== 1) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12, duration: 0.55 }}
            className="mb-6 rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4"
        >
            <p className="text-[13px] leading-[1.75] text-white/42">
                <span className="font-semibold text-white/55">Lecture initiale.</span>{' '}
                Cette première photographie de vos indicateurs sert de point de départ. La base de comparaison
                se construit au fil des prochains cycles. Les tendances se préciseront dès que plusieurs mesures
                seront disponibles.
            </p>
        </motion.div>
    );
}

/**
 * SEO & GEO : une seule mesure — affichage « point de départ » (pas de courbe).
 */
export function TrendDualBaselineScores({ metrics }) {
    const seoM = metrics.find((m) => m.key === 'seo_score');
    const geoM = metrics.find((m) => m.key === 'geo_score');
    if (!seoM && !geoM) return null;
    if (seoM?.latest == null && geoM?.latest == null) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="mx-8 mb-6 rounded-xl border border-white/[0.05] bg-white/[0.015] px-5 py-4 md:mx-10"
            >
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/22 mb-1">
                    SEO et GEO : première mesure
                </div>
                <p className="text-[12px] leading-relaxed text-white/32">
                    Les scores SEO et GEO détaillés apparaîtront ici dès qu&apos;ils seront présents sur ce relevé. Les
                    autres indicateurs ci-dessous reflètent déjà votre point de départ.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mx-8 mb-6 md:mx-10"
        >
            <div className="rounded-xl border border-white/[0.05] bg-gradient-to-b from-white/[0.03] to-white/[0.008] p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/28">
                        SEO et GEO : point de départ
                    </span>
                    <span className="text-[10px] text-white/22">Courbes après 2e mesure</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {seoM?.latest != null && (
                        <BaselineScorePillar label="SEO" value={seoM.latest} accent="#34d399" />
                    )}
                    {geoM?.latest != null && (
                        <BaselineScorePillar label="GEO" value={geoM.latest} accent="#7b8fff" />
                    )}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-white/[0.04] pt-4">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/18">
                        Référence initiale
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                </div>
            </div>
        </motion.div>
    );
}

function BaselineScorePillar({ label, value, accent }) {
    return (
        <div
            className="relative overflow-hidden rounded-lg border border-white/[0.04] px-4 py-4"
            style={{ boxShadow: `inset 0 0 0 1px ${accent}12` }}
        >
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/22">{label}</div>
            <div className="mt-1 text-[32px] font-black tabular-nums tracking-[-0.04em]" style={{ color: accent }}>
                {value}
            </div>
            <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.min(100, value)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    className="h-full rounded-full opacity-80"
                    style={{ background: `linear-gradient(90deg, ${accent}99, ${accent}33)` }}
                />
            </div>
        </div>
    );
}

/**
 * Section dual chart : courbes si ?2 points par série, sinon baseline scores si 1 mesure globale.
 */
export function TrendDualSection({ sparklines, metrics, coveragePoints }) {
    const seo = sparklines.seo_score || [];
    const geo = sparklines.geo_score || [];
    const seoValid = seo.filter((v) => v != null).length;
    const geoValid = geo.filter((v) => v != null).length;
    const hasSeoCurve = seoValid >= 2;
    const hasGeoCurve = geoValid >= 2;

    if (hasSeoCurve || hasGeoCurve) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mx-8 mb-6 rounded-xl border border-white/[0.04] bg-white/[0.008] p-5 md:mx-10"
            >
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/20">
                        Évolution SEO & GEO
                    </span>
                    <div className="flex gap-3">
                        {hasSeoCurve && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em]">
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                                    style={{ boxShadow: '0 0 6px #34d399' }}
                                />
                                <span className="text-emerald-400/60">SEO</span>
                            </span>
                        )}
                        {hasGeoCurve && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em]">
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-[#7b8fff]"
                                    style={{ boxShadow: '0 0 6px #7b8fff' }}
                                />
                                <span className="text-[#7b8fff]/60">GEO</span>
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    {hasSeoCurve && (
                        <PremiumSparkline data={seo} color="#34d399" width={180} height={48} strokeWidth={2} />
                    )}
                    {hasGeoCurve && (
                        <PremiumSparkline data={geo} color="#7b8fff" width={180} height={48} strokeWidth={2} />
                    )}
                </div>
            </motion.div>
        );
    }

    if (coveragePoints === 1) {
        return <TrendDualBaselineScores metrics={metrics} />;
    }

    /* Plusieurs mesures en base, mais pas assez de points valides pour tracer SEO/GEO — éviter un vide. */
    if (coveragePoints >= 2) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.45 }}
                className="mx-8 mb-6 rounded-xl border border-dashed border-white/[0.07] bg-white/[0.015] px-5 py-4 md:mx-10"
            >
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/22 mb-1.5">
                    SEO et GEO : courbes en attente
                </div>
                <p className="text-[12px] leading-relaxed text-white/32">
                    L&apos;historique contient plusieurs relevés, mais certaines séries n&apos;ont pas encore assez de
                    points complets pour dessiner une courbe. Les cartes ci-dessous affichent la dernière lecture
                    disponible ; le tracé apparaîtra dès que les scores seront renseignés sur plusieurs mesures.
                </p>
            </motion.div>
        );
    }

    return null;
}

/**
 * Emplacement sparkline métrique : courbe ou placeholder premium.
 */
export function MetricSparklineSlot({ data, color, width = 56, height = 22, strokeWidth = 1.5 }) {
    const valid = (data || []).filter((v) => v != null && Number.isFinite(Number(v))).length;
    if (valid >= 2) {
        return (
            <PremiumSparkline
                data={data}
                color={color}
                width={width}
                height={height}
                strokeWidth={strokeWidth}
                showEndDot={false}
            />
        );
    }
    return <SparklineBaselinePlaceholder width={width} height={height} accent={color} />;
}

function SparklineBaselinePlaceholder({ width, height, accent }) {
    const w = width || 56;
    const h = height || 22;
    return (
        <div
            className="relative flex items-center justify-end overflow-hidden rounded-md border border-white/[0.05] bg-white/[0.02]"
            style={{ width: w, height: h }}
            title="Historique à venir : courbe après la prochaine mesure"
        >
            <svg width={w} height={h} className="absolute inset-0" aria-hidden>
                <line
                    x1="6"
                    y1={h / 2}
                    x2={w - 6}
                    y2={h / 2}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                />
                <circle cx={w / 2} cy={h / 2} r="2" fill={accent} fillOpacity="0.4" />
            </svg>
        </div>
    );
}
