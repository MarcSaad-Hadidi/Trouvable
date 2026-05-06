'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import ScoreRing from '@/components/shared/metrics/ScoreRing';
import {
    GeoEmptyPanel,
    GeoKpiCard,
    GeoSectionTitle,
    GeoStatusDot,
} from '@/features/admin/dashboard/geo/components/GeoPremium';

const EASE = [0.16, 1, 0.3, 1];
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

function formatNumber(n) {
    if (n == null) return 'n.d.';
    return Number(n).toLocaleString('fr-FR');
}

function formatDate(value) {
    if (!value) return 'n.d.';
    try { return new Date(value).toLocaleDateString('fr-CA', { dateStyle: 'medium' }); }
    catch { return 'n.d.'; }
}

function connectorStatusLabel(status) {
    const map = {
        healthy: 'Actif',
        configured: 'Configuré',
        syncing: 'Synchronisation',
        error: 'Erreur',
        disabled: 'Désactivé',
        not_connected: 'Non connecté',
        sample_mode: 'Échantillon',
    };
    return map[status] || status || 'Inconnu';
}

function connectorDotStatus(status) {
    if (status === 'healthy' || status === 'configured') return 'ok';
    if (status === 'syncing') return 'ok';
    if (status === 'error') return 'critical';
    if (status === 'not_connected') return 'idle';
    return 'warning';
}

function ConnectorRow({ label, connector }) {
    return (
        <div className="flex items-center justify-between gap-2 py-2 border-b border-white/[0.04] last:border-0">
            <div className="flex items-center gap-2">
                <GeoStatusDot status={connectorDotStatus(connector.status)} />
                <span className="text-[11px] font-semibold text-white/70">{label}</span>
            </div>
            <span className="text-[10px] text-white/40">{connectorStatusLabel(connector.status)}</span>
        </div>
    );
}

function QuickLinkCard({ href, label, sublabel, accent = 'blue' }) {
    const accents = {
        blue: 'border-sky-400/10 hover:border-sky-400/25 hover:bg-sky-400/[0.04]',
        emerald: 'border-emerald-400/10 hover:border-emerald-400/25 hover:bg-emerald-400/[0.04]',
        violet: 'border-violet-400/10 hover:border-violet-400/25 hover:bg-violet-400/[0.04]',
        amber: 'border-amber-400/10 hover:border-amber-400/25 hover:bg-amber-400/[0.04]',
    };
    return (
        <Link
            href={href}
            className={`block rounded-xl border px-4 py-3 transition-all duration-200 ${accents[accent] || accents.blue}`}
        >
            <div className="text-[12px] font-semibold text-white/85">{label}</div>
            <div className="text-[10px] text-white/35 mt-0.5">{sublabel}</div>
        </Link>
    );
}

