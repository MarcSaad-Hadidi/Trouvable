'use client';

import { motion } from 'framer-motion';
import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import {
    GeoEmptyPanel,
    GeoSectionTitle,
    GeoKpiCard,
    GeoPremiumCard,
} from '@/features/admin/dashboard/geo/components/GeoPremium';

const EASE = [0.16, 1, 0.3, 1];
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

function formatDate(value) {
    if (!value) return 'n.d.';
    try { return new Date(value).toLocaleDateString('fr-CA', { dateStyle: 'medium' }); }
    catch { return 'n.d.'; }
}

function severityColor(severity) {
    if (severity === 'critical') return 'bg-red-500/20 text-red-300 border-red-400/20';
    if (severity === 'high') return 'bg-red-500/10 text-red-300/80 border-red-400/15';
    if (severity === 'medium') return 'bg-amber-500/10 text-amber-300 border-amber-400/15';
    return 'bg-white/[0.03] text-white/50 border-white/[0.08]';
}

function statusLabel(status) {
    const map = {
        draft: 'Brouillon',
        approved: 'Approuvée',
        applied: 'Appliquée',
        discarded: 'Écartée',
    };
    return map[status] || status || 'n.d.';
}

function statusColor(status) {
    if (status === 'approved') return 'text-emerald-400';
    if (status === 'applied') return 'text-sky-400';
    if (status === 'discarded') return 'text-white/30';
    return 'text-amber-300/80';
}

function problemTypeLabel(type) {
    const map = {
        schema_missing_or_incoherent: 'Schema manquant/incohérent',
        visibility_declining: 'Visibilité en déclin',
        ai_crawlers_blocked: 'Crawlers IA bloqués',
        llms_txt_missing: 'llms.txt manquant',
        weak_local_clarity: 'Clarté locale faible',
        missing_faq_for_intent: 'FAQ manquante pour intention',
        target_never_found: 'Cible jamais trouvée',
        job_audit_flaky: 'Audit job instable',
        job_prompt_rerun_inactive: 'Prompt re-run inactif',
    };
    return map[type] || type || 'n.d.';
}

export default function SeoActionsView() {
    const { client } = useGeoClient();
    const { data, loading, error } = useSeoWorkspaceSlice('actions');

    if (loading) {
        return <div className="p-8 text-center text-[var(--geo-t3)] text-sm">Chargement…</div>;
    }

    if (error) {
        return (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
                <GeoSectionTitle
                    title="Actions SEO"
                    subtitle={`Backlog d'actions SEO pour ${client?.client_name || 'ce client'}.`}
                />
                <GeoEmptyPanel
                    title="Actions SEO indisponibles"
                    description={error}
                />
            </div>
        );
    }

    if (!data?.available) {
        return (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
                <GeoSectionTitle
                    title="Actions SEO"
                    subtitle={`Backlog d'actions SEO pour ${client?.client_name || 'ce client'}.`}
                />
                <GeoEmptyPanel
                    title={data?.emptyState?.title || 'Aucune action'}
                    description={data?.emptyState?.description || 'Aucune action SEO identifiée.'}
                />
            </div>
        );
    }

    const counts = data.counts || {};

    return (
        <motion.div
            className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto"
            variants={stagger}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={fadeUp}>
                <GeoSectionTitle
                    title="Actions SEO"
                    subtitle={`Remédiations et problèmes techniques pour ${client?.client_name || 'ce client'}.`}
                />
            </motion.div>

            {/* Counts */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <GeoKpiCard label="Suggestions" value={counts.totalSuggestions} hint="Remédiations SEO" accent="violet" />
                <GeoKpiCard label="Brouillons" value={counts.draftSuggestions} hint="En attente de revue" accent="amber" />
                <GeoKpiCard label="Approuvées" value={counts.approvedSuggestions} hint="Prêtes à appliquer" accent="emerald" />
                <GeoKpiCard label="Problèmes audit" value={counts.totalAuditIssues} hint="Issues SEO de l'audit" accent="blue" />
            </motion.div>

            {/* Remediation suggestions */}
            {data.suggestions?.length > 0 && (
                <motion.div variants={fadeUp}>
                    <GeoPremiumCard className="p-0 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/[0.08] bg-black/25">
                            <div className="text-sm font-semibold text-white/95">Suggestions de remédiation</div>
                            <div className="text-[11px] text-white/35">{data.suggestions.length} suggestions, générées automatiquement.</div>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {data.suggestions.map((s) => (
                                <div key={s.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${severityColor(s.severity)}`}>
                                                    {s.severity}
                                                </span>
                                                <span className="text-[11px] font-medium text-white/75">
                                                    {problemTypeLabel(s.problemType)}
                                                </span>
                                            </div>
                                            {s.aiOutput && (
                                                <div className="text-[11px] text-white/40 mt-1 line-clamp-2 leading-relaxed">
                                                    {s.aiOutput.substring(0, 200)}{s.aiOutput.length > 200 ? '…' : ''}
                                                </div>
                                            )}
                                            <div className="text-[9px] text-white/20 mt-1">
                                                Source: {s.problemSource} · {formatDate(s.createdAt)}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-semibold shrink-0 ${statusColor(s.status)}`}>
                                            {statusLabel(s.status)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GeoPremiumCard>
                </motion.div>
            )}

            {/* Audit issues backlog */}
            {data.auditIssues?.length > 0 && (
                <motion.div variants={fadeUp}>
                    <GeoPremiumCard className="p-0 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/[0.08] bg-black/25">
                            <div className="text-sm font-semibold text-white/95">Problèmes SEO de l&#39;audit</div>
                            <div className="text-[11px] text-white/35">
                                {data.auditIssues.length} problèmes catégorisés techniques / SEO / trust.
                            </div>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {data.auditIssues.map((issue, i) => (
                                <div key={issue.key || i} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12px] text-white/80 font-medium">{issue.label || issue.key}</div>
                                            {issue.description && (
                                                <div className="text-[10px] text-white/35 mt-0.5 line-clamp-2">{issue.description}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {issue.category && (
                                                <span className="text-[9px] text-white/25 border border-white/[0.06] rounded px-1.5 py-0.5 uppercase tracking-wider">
                                                    {issue.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GeoPremiumCard>
                </motion.div>
            )}
        </motion.div>
    );
}
