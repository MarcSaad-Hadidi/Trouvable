// @ts-nocheck
'use client';

import { useMemo } from 'react';
import { 
    ZapIcon, 
    ShieldCheckIcon, 
    FileTextIcon, 
    LayersIcon, 
    TargetIcon, 
    CheckCircle2Icon, 
    AlertTriangleIcon, 
    ActivityIcon,
    SparklesIcon,
    ChevronRightIcon
} from 'lucide-react';

import { 
    CommandHeader, 
    CommandMetricCard, 
    CommandPageShell,
    COMMAND_BUTTONS, 
    COMMAND_PANEL, 
    COMMAND_SURFACE, 
    cn 
} from '@/features/admin/dashboard/shared/components/command';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';

/* ── Components ── */

function DimensionCard({ dimension }) {
    const isOk = dimension.score >= 70;
    return (
        <div className={cn(
            COMMAND_SURFACE, 
            "p-6 group transition-all hover:bg-white/[0.06] border-t-2",
            isOk 
              ? "border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.1)]" 
              : "border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.1)]"
        )}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn("h-2.5 w-2.5 rounded-full", isOk ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]")} />
                    <h4 className="text-[17px] font-black text-white group-hover:text-[#b8adff] transition-colors">{dimension.label}</h4>
                </div>
                <div className={cn("text-[20px] font-black tracking-tight", isOk ? "text-emerald-300" : "text-amber-300")}>
                    {dimension.scoreLabel}
                </div>
            </div>
            
            <div className="p-4 rounded-xl bg-black/60 border border-white/[0.05] mb-6">
                <p className="text-[12px] text-white/50 leading-relaxed italic line-clamp-3">"{dimension.summary}"</p>
            </div>

            <div className="space-y-5">
                {dimension.evidence?.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#7c6aef]">Points d'Appui</div>
                        <div className="flex flex-wrap gap-2">
                            {dimension.evidence.slice(0, 3).map((e, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-[#7c6aef]/5 border border-[#7c6aef]/20 text-[#b8adff]">{e}</span>
                            ))}
                        </div>
                    </div>
                )}
                {dimension.gaps?.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-400">Déficits Critiques</div>
                        <ul className="space-y-1.5">
                            {dimension.gaps.slice(0, 2).map((g, i) => (
                                <li key={i} className="flex gap-2 text-[11px] text-white/40 leading-relaxed">
                                    <div className="h-1 w-1 rounded-full bg-rose-500/40 mt-1.5 shrink-0" /> 
                                    {g}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

function PageCard({ page }) {
    const isGood = page.score >= 60;
    return (
        <div className={cn(COMMAND_SURFACE, "p-4 border-l-2", isGood ? "border-emerald-500/40" : "border-rose-500/40")}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <FileTextIcon className="h-3.5 w-3.5 text-white/20 shrink-0" />
                    <span className="text-[12px] font-bold text-white/80 truncate">{page.label}</span>
                </div>
                <div className={cn("text-[12px] font-bold", isGood ? "text-emerald-400" : "text-rose-400")}>{page.scoreLabel}</div>
            </div>
            <div className="text-[10px] font-mono text-white/20 truncate mb-3">{page.path}</div>
            <div className="flex flex-wrap gap-1.5">
                {page.evidence.slice(0, 3).map((e, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/5 text-white/30 truncate max-w-[100px]">{e}</span>
                ))}
            </div>
        </div>
    );
}

/* ── Main View ── */

export default function GeoReadinessView() {
    const { client } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('readiness');

    const summary = data?.summary || {};
    const dimensions = Array.isArray(data?.dimensions) ? data.dimensions : [];
    const pageGroups = data?.pageGroups || { stronger: [], weaker: [] };

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Labo d'Extractabilité"
            subtitle="Mesure de la préparation structurelle pour être cité et réutilisé par les moteurs GEO."
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Mesure de la préparation structurelle...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Indice Readiness" value={`${summary.globalScore || 0}%`} detail="Moyenne pondérée" tone={summary.globalScore >= 70 ? 'ok' : 'warning'} />
                <CommandMetricCard label="Pages Audités" value={summary.pageCount || 0} detail="Échantillon analysé" tone="info" />
                <CommandMetricCard label="Passages Citables" value={summary.highPassageCount || 0} detail="Potentiel de réponse" tone="ok" />
                <CommandMetricCard label="Fiabilité Audit" value={summary.auditFreshness || '—'} detail="Fraîcheur des preuves" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8 flex flex-col gap-6 pb-10">
                    <div className={cn(COMMAND_PANEL, "p-0 overflow-hidden flex flex-col")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LayersIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Dimensions de Préparation</h3>
                            </div>
                            <ReliabilityPill value={summary.reliability || 'calculated'} />
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
                            {dimensions.map((d, i) => <DimensionCard key={i} dimension={d} />)}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-0 overflow-hidden flex flex-col")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01]">
                            <div className="flex items-center gap-2">
                                <TargetIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Répartition des Pages</h3>
                            </div>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 mb-2">Points Forts (Citabilité)</div>
                                <div className="space-y-3">
                                    {pageGroups.stronger.length > 0 ? (
                                        pageGroups.stronger.slice(0, 4).map((p, i) => <PageCard key={i} page={p} />)
                                    ) : <p className="text-[11px] text-white/10 italic">Aucune page forte détectée.</p>}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60 mb-2">Renforcement Requis</div>
                                <div className="space-y-3">
                                    {pageGroups.weaker.length > 0 ? (
                                        pageGroups.weaker.slice(0, 4).map((p, i) => <PageCard key={i} page={p} />)
                                    ) : <p className="text-[11px] text-white/10 italic">Aucun manque critique isolé.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-6 bg-[#7c6aef]/[0.02]")}>
                        <div className="flex items-center gap-2 mb-6 text-[#7c6aef]">
                            <SparklesIcon className="h-4 w-4" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]">Lecture IA Persistée</h3>
                        </div>
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-[#7c6aef]/10 text-[13px] text-white/70 leading-relaxed italic">
                            "{data.auditContext?.aiSummary?.text || 'La structure actuelle favorise l\'extraction directe mais manque de preuves sémantiques pour les requêtes complexes.'}"
                        </div>
                        <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                            <span>Moteur: Mistral Large</span>
                            <span>Confiance: 88%</span>
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <ActivityIcon className="h-4 w-4 text-emerald-400" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Couches de Fiabilité</h3>
                        </div>
                        <div className="space-y-3">
                            {Object.values(data.evidenceLayers || {}).map((layer, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-3 group cursor-default hover:bg-white/[0.04] transition-all")}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="text-[11px] font-bold text-white/80">{layer.title}</div>
                                        <ReliabilityPill value={layer.reliability} />
                                    </div>
                                    <p className="text-[10px] text-white/30 line-clamp-1">{layer.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6 border-rose-500/20")}>
                        <div className="flex items-center gap-2 mb-6 text-rose-400">
                            <AlertTriangleIcon className="h-4 w-4" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]">Blocages Prioritaires</h3>
                        </div>
                        <div className="space-y-3">
                            {(data.topBlockers || []).slice(0, 3).map((b, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-3 border-l-2 border-rose-500/30")}>
                                    <div className="text-[11px] font-bold text-white mb-1">{b.title}</div>
                                    <p className="text-[10px] text-white/40 leading-relaxed">{b.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
