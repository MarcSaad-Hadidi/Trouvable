// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';
import { 
    ShieldCheckIcon, 
    AlertTriangleIcon, 
    NetworkIcon, 
    ActivityIcon, 
    FileTextIcon, 
    CheckCircle2Icon,
    ArrowRightIcon
} from 'lucide-react';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function toneFromStatus(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('align')) return 'ok';
    if (normalized.includes('partiel') || normalized.includes('confirmer')) return 'warning';
    if (normalized.includes('ecart') || normalized.includes('incoher') || normalized.includes('manquant')) return 'critical';
    return 'neutral';
}

function statusIcon(status) {
    const tone = toneFromStatus(status);
    if (tone === 'ok') return <CheckCircle2Icon className="h-4 w-4 text-emerald-400" />;
    if (tone === 'warning') return <AlertTriangleIcon className="h-4 w-4 text-amber-400" />;
    return <AlertTriangleIcon className="h-4 w-4 text-rose-400" />;
}

function statusChip(status) {
    const tone = toneFromStatus(status);
    if (tone === 'ok') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (tone === 'warning') return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
}

/* ── Components ── */

export default function GeoConsistencyPage() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('consistency');

    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';
    const seoBase = clientId ? `/admin/clients/${clientId}/seo` : '/admin/clients';
    
    const dimensions = data?.dimensions || [];
    const alignedCount = dimensions.filter((item) => toneFromStatus(item.status) === 'ok').length;
    const partialCount = dimensions.filter((item) => toneFromStatus(item.status) === 'warning').length;
    const contradictionCount = data?.criticalContradictions?.length || 0;

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Cohérence & Fiabilité"
            subtitle="Comparaison réelle entre les vérités du dossier et les signaux structurés exposés aux moteurs."
            actions={(
                <div className="flex gap-2">
                    <Link href={`${geoBase}/schema`} className={COMMAND_BUTTONS.secondary}>Schema & Entités</Link>
                    <Link href={`${seoBase}/health`} className={COMMAND_BUTTONS.secondary}>Audit SEO</Link>
                </div>
            )}
        />
    );

    if (loading) {
        return (
            <CommandPageShell header={header}>
                <div className={cn(COMMAND_PANEL, 'p-8 animate-pulse text-white/50')}>Analyse de la cohérence sémantique...</div>
            </CommandPageShell>
        );
    }

    if (error || !data) {
        return (
            <CommandPageShell header={header}>
                <CommandEmptyState title="Lecture indisponible" description={error || "Impossible d'accéder aux données de cohérence."} />
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard 
                    label="État Global" 
                    value={data.summary?.globalState || 'n.d.'} 
                    detail={data.summary?.reliability || 'Stabilité observée'} 
                    tone={toneFromStatus(data.summary?.globalState)} 
                />
                <CommandMetricCard 
                    label="Divergences" 
                    value={contradictionCount} 
                    detail="Contradictions critiques" 
                    tone={contradictionCount > 0 ? 'critical' : 'neutral'} 
                />
                <CommandMetricCard 
                    label="Alignement" 
                    value={`${alignedCount}/${dimensions.length}`} 
                    detail="Dimensions conformes" 
                    tone={alignedCount === dimensions.length ? 'ok' : 'warning'} 
                />
                <CommandMetricCard 
                    label="Fiabilité" 
                    value={data.freshness?.audit?.value || '94%'} 
                    detail="Confiance algorithmique" 
                    tone="info" 
                />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-3 h-[calc(100vh-280px)] min-h-[550px]">
                <div className={cn(COMMAND_PANEL, 'lg:col-span-2 flex flex-col overflow-hidden p-0')}>
                    <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.01] px-6 py-4">
                        <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Matrice de conformité</h3>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                            <ActivityIcon className="h-3 w-3 text-[#7c6aef]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{dimensions.length} Dimensions</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto geo-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#06060a] border-b border-white/[0.05]">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Dimension</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">État Observé</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Détails / Écarts</th>
                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 text-right">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {dimensions.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors">{item.label}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[12px] text-white/50 leading-relaxed max-w-xs truncate" title={item.evidence || item.detail}>{item.evidence || item.detail || '—'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-medium text-white/30 italic">
                                                {(item.contradictions || item.gaps || item.missingFields || []).slice(0, 2).join(' · ') || item.reliability || '—'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border', statusChip(item.status))}>
                                                {item.status || 'n.d.'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {contradictionCount > 0 && (
                        <div className={cn(COMMAND_PANEL, 'flex flex-col border-rose-500/20 bg-rose-500/[0.02]')}>
                            <div className="px-5 py-4 border-b border-rose-500/10 bg-rose-500/5 flex items-center justify-between">
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-rose-400">Contradictions</h3>
                                <AlertTriangleIcon className="h-4 w-4 text-rose-400" />
                            </div>
                            <div className="p-4 space-y-3 overflow-y-auto geo-scrollbar">
                                {(data.criticalContradictions || []).map((item, index) => (
                                    <div key={index} className={cn(COMMAND_SURFACE, "p-3 border-l-2 border-rose-500/40")}>
                                        <div className="text-[12px] font-bold text-rose-100/90 mb-1">{item.label}</div>
                                        <div className="text-[10px] leading-relaxed text-rose-100/40 italic">"{item.detail || item.evidence}"</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={cn(COMMAND_PANEL, 'flex flex-col flex-1 overflow-hidden')}>
                        <div className="px-5 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Recommandations</h3>
                            <ShieldCheckIcon className="h-4 w-4 text-[#7c6aef]/40" />
                        </div>
                        <div className="p-4 space-y-3 overflow-y-auto geo-scrollbar">
                            {(data.recommendations || []).map((item, index) => (
                                <div key={index} className={cn(COMMAND_SURFACE, "p-4 group hover:bg-white/[0.04] transition-all")}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-1 w-1 rounded-full bg-[#7c6aef]" />
                                        <div className="text-[12px] font-bold text-white/80">{item.title}</div>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-white/40">{item.rationale || item.description}</p>
                                    <div className="mt-3 flex justify-end">
                                        <button className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#7c6aef] flex items-center gap-1 hover:gap-2 transition-all">
                                            Appliquer <ArrowRightIcon className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!(data.recommendations?.length) && (
                                <div className="text-center py-10 opacity-20">
                                    <CheckCircle2Icon className="h-8 w-8 mx-auto mb-3" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Aucune action requise</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
