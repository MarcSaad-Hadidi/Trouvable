// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    GitCommitIcon,
    HistoryIcon,
    PlayIcon,
    WorkflowIcon,
    ChevronRightIcon,
    ZapIcon,
    TerminalIcon
} from 'lucide-react';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

async function parseJsonResponse(response) {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
    return json;
}

function formatMetricValue(value) {
    if (value == null) return '—';
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}`;
    return String(value);
}

const EASE = [0.16, 1, 0.3, 1];

/* ── Main View ── */

export default function GeoContinuousPage() {
    const { clientId, invalidateWorkspace } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('continuous');
    const [pendingAction, setPendingAction] = useState(null);
    const [feedback, setFeedback] = useState(null);

    const diffFeed = useMemo(() => {
        const down = (data?.declining || []).map((metric) => ({ ...metric, type: 'regression' }));
        const up = (data?.improving || []).map((metric) => ({ ...metric, type: 'improvement' }));
        return [...down, ...up].slice(0, 15);
    }, [data]);

    async function triggerAction(payload, successMessage) {
        if (!clientId || pendingAction) return;
        setPendingAction(payload.action);
        setFeedback(null);
        try {
            const response = await fetch(`/api/admin/geo/client/${clientId}/continuous/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            await parseJsonResponse(response);
            setFeedback(successMessage);
            invalidateWorkspace();
        } catch (e) { setFeedback(e.message); } finally { setPendingAction(null); }
    }

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Monitoring Continu"
            subtitle="Veille quotidienne sur les signaux GEO, jobs récurrents et connecteurs temps-réel."
            actions={(
                <button
                    onClick={() => triggerAction({ action: 'dispatch_tick', maxJobsToQueue: 20 }, 'Tick continu dispatché.')}
                    disabled={Boolean(pendingAction)}
                    className={COMMAND_BUTTONS.primary}
                >
                    <PlayIcon className={cn("h-4 w-4", pendingAction && "animate-pulse")} />
                    {pendingAction ? 'En cours...' : 'Forcer Tick Continu'}
                </button>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Synchronisation du moteur continu...</div></CommandPageShell>;
    if (error || !data) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error || "Le moteur continu ne répond pas."} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Fréquence" value={data.dailyMode?.label || 'Quotidien'} detail="Mode surveillance actif" tone="info" />
                <CommandMetricCard label="Variations" value={diffFeed.length} detail="Dernières 24h" tone={diffFeed.length > 0 ? 'warning' : 'neutral'} />
                <CommandMetricCard label="Jobs Actifs" value={data.jobs?.summary?.activeJobs || 0} detail={`${data.jobs?.summary?.failedJobs || 0} échecs`} tone={(data.jobs?.summary?.failedJobs || 0) > 0 ? 'warning' : 'ok'} />
                <CommandMetricCard label="Connecteurs" value={`${data.connectors?.summary?.configured || 0} Actifs`} detail="Intégrations live" tone="ok" />
            </div>

            {feedback && (
                <div className={cn(COMMAND_PANEL, "mt-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white/55")}>
                    {feedback}
                </div>
            )}

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className={cn(COMMAND_PANEL, "lg:col-span-8 flex flex-col p-0 overflow-hidden")}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <GitCommitIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Changements Détectés</h3>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/20">
                            <HistoryIcon className="h-3.5 w-3.5" /> {data.snapshotCoverage?.count || 0} snapshots persistés
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto geo-scrollbar p-6 space-y-4">
                        {diffFeed.length > 0 ? diffFeed.map((diff, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
                                className={cn(COMMAND_SURFACE, "p-0 overflow-hidden group hover:bg-white/[0.02] transition-all")}
                            >
                                <div className="px-5 py-3 border-b border-white/[0.03] bg-white/[0.01] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", diff.type === 'improvement' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]')} />
                                        <span className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors">{diff.label}</span>
                                    </div>
                                    <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border", diff.type === 'improvement' ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-rose-500/20 text-rose-400 bg-rose-500/5")}>
                                        {diff.type === 'improvement' ? 'Progression' : 'Régression'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-white/[0.03] bg-black/40">
                                    <div className="p-4">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Précédent</div>
                                        <div className="text-[15px] font-bold text-white/40 tabular-nums">{formatMetricValue(diff.previous)}</div>
                                    </div>
                                    <div className="p-4">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Actuel</div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-[15px] font-bold text-white tabular-nums">{formatMetricValue(diff.latest)}</div>
                                            <div className={cn("text-[11px] font-bold tabular-nums", diff.type === 'improvement' ? "text-emerald-400" : "text-rose-400")}>
                                                {diff.delta > 0 ? `+${diff.delta}` : diff.delta}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )) : (
                            <div className="h-full flex items-center justify-center py-20 opacity-20">
                                <HistoryIcon className="h-12 w-12 mx-auto mb-4" />
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Aucun changement détecté</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-0 overflow-hidden")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Orchestrateur</h3>
                            <WorkflowIcon className="h-4 w-4 text-[#7c6aef]" />
                        </div>
                        <div className="p-4 space-y-2">
                            {(data.jobs?.jobs || []).map((job, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-3 group")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors">{job.job_type}</span>
                                        <div className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border", job.status === 'failed' ? "border-rose-500/20 text-rose-400 bg-rose-500/5" : "border-emerald-500/20 text-emerald-400 bg-emerald-500/5")}>{job.status}</div>
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/20">Cadence: {job.cadence_minutes || 1440}m</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <ZapIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Action Center</h3>
                        </div>
                        <div className="space-y-3">
                            {(data.connectors?.connections || []).map((c, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-3 flex items-center justify-between")}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", c.status === 'healthy' ? "bg-emerald-500" : "bg-white/10")} />
                                        <span className="text-[12px] font-bold text-white/60 truncate">{c.provider}</span>
                                    </div>
                                    <ChevronRightIcon className="h-3 w-3 text-white/10" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <TerminalIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Console Live</h3>
                        </div>
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] text-white/30 leading-relaxed overflow-hidden">
                            <div className="flex gap-2">
                                <span className="text-[#7c6aef]">SYS</span>
                                <span className="truncate">Service monitoring initialisé...</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-emerald-400">OK</span>
                                <span className="truncate">Snapshots synchronisés (v2.4.1).</span>
                            </div>
                            <div className="flex gap-2 animate-pulse">
                                <span className="text-[#7c6aef]">REC</span>
                                <span className="truncate">Attente du prochain tick...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