export default function SeoOverviewView() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useSeoWorkspaceSlice('overview');

    if (loading) {
        return <div className="p-8 text-center text-[var(--geo-t3)] text-sm">Chargement…</div>;
    }

    if (error) {
        return (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
                <GeoSectionTitle
                    title="SEO Ops"
                    subtitle={`Visibilité organique et santé technique pour ${client?.client_name || 'ce client'}.`}
                />
                <GeoEmptyPanel
                    title="Données SEO indisponibles"
                    description={error}
                />
            </div>
        );
    }

    const clientBase = `/admin/clients/${clientId}`;

    return (
        <motion.div
            className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto"
            variants={stagger}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={fadeUp}>
                <GeoSectionTitle
                    title="SEO Ops"
                    subtitle={`Visibilité organique et santé technique pour ${client?.client_name || 'ce client'}.`}
                />
            </motion.div>

            {/* Audit scores row */}
            {data?.auditScores && (
                <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="geo-card p-5 border border-white/[0.06] flex items-center gap-4">
                        <ScoreRing value={data.auditScores.seoScore} color="#34d399" size={56} strokeWidth={4.5} />
                        <div>
                            <div className="text-[18px] font-bold text-white/90 tabular-nums">
                                {data.auditScores.seoScore ?? 'n.d.'}<span className="text-[13px] text-white/35">/100</span>
                            </div>
                            <div className="text-[10px] text-white/35 font-bold uppercase tracking-[0.08em]">
                                {data.auditScores.seoScoreLabel}
                            </div>
                            <div className="text-[9px] text-white/20 mt-0.5">{data.auditScores.seoScoreProvenance}</div>
                        </div>
                    </div>

                    <div className="geo-card p-5 border border-white/[0.06] flex items-center gap-4">
                        <ScoreRing value={data.auditScores.geoScore} color="#a78bfa" size={56} strokeWidth={4.5} />
                        <div>
                            <div className="text-[18px] font-bold text-white/90 tabular-nums">
                                {data.auditScores.geoScore ?? 'n.d.'}<span className="text-[13px] text-white/35">/100</span>
                            </div>
                            <div className="text-[10px] text-white/35 font-bold uppercase tracking-[0.08em]">
                                {data.auditScores.geoScoreLabel}
                            </div>
                        </div>
                    </div>

                    <div className="geo-card p-5 border border-white/[0.06]">
                        <div className="text-[10px] text-white/25 font-bold uppercase tracking-[0.08em] mb-2">Problèmes détectés</div>
                        <div className="text-[26px] font-bold text-amber-300/90 tabular-nums">
                            {data.auditScores.issueCount ?? 'n.d.'}
                        </div>
                        <div className="text-[10px] text-white/30 mt-1">Tous les problèmes de l'audit</div>
                    </div>
                </motion.div>
            )}

            {/* KPIs row */}
            {data?.kpis && (
                <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <GeoKpiCard label="Sessions" value={formatNumber(data.kpis.sessions)} hint="GA4 : 28 jours" accent="blue" />
                    <GeoKpiCard label="Utilisateurs" value={formatNumber(data.kpis.users)} hint="GA4 : 28 jours" accent="violet" />
                    <GeoKpiCard label="Clics GSC" value={formatNumber(data.kpis.totalClicks)} hint="Search Console" accent="emerald" />
                    <GeoKpiCard label="Impressions" value={formatNumber(data.kpis.totalImpressions)} hint="Search Console" accent="amber" />
                    <GeoKpiCard label="Jours trafic" value={data.kpis.daysWithTraffic} hint="Jours avec données" />
                    <GeoKpiCard label="Requêtes" value={formatNumber(data.kpis.gscQueryCount)} hint="Requêtes uniques" accent="violet" />
                </motion.div>
            )}

            {/* Connector status + data freshness */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data?.connectors && (
                    <div className="geo-card p-4 border border-white/[0.06]">
                        <div className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-3">Connecteurs</div>
                        <ConnectorRow label="Google Analytics 4" connector={data.connectors.ga4} />
                        <ConnectorRow label="Search Console" connector={data.connectors.gsc} />
                    </div>
                )}
                {data?.dataFreshness && (
                    <div className="geo-card p-4 border border-white/[0.06]">
                        <div className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-3">Fraîcheur</div>
                        <div className="space-y-2 text-[11px]">
                            <div className="flex justify-between text-white/50">
                                <span>Dernières données GA4</span>
                                <span className="text-white/70 font-mono">{formatDate(data.dataFreshness.latestTrafficDate)}</span>
                            </div>
                            <div className="flex justify-between text-white/50">
                                <span>Dernières données GSC</span>
                                <span className="text-white/70 font-mono">{formatDate(data.dataFreshness.latestGscDate)}</span>
                            </div>
                            <div className="flex justify-between text-white/50">
                                <span>Dernier audit</span>
                                <span className="text-white/70 font-mono">{formatDate(data.dataFreshness.lastAuditAt)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Top queries preview */}
            {data?.topQueries?.length > 0 && (
                <motion.div variants={fadeUp} className="geo-card p-0 overflow-hidden border border-white/[0.06]">
                    <div className="px-5 py-3 border-b border-white/[0.06] bg-black/20 flex items-center justify-between">
                        <div>
                            <div className="text-[12px] font-semibold text-white/90">Top requêtes organiques</div>
                            <div className="text-[10px] text-white/30">Search Console : 5 premières par clics</div>
                        </div>
                        <Link
                            href={`${clientBase}/seo/visibility`}
                            className="text-[10px] font-semibold text-[#7b8fff]/70 hover:text-[#7b8fff] transition-colors"
                        >
                            Voir tout
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/[0.06] text-white/40 text-[10px] uppercase tracking-wider">
                                    <th className="px-5 py-2.5 text-left font-semibold">Requête</th>
                                    <th className="px-4 py-2.5 text-right font-semibold">Clics</th>
                                    <th className="px-4 py-2.5 text-right font-semibold">Impressions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {data.topQueries.map((row) => (
                                    <tr key={row.query} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-2 text-white/75 max-w-[300px] truncate">{row.query}</td>
                                        <td className="px-4 py-2 text-right text-white/80 tabular-nums">{formatNumber(row.clicks)}</td>
                                        <td className="px-4 py-2 text-right text-white/60 tabular-nums">{formatNumber(row.impressions)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* Quick links */}
            <motion.div variants={fadeUp}>
                <div className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-3">Accès rapide</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <QuickLinkCard
                        href={`${clientBase}/seo/visibility`}
                        label="Visibilité organique"
                        sublabel="GA4 + Search Console"
                        accent="blue"
                    />
                    <QuickLinkCard
                        href={`${clientBase}/seo/health`}
                        label="Santé technique"
                        sublabel="Audit SEO : problèmes et forces"
                        accent="emerald"
                    />
                    <QuickLinkCard
                        href={`${clientBase}/seo/local`}
                        label="Préparation locale"
                        sublabel="Audit local_readiness"
                        accent="violet"
                    />
                    <QuickLinkCard
                        href={`${clientBase}/seo/opportunities`}
                        label="Opportunités SEO"
                        sublabel="Backlog SEO priorisé"
                        accent="amber"
                    />
                </div>
            </motion.div>

            {/* No data fallback */}
            {!data?.kpis && !data?.auditScores?.seoScore && (
                <motion.div variants={fadeUp}>
                    <GeoEmptyPanel
                        title="Espace SEO en attente de données"
                        description="Connectez GA4 et Search Console, puis lancez un audit pour peupler cet espace."
                    />
                </motion.div>
            )}
        </motion.div>
    );
}
