// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
    BotIcon, 
    ShieldXIcon, 
    ActivityIcon,
    SearchIcon
} from 'lucide-react';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { CommandTable } from '@/features/admin/dashboard/shared/components/command/CommandTable';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function toneFromStatus(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('autorise')) return 'ok';
    if (normalized.includes('ambigu') || normalized.includes('confirmer')) return 'warning';
    if (normalized.includes('bloque')) return 'critical';
    return 'neutral';
}

function chipClass(status) {
    const tone = toneFromStatus(status);
    if (tone === 'ok') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (tone === 'warning') return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    if (tone === 'critical') return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    return 'bg-white/5 text-white/40 border border-white/10';
}

/* ── Main View ── */

export default function GeoCrawlersPage() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('crawlers');
    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';

    const chartRows = (data?.botRows || []).map((item) => ({
        name: item.name,
        rules: (item.allow?.length || 0) + (item.disallow?.length || 0),
        fill: toneFromStatus(item.operatorStatus) === 'ok' ? '#10b981' : (toneFromStatus(item.operatorStatus) === 'warning' ? '#f59e0b' : (toneFromStatus(item.operatorStatus) === 'critical' ? '#f43f5e' : '#7c6aef')),
    }));

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Politiques Crawlers"
            subtitle="Lecture temps-réel du robots.txt et des restrictions observées pour les agents IA."
            actions={(
                <Link href={`${geoBase}/continuous`} className={COMMAND_BUTTONS.secondary}>
                    <ActivityIcon className="h-4 w-4" /> Monitoring Actif
                </Link>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Lecture des politiques bots...</div></CommandPageShell>;
    if (error || !data) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error || "Impossible d'accéder aux politiques bots."} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Bots Bloqués" value={data.summary?.blockedCount || 0} detail="Sur robots.txt" tone={(data.summary?.blockedCount || 0) > 0 ? 'critical' : 'neutral'} />
                <CommandMetricCard label="Restrictions" value={data.summary?.restrictionCount || 0} detail="Directives spécifiques" tone={(data.summary?.restrictionCount || 0) > 0 ? 'warning' : 'ok'} />
                <CommandMetricCard label="Statut robots.txt" value={data.summary?.robotsStatus || 'Détecté'} detail="Validité syntaxique" tone="ok" />
                <CommandMetricCard label="Fraîcheur" value={data.summary?.liveFreshness || 'n.d.'} detail="Dernier scan" tone="info" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <ActivityIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Volume Directives</h3>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.2)" fontSize={10} fontWeight={600} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#06070a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                                    <Bar dataKey="rules" radius={[0, 4, 4, 0]} barSize={12}>
                                        {chartRows.map((row) => <Cell key={row.name} fill={row.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldXIcon className="h-4 w-4 text-rose-500/50" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Patterns Bloquants</h3>
                        </div>
                        <div className="space-y-3">
                            {(data.restrictionRows || []).slice(0, 3).map((row, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-3 border-l-2 border-rose-500/30")}>
                                    <div className="text-[11px] font-mono text-white/80 mb-1">{row.pattern}</div>
                                    <div className="text-[10px] text-white/30">{row.impact}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={cn(COMMAND_PANEL, "lg:col-span-8 flex flex-col overflow-hidden p-0")}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BotIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Inventaire des Agents IA</h3>
                        </div>
                        <SearchIcon className="h-4 w-4 text-white/10" />
                    </div>
                    <CommandTable
                        className="flex-1"
                        headers={['Agent', 'Directive robots.txt', 'Impact GEO', 'Statut']}
                        rows={(data.botRows || []).map((row) => [
                            <div className="flex items-center gap-3">
                                <div className={cn("h-1.5 w-1.5 rounded-full", toneFromStatus(row.operatorStatus) === 'ok' ? 'bg-emerald-500' : 'bg-rose-500')} />
                                <span className="text-[13px] font-bold text-white/90">{row.name}</span>
                            </div>,
                            <span className="text-[11px] font-mono text-white/30">{row.ruleSource || 'Global'}</span>,
                            <div className="max-w-[300px]">
                                <div className="text-[12px] text-white/70 line-clamp-1">{row.impact || 'Standard'}</div>
                                <div className="text-[10px] text-white/20 mt-0.5 truncate italic">"{row.evidence || 'N/A'}"</div>
                            </div>,
                            <div className={cn("inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border", chipClass(row.operatorStatus))}>{row.operatorStatus}</div>
                        ])}
                    />
                </div>
            </div>
        </CommandPageShell>
    );
}
