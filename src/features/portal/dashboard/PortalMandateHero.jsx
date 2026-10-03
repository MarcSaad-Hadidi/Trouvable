'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import ScoreRing from '@/components/shared/metrics/ScoreRing';

function formatDate(iso) {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString('fr-CA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return null;
    }
}

function freshnessConfig(freshness) {
    if (freshness === 'recent')
        return { label: 'Revue à jour', cls: 'text-emerald-400', ring: 'border-emerald-400/30', bg: 'bg-emerald-400/[0.06]' };
    if (freshness === 'outdated')
        return { label: 'Revue à planifier', cls: 'text-amber-300', ring: 'border-amber-400/30', bg: 'bg-amber-400/[0.06]' };
    return { label: "Première revue en attente", cls: 'text-white/45', ring: 'border-white/10', bg: 'bg-white/[0.02]' };
}

function deriveSynthesis(client, visibility, completeness) {
    const seo = visibility.seo_score;
    const geo = visibility.geo_score;
    const pct = completeness.percentage;

    if (seo == null && geo == null) {
        return "Les premiers travaux d'analyse sont en cours. Ce dossier sera enrichi au fil des interventions de l'équipe Trouvable.";
    }

    const avg = seo != null && geo != null ? Math.round((seo + geo) / 2) : (seo ?? geo);

    if (avg >= 75 && pct >= 80) {
        return `Le dossier ${client.client_name} présente un positionnement solide. L'effort se concentre sur le maintien des acquis et l'exploration de nouvelles opportunités de visibilité.`;
    }
    if (avg >= 50) {
        return `Le dossier est en bonne progression. Des axes d'amélioration identifiés sont en cours de traitement pour renforcer la couverture et la cohérence du signal.`;
    }
    return `Des chantiers structurants ont été identifiés pour ce dossier. L'équipe Trouvable travaille activement à renforcer les fondations de votre visibilité.`;
}

const ease = [0.16, 1, 0.3, 1];

export default function PortalMandateHero({ client, visibility, completeness, membershipsCount = 1 }) {
    const freshness = freshnessConfig(visibility.audit_freshness);
    const lastAuditFormatted = formatDate(visibility.last_audit_at);
    const synthesis = deriveSynthesis(client, visibility, completeness);

    return (
        <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="relative overflow-hidden rounded-[32px] border border-white/[0.06] shadow-[0_48px_140px_rgba(0,0,0,0.6)]"
            style={{
                background:
                    'radial-gradient(ellipse at 12% -5%, rgba(91,115,255,0.16), transparent 48%), ' +
                    'radial-gradient(ellipse at 90% 105%, rgba(167,139,250,0.09), transparent 42%), ' +
                    'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.008), transparent 80%), ' +
                    'linear-gradient(180deg, #101218 0%, #0a0a0d 45%, #08080a 100%)',
            }}
        >
            {/* Ambient depth */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-36 -top-36 h-[480px] w-[480px] rounded-full bg-[#5b73ff]/[0.055] blur-[160px]" />
                <div className="absolute -bottom-28 -right-28 h-[340px] w-[340px] rounded-full bg-[#a78bfa]/[0.035] blur-[130px]" />
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.02),transparent_30%,transparent_70%,rgba(255,255,255,0.008))]" />
            </div>

            {/* Top hairline */}
            <div className="absolute left-12 right-12 top-0 h-px bg-gradient-to-r from-transparent via-[#5b73ff]/30 to-transparent" />

            <div className="relative px-8 pb-10 pt-9 md:px-10 lg:px-12 lg:pb-12 lg:pt-10">
                {/* Badge row */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease, delay: 0.1 }}
                    className="mb-8 flex flex-wrap items-center gap-3"
                >
                    <div className="inline-flex items-center gap-2.5 rounded-full border border-[#5b73ff]/20 bg-[#5b73ff]/[0.06] px-4 py-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5b73ff] opacity-30" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5b73ff]" />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7b8fff]">
                            Mandat en cours
                        </span>
                    </div>
                    <div className={`rounded-full border ${freshness.ring} ${freshness.bg} px-3.5 py-1`}>
                        <span className={`text-[11px] font-semibold ${freshness.cls}`}>{freshness.label}</span>
                    </div>
                </motion.div>

                {/* Main content */}
                <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left: identity + narrative */}
                    <div className="max-w-2xl flex-1">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease, delay: 0.2 }}
                            className="text-[clamp(32px,5vw,56px)] font-black leading-[1.04] tracking-[-0.045em] text-white"
                        >
                            {client.client_name}
                        </motion.h1>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease, delay: 0.3 }}
                            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/40"
                        >
                            <span>{client.business_type || 'Entreprise locale'}</span>
                            {client.website_url && (
                                <>
                                    <span className="text-white/12">·</span>
                                    <a
                                        href={client.website_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#7b8fff]/60 transition-colors hover:text-[#7b8fff]"
                                    >
                                        {client.website_url.replace(/^https?:\/\//, '')}
                                    </a>
                                </>
                            )}
                        </motion.div>

                        {/* Executive synthesis */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease, delay: 0.42 }}
                            className="mt-8"
                        >
                            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/18">
                                Synthèse de mandat
                            </div>
                            <p className="max-w-xl text-[15px] leading-[1.78] text-white/48">
                                {client.short_description || synthesis}
                            </p>
                        </motion.div>
                    </div>

                    {/* Right: dossier status panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.8, ease, delay: 0.35 }}
                        className="shrink-0 lg:min-w-[300px]"
                    >
                        <div className="rounded-2xl border border-white/[0.05] bg-gradient-to-b from-white/[0.025] to-white/[0.01] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_28px_70px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                            <div className="mb-6 text-[10px] font-bold uppercase tracking-[0.14em] text-white/22">
                                État du dossier
                            </div>

                            {lastAuditFormatted && (
                                <div className="mb-5 text-[13px] text-white/32">
                                    Dernière revue · <span className="text-white/50">{lastAuditFormatted}</span>
                                </div>
                            )}

                            {/* Completeness */}
                            <div className="mb-2 flex items-baseline justify-between">
                                <span className="text-[12px] text-white/30">Complétude du profil</span>
                                <span className="text-[14px] font-bold tabular-nums text-white">
                                    {completeness.percentage}
                                    <span className="text-[11px] font-normal text-white/30">%</span>
                                </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completeness.percentage}%` }}
                                    transition={{ delay: 0.9, duration: 1.4, ease }}
                                    className="h-full rounded-full bg-gradient-to-r from-[#5b73ff] to-[#7b8fff]"
                                />
                            </div>
                            <div className="mt-1.5 text-[11px] text-white/18">
                                {completeness.completedCount}/{completeness.totalCount} blocs validés
                            </div>

                            {/* Score rings */}
                            {(visibility.seo_score != null || visibility.geo_score != null) && (
                                <div className="mt-6 flex items-center justify-center gap-4">
                                    {visibility.seo_score != null && (
                                        <ScoreRing
                                            value={visibility.seo_score}
                                            color="#34d399"
                                            label="SEO"
                                            size={82}
                                            strokeWidth={5}
                                        />
                                    )}
                                    {visibility.geo_score != null && (
                                        <ScoreRing
                                            value={visibility.geo_score}
                                            color="#7b8fff"
                                            label="GEO"
                                            size={82}
                                            strokeWidth={5}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {membershipsCount > 1 && (
                            <Link
                                href="/portal"
                                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[13px] font-semibold text-white/45 transition-all hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white"
                            >
                                Changer de dossier
                            </Link>
                        )}
                    </motion.div>
                </div>
            </div>
        </motion.section>
    );
}
