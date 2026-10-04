'use client';

import { motion } from 'framer-motion';
import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import ScoreRing from '@/components/shared/metrics/ScoreRing';
import SourceStatusNotice from '@/components/shared/metrics/SourceStatusNotice';
import { GeoEmptyPanel, GeoSectionTitle, GeoPremiumCard } from '@/features/admin/geo/components/GeoPremium';

const EASE = [0.16, 1, 0.3, 1];
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

function formatDate(value) {
    if (!value) return 'n.d.';
    try {
        return new Date(value).toLocaleDateString('fr-CA', { dateStyle: 'medium' });
    } catch {
        return 'n.d.';
    }
}

function recommendabilityColor(level) {
    if (level === 'recommended' || level === 'highly_recommended') return 'text-emerald-400';
    if (level === 'partially_recommended' || level === 'mixed') return 'text-amber-400';
    if (level === 'not_recommended') return 'text-red-400';
    return 'text-white/50';
}

function recommendabilityLabel(level) {
    const map = {
        highly_recommended: 'Fortement recommandable',
        recommended: 'Recommandable',
        partially_recommended: 'Partiellement recommandable',
        mixed: 'Mixte',
        not_recommended: 'Non recommandable',
        unclear: 'Non déterminé',
    };
    return map[level] || level || 'Non déterminé';
}

export default function SeoLocalView() {
    const { client } = useGeoClient();
    const { data, loading, error } = useSeoWorkspaceSlice('local');

    if (loading) {
        return <div className="p-8 text-center text-[var(--geo-t3)] text-sm">Chargement…</div>;
    }

    if (error) {
        return (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
                <GeoSectionTitle
                    title="Préparation locale"
                    subtitle={`Indicateurs de préparation locale pour ${client?.client_name || 'ce client'}.`}
                />
                <GeoEmptyPanel title="Préparation locale indisponible" description={error} />
            </div>
        );
    }

    if (!data?.available) {
        return (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
                <GeoSectionTitle
                    title="Préparation locale"
                    subtitle={`Indicateurs de préparation locale pour ${client?.client_name || 'ce client'}.`}
                />
                <SourceStatusNotice status={data?.status} errors={data?.errors} />
                <GeoEmptyPanel
                    title={data?.emptyState?.title || 'Non disponible'}
                    description={data?.emptyState?.description || 'Données de préparation locale non disponibles.'}
                />
            </div>
        );
    }

    return (
        <motion.div
            className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto"
            variants={stagger}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={fadeUp}>
                <GeoSectionTitle
                    title="Préparation locale"
                    subtitle={`Audit de préparation locale et IA pour ${client?.client_name || 'ce client'}, daté du ${formatDate(data.auditDate)}.`}
                />
            </motion.div>

            <SourceStatusNotice status={data.status} errors={data.errors} />

            {/* Local score header */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="geo-card p-5 border border-white/[0.06] flex items-center gap-4">
                    <ScoreRing value={data.localScore} color="#a78bfa" size={64} strokeWidth={5} />
                    <div>
                        <div className="text-[22px] font-bold text-white/90 tabular-nums">
                            {data.localScore ?? 'n.d.'}
                            <span className="text-[14px] text-white/35">/100</span>
                        </div>
                        <div className="text-[11px] text-white/40 font-bold uppercase tracking-[0.06em]">
                            {data.localScoreLabel}
                        </div>
                        <div className="text-[9px] text-white/20 mt-1 max-w-[220px] leading-relaxed">
                            {data.localScoreProvenance}
                        </div>
                    </div>
                </div>

                {data.aiRecommendability && (
                    <div className="geo-card p-5 border border-white/[0.06]">
                        <div className="text-[10px] text-white/25 font-bold uppercase tracking-[0.08em] mb-2">
                            Recommandabilité IA
                        </div>
                        <div className={`text-[16px] font-bold ${recommendabilityColor(data.aiRecommendability)}`}>
                            {recommendabilityLabel(data.aiRecommendability)}
                        </div>
                        {data.aiRecommendabilityRationale && (
                            <div className="text-[10px] text-white/35 mt-2 leading-relaxed line-clamp-3">
                                {data.aiRecommendabilityRationale}
                            </div>
                        )}
                    </div>
                )}

                <div className="geo-card p-5 border border-white/[0.06]">
                    <div className="text-[10px] text-white/25 font-bold uppercase tracking-[0.08em] mb-2">
                        Problèmes locaux
                    </div>
                    <div className="text-[28px] font-bold text-amber-300/90 tabular-nums">
                        {data.localIssueCount ?? 'n.d.'}
                    </div>
                    <div className="text-[10px] text-white/30 mt-1">sur {data.totalIssueCount ?? 'n.d.'} total</div>
                </div>
            </motion.div>

            {/* Site classification */}
            {data.siteClassification && (
                <motion.div variants={fadeUp} className="geo-card p-4 border border-white/[0.06]">
                    <div className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-2">
                        Classification du site
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold text-white/85">
                            {data.siteClassification.label || data.siteClassification.type}
                        </span>
                    </div>
                </motion.div>
            )}

            {/* Business summary from LLM */}
            {data.businessSummary && (
                <motion.div variants={fadeUp} className="geo-card p-4 border border-white/[0.06]">
                    <div className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-2">
                        Résumé IA de l&#39;activité
                    </div>
                    <div className="text-[12px] text-white/60 leading-relaxed">{data.businessSummary}</div>
                </motion.div>
            )}

            {/* Answerability summary */}
            {data.answerabilitySummary && (
                <motion.div variants={fadeUp} className="geo-card p-4 border border-white/[0.06]">
                    <div className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-2">
                        Capacité de réponse IA
                    </div>
                    <div className="text-[12px] text-white/60 leading-relaxed">{data.answerabilitySummary}</div>
                </motion.div>
            )}

            {/* Local issues */}
            {data.localIssues?.length > 0 && (
                <motion.div variants={fadeUp}>
                    <GeoPremiumCard className="p-0 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/[0.08] bg-black/25">
                            <div className="text-sm font-semibold text-white/95">Problèmes de préparation locale</div>
                            <div className="text-[11px] text-white/35">
                                {data.localIssues.length} problèmes locaux/GEO identifiés.
                            </div>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {data.localIssues.map((issue, i) => (
                                <div key={issue.key || i} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12px] text-white/80 font-medium">
                                                {issue.label || issue.key}
                                            </div>
                                            {issue.description && (
                                                <div className="text-[10px] text-white/35 mt-0.5 line-clamp-2">
                                                    {issue.description}
                                                </div>
                                            )}
                                        </div>
                                        {issue.severity && (
                                            <span className="text-[10px] font-semibold text-amber-400/80 shrink-0">
                                                {issue.severity}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GeoPremiumCard>
                </motion.div>
            )}

            {/* Provenance note */}
            <motion.div variants={fadeUp} className="geo-card p-4 border border-white/[0.06]">
                <div className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-2">Provenance</div>
                <div className="text-[10px] text-white/30 leading-relaxed">
                    • {data.localScoreProvenance}
                    <br />
                    • Cette vue affiche les indicateurs locaux depuis la perspective SEO.
                    <br />• L&#39;espace GEO Ops contient sa propre grille d&#39;analyse GEO.
                </div>
            </motion.div>
        </motion.div>
    );
}
