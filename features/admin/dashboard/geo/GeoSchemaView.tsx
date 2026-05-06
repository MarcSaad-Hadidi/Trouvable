// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ChevronRightIcon,
    FingerprintIcon,
    HashIcon,
    NetworkIcon,
    ShieldAlertIcon,
    SearchIcon,
    DatabaseIcon,
    ActivityIcon
} from 'lucide-react';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function toneFromStatus(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('couvert') || normalized.includes('present') || normalized.includes('aligne')) return 'valid';
    if (normalized.includes('partiel') || normalized.includes('confirmer')) return 'warning';
    return 'error';
}

const EASE = [0.16, 1, 0.3, 1];

/* ── Main View ── */

export default function GeoSchemaPage() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('schema');
    const [expandedRow, setExpandedRow] = useState(null);
    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';

    const orbitNodes = useMemo(() => {
        return (data?.coverageItems || []).slice(0, 5).map((item, index) => ({
            id: item.key,
            label: item.label,
            status: item.operatorStatus,
            top: ['15%', '40%', '40%', '75%', '75%'][index],
            left: ['50%', '15%', '85%', '25%', '75%'][index],
        }));
    }, [data]);

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Schéma & Entités"
            subtitle="Validation du balisage structuré et des entités détectées pour les moteurs IA."
            actions={(
                <Link href={`${geoBase}/consistency`} className={COMMAND_BUTTONS.primary}>
                    <ActivityIcon className="h-4 w-4" /> Analyse Cohérence
                </Link>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Cartographie du graphe d'entités...</div></CommandPageShell>;
    if (error || !data) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error || "Impossible d'accéder aux données structurées."} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Couverture Schéma" value={`${data.summary?.coveragePercent || 0}%`} detail={`${data.summary?.observedTypeCount || 0} types détectés`} tone={(data.summary?.coveragePercent || 0) >= 70 ? 'ok' : 'warning'} />
                <CommandMetricCard label="Écarts Critiques" value={data.summary?.criticalGapCount || 0} detail="Impact visibilité IA" tone={(data.summary?.criticalGapCount || 0) > 0 ? 'critical' : 'neutral'} />
                <CommandMetricCard label="Entités GMB/Graphe" value="Active" detail="Alignement détecté" tone="ok" />
                <CommandMetricCard label="Fraîcheur" value={data.summary?.auditFreshness || 'n.d.'} detail="Dernière lecture" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className={cn(COMMAND_PANEL, "lg:col-span-5 flex flex-col overflow-hidden relative p-0")}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <NetworkIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Entity Graph Mapping</h3>
                        </div>
                        <DatabaseIcon className="h-4 w-4 text-white/10" />
                    </div>
                    
                    <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_rgba(124,106,239,0.08)_0%,_transparent_70%)] bg-[#06070a]">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                             style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        
                        <svg className="pointer-events-none absolute inset-0 h-full w-full">
                            <g opacity="0.1">
                                <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#7c6aef" strokeWidth="1" strokeDasharray="4 4" />
                                <line x1="50%" y1="50%" x2="15%" y2="40%" stroke="#7c6aef" strokeWidth="1" />
                                <line x1="50%" y1="50%" x2="85%" y2="40%" stroke="#7c6aef" strokeWidth="1" />
                                <line x1="50%" y1="50%" x2="25%" y2="75%" stroke="#7c6aef" strokeWidth="1" strokeDasharray="4 4" />
                                <line x1="50%" y1="50%" x2="75%" y2="75%" stroke="#7c6aef" strokeWidth="1" />
                            </g>
                        </svg>

                        <div className="absolute inset-0">
                            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                                <motion.div 
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="flex h-20 w-20 items-center justify-center rounded-full border border-[#7c6aef]/30 bg-[#7c6aef]/10 shadow-[0_0_40px_rgba(124,106,239,0.1)] backdrop-blur-sm"
                                >
                                    <FingerprintIcon className="h-8 w-8 text-white/80" />
                                </motion.div>
                            </div>

                            {orbitNodes.map((node, idx) => {
                                const tone = toneFromStatus(node.status);
                                return (
                                    <motion.div
                                        key={node.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1, duration: 0.5, ease: EASE }}
                                        className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                                        style={{ top: node.top, left: node.left }}
                                    >
                                        <div className={cn(
                                            'mb-2 flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-500 hover:scale-110 shadow-lg',
                                            tone === 'valid' ? 'border-emerald-500/40 bg-emerald-500/10' : (tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10' : 'border-rose-500/40 bg-rose-500/10'),
                                        )}>
                                            <HashIcon className={cn('h-4 w-4', tone === 'valid' ? 'text-emerald-400' : (tone === 'warning' ? 'text-amber-400' : 'text-rose-400'))} />
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-black/80 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white/40 backdrop-blur-md whitespace-nowrap">
                                            {node.label}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className={cn(COMMAND_PANEL, "lg:col-span-7 flex flex-col p-0 overflow-hidden")}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldAlertIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Validation des Blocs Schema</h3>
                        </div>
                        <SearchIcon className="h-4 w-4 text-white/10" />
                    </div>

                    <div className="flex-1 divide-y divide-white/[0.03] overflow-y-auto geo-scrollbar">
                        {(data.coverageItems || []).map((item) => {
                            const tone = toneFromStatus(item.operatorStatus);
                            const isExpanded = expandedRow === item.key;
                            return (
                                <div key={item.key} className="flex flex-col">
                                    <div 
                                        onClick={() => setExpandedRow(isExpanded ? null : item.key)}
                                        className="px-6 py-4 group hover:bg-white/[0.02] transition-all cursor-pointer flex items-center gap-4"
                                    >
                                        <div className={cn("h-2 w-2 rounded-full shrink-0", tone === 'valid' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : (tone === 'warning' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'))} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-[14px] font-bold text-white/80 group-hover:text-white transition-colors">{item.label}</span>
                                                <span className="text-[10px] font-bold tabular-nums text-white/20">{item.coveragePercent}% couverture</span>
                                            </div>
                                            <div className="flex gap-1.5 overflow-hidden">
                                                {(item.observedTypes || []).slice(0, 3).map((t, i) => (
                                                    <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-[#7c6aef]/60">#{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 mr-2">
                                            <div className="text-[11px] font-bold text-white/50">{item.foundCount}/{item.expectedCount} props</div>
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-white/10 mt-0.5">{item.reliability || 'STABLE'}</div>
                                        </div>
                                        <ChevronRightIcon className={cn("h-4 w-4 text-white/10 transition-transform duration-300", isExpanded && "rotate-90 text-white/40")} />
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: EASE }}
                                                className="overflow-hidden bg-black/40 border-t border-white/[0.04]"
                                            >
                                                <div className="p-6 space-y-4">
                                                    {(item.missingProperties || []).length > 0 && (
                                                        <div className="p-4 rounded-xl bg-rose-500/[0.03] border border-rose-500/10">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400/40 mb-3">Propriétés manquantes</div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {item.missingProperties.map((p, i) => (
                                                                    <div key={i} className="flex items-center gap-2 text-[11px] text-white/50">
                                                                        <div className="h-1 w-1 rounded-full bg-rose-500/40 shrink-0" /> {p}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className={cn(COMMAND_SURFACE, "p-4")}>
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">Preuve détectée</div>
                                                        <p className="text-[11px] text-white/50 leading-relaxed italic border-l-2 border-[#7c6aef]/30 pl-4 py-1">"{item.evidence || 'Aucun détail technique disponible.'}"</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
