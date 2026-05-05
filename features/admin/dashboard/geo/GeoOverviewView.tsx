// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertTriangleIcon,
    BotIcon,
    QuoteIcon,
    SparklesIcon,
    ActivityIcon,
    TargetIcon,
    LayersIcon,
    ZapIcon,
    ArrowUpRightIcon
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
import { buildGeoOverviewCommandModel } from '@/features/admin/dashboard/geo/geo-overview-model';

/* ── Utilities ── */

const EASE = [0.16, 1, 0.3, 1];

function providerColor(index) {
    const colors = ['bg-[#10b981]', 'bg-[#0ea5e9]', 'bg-[#7c6aef]', 'bg-[#f59e0b]', 'bg-[#f97316]'];
    return colors[index % colors.length];
}

function providerAccent(index) {
    const colors = ['#10b981', '#0ea5e9', '#7c6aef', '#f59e0b', '#f97316'];
    return colors[index % colors.length];
}

/* ── Components ── */

function GeoPulseRing({ score, tone }) {
    const radius = 48;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const size = (radius + strokeWidth) * 2;
    const center = size / 2;

    const colors = {
        ok: '#4ade80',
        warning: '#fbbf24',
        critical: '#f87171',
        info: '#7c6aef',
    };

    const color = colors[tone] || colors.info;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
                <motion.circle
                    cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - (score / 100) * circumference }}
                    transition={{ duration: 1.5, ease: EASE }}
                    strokeLinecap="round"
                    style={{ opacity: 0.8 }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[28px] font-bold text-white tabular-nums">{score}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/20">Index</div>
            </div>
        </div>
    );
}

export default function GeoOverviewView() {
    const { client, clientId, workspace, audit } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('overview');

    const model = useMemo(() => {
        if (!data) return null;
        return buildGeoOverviewCommandModel({ clientId, client, workspace, audit, data });
    }, [audit, client, clientId, data, workspace]);

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Cockpit de Situation"
            subtitle="Pilotage de la visibilité sur les moteurs IA, santé des modèles et flux de citations."
            actions={(
                <Link href={clientId ? `/admin/clients/${clientId}/geo/runs` : '/admin/clients'} className={COMMAND_BUTTONS.primary}>
                    <ActivityIcon className="h-4 w-4" /> Lancer Scan IA
                </Link>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Calcul du score de situation...</div></CommandPageShell>;
    if (error || !data || !model) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error || "Signaux en attente."} /></CommandPageShell>;

    const score = model.hero?.score?.value || 0;
    const tone = model.hero?.status?.tone || 'info';

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className={cn(COMMAND_PANEL, "xl:col-span-4 flex items-center gap-8 p-8 bg-[#06070a]")}>
                    <GeoPulseRing score={score} tone={tone} />
                    <div className="flex-1 space-y-4">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1">État Radar</div>
                            <div className={cn("text-[14px] font-bold uppercase tracking-widest", tone === 'ok' ? 'text-emerald-400' : (tone === 'warning' ? 'text-amber-400' : 'text-[#b8adff]'))}>
                                {model.hero?.status?.label || 'Opérationnel'}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {model.hero?.supportingMetrics?.slice(0, 2).map((m, i) => (
                                <div key={i}>
                                    <div className="text-[18px] font-bold text-white tabular-nums">{m.value}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/20">{m.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={cn(COMMAND_PANEL, "xl:col-span-8 p-0 overflow-hidden relative bg-[#06070a]")}>
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={model.trend?.labels?.map((l, i) => ({ l, v: model.trend.series[0].values[i] }))}>
                                <defs>
                                    <linearGradient id="geoTrendGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#7c6aef" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#7c6aef" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="v" stroke="#7c6aef" fill="url(#geoTrendGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">Trajectoire Visibilité</div>
                            <h3 className="text-[20px] font-bold text-white/90 max-w-md leading-snug italic">"{model.hero?.status?.summary}"</h3>
                        </div>
                        <div className="flex items-center gap-6 mt-6">
                            {model.hero?.supportingMetrics?.slice(2, 4).map((m, i) => (
                                <div key={i}>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">{m.label}</div>
                                    <div className="text-[15px] font-bold text-white tabular-nums">{m.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-420px)] min-h-[500px]">
                <div className={cn(COMMAND_PANEL, "lg:col-span-8 flex flex-col p-0 overflow-hidden bg-[#06070a]")}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BotIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Performance par Modèle</h3>
                        </div>
                        <Link href={clientId ? `/admin/clients/${clientId}/geo/models` : '/admin/clients'} className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors">Détails →</Link>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 geo-scrollbar">
                        {(data?.visibility?.topProvidersModels || []).slice(0, 6).map((m, i) => (
                            <div key={i} className={cn(COMMAND_SURFACE, "p-5 flex items-center justify-between group hover:bg-white/[0.04] transition-all")}>
                                <div className="flex items-center gap-4">
                                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", providerColor(i))}>
                                        <BotIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-bold text-white group-hover:text-[#b8adff] transition-colors">{m.provider} {m.model}</div>
                                        <div className="text-[10px] uppercase tracking-widest text-white/20">{m.runs} exécutions</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[18px] font-bold text-white tabular-nums">{m.targetRatePercent || 0}%</div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Présence</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
                    <div className={cn(COMMAND_PANEL, "flex-1 flex flex-col p-0 overflow-hidden bg-[#06070a]")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Signal Radar</h3>
                            <ZapIcon className="h-3 w-3 text-emerald-400 animate-pulse" />
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 geo-scrollbar">
                            {(model.timeline?.items || []).slice(0, 6).map((item, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", item.tone === 'critical' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-[#7c6aef] shadow-[0_0_8px_rgba(124,106,239,0.4)]')} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-bold text-white/80 group-hover:text-white transition-colors line-clamp-1">{item.title}</div>
                                        <div className="text-[11px] text-white/30 italic line-clamp-2 mt-1">"{item.description}"</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
