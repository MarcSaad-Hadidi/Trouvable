// @ts-nocheck
'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ActivityIcon,
    AlertCircleIcon,
    CheckCircle2Icon,
    ClockIcon,
    CpuIcon,
    FilterIcon,
    HistoryIcon,
    PlayIcon,
    RefreshCwIcon,
    SearchIcon,
    ServerIcon,
    Trash2Icon,
    XCircleIcon,
    ArrowUpRightIcon,
    ChevronRightIcon,
    MessageSquareIcon,
    TerminalIcon
} from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function parseJsonResponse(response) {
    return response.json().catch(() => ({})).then((json) => {
        if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
        return json;
    });
}

function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return '—'; }
}

function formatShortTime(value) {
    if (!value) return '--:--';
    try {
        return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '--:--'; }
}

function statusMeta(status) {
    if (status === 'completed') return { label: 'Succès', short: 'OK', icon: CheckCircle2Icon, color: 'text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    if (status === 'partial') return { label: 'Partiel', short: 'PART', icon: AlertCircleIcon, color: 'text-amber-400', chip: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    if (status === 'running' || status === 'pending') return { label: 'En cours', short: 'RUN', icon: RefreshCwIcon, color: 'text-[#7c6aef]', chip: 'bg-[#7c6aef]/10 text-[#7c6aef] border border-[#7c6aef]/20' };
    if (status === 'failed' || status === 'partial_error') return { label: 'Échec', short: 'ERR', icon: XCircleIcon, color: 'text-rose-400', chip: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
    return { label: status || 'n.d.', short: '—', icon: ClockIcon, color: 'text-white/40', chip: 'bg-white/5 text-white/40 border border-white/10' };
}

function modeLabel(run) {
    return run?.discovery_mode_label || run?.discovery_mode || 'Mode inconnu';
}

function riskLabel(value) {
    const labels = {
        no_context: 'Sans contexte',
        brand_name_only: 'Marque seule',
        source_grounded: 'Sourcee',
        context_injected: 'Contexte injecte',
    };
    return labels[value] || value || 'n.d.';
}

function evidenceLabel(value) {
    const labels = {
        none: 'Preuve absente',
        weak: 'Preuve faible',
        source_provided: 'Sources fournies',
        cited_url: 'URL citee',
        verified_source: 'Source verifiee',
    };
    return labels[value] || value || 'n.d.';
}

function riskChipClass(value) {
    if (value === 'context_injected') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    if (value === 'source_grounded') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    if (value === 'brand_name_only') return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
    return 'border-white/10 bg-white/5 text-white/40';
}

function latencySeconds(run) {
    const ms = Number(run?.latency_ms || 0);
    if (!Number.isFinite(ms) || ms <= 0) return 1;
    return Math.max(1, Math.round(ms / 1000));
}

const EASE = [0.16, 1, 0.3, 1];

/* ── Components ── */

export default function GeoRunsPage() {
    const { clientId, invalidateWorkspace, refreshToken } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('runs');

    const [selectedRunId, setSelectedRunId] = useState(null);
    const [selectedRunDetail, setSelectedRunDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [search, setSearch] = useState('');
    const [clearPending, setClearPending] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);
    const [showAllCitations, setShowAllCitations] = useState(false);

    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';
    const history = data?.history || [];
    const statusCounts = data?.summary?.statusCounts || {};
    const totalRuns = data?.summary?.total || 0;

    const filteredRuns = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return history;
        return history.filter((run) => (
            String(run.id || '').toLowerCase().includes(query)
            || String(run.query_text || '').toLowerCase().includes(query)
            || String(run.provider || '').toLowerCase().includes(query)
        ));
    }, [history, search]);

    const visibleRuns = useMemo(() => filteredRuns.slice(0, 50), [filteredRuns]);

    const timelineData = useMemo(() => {
        return history.slice(0, 32).reverse().map((run) => ({
            id: run.id,
            time: formatShortTime(run.created_at),
            duration: latencySeconds(run),
            status: run.status,
        }));
    }, [history]);

    useEffect(() => {
        if (!visibleRuns.length) {
            setSelectedRunId(null);
            return;
        }
        if (!selectedRunId || !visibleRuns.some((run) => run.id === selectedRunId)) {
            setSelectedRunId(visibleRuns[0].id);
        }
    }, [selectedRunId, visibleRuns]);

    useEffect(() => {
        if (!clientId || !selectedRunId) {
            setSelectedRunDetail(null);
            return;
        }

        const controller = new AbortController();
        setDetailLoading(true);
        setDetailError(null);

        fetch(`/api/admin/geo/client/${clientId}/runs/${selectedRunId}?refresh=${refreshToken}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(parseJsonResponse)
            .then((json) => setSelectedRunDetail(json))
            .catch((loadError) => {
                if (loadError.name === 'AbortError') return;
                setDetailError(loadError.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setDetailLoading(false);
            });

        setShowAllCitations(false);
        return () => controller.abort();
    }, [clientId, refreshToken, selectedRunId]);

    async function clearErrors() {
        if (!clientId || clearPending) return;
        setClearPending(true);
        try {
            const response = await fetch(`/api/admin/geo/client/${clientId}/runs/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear_errors' }),
            });
            const json = await parseJsonResponse(response);
            setActionMessage(`${json.deleted || 0} exécutions purgées.`);
            invalidateWorkspace();
        } catch (actionError) {
            setActionMessage(actionError.message);
        } finally {
            setClearPending(false);
        }
    }

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Historique d'Exécution"
            subtitle="Timeline et inspecteur haute-densité des audits moteurs. Suivi des flux radar."
            actions={(
                <div className="flex gap-2">
                    <button type="button" onClick={clearErrors} disabled={clearPending} className={COMMAND_BUTTONS.secondary}>
                        <Trash2Icon className="h-3.5 w-3.5" />
                        Purger
                    </button>
                    <Link href={`${geoBase}/prompts`} className={COMMAND_BUTTONS.primary}>
                        <PlayIcon className="h-3.5 w-3.5" />
                        Lancer Audit
                    </Link>
                </div>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Synchronisation de la timeline...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Total Runs" value={totalRuns} detail="Historique global" tone="info" />
                <CommandMetricCard label="Succès" value={`${totalRuns ? Math.round(((statusCounts.completed || 0) / totalRuns) * 100) : 0}%`} detail={`${(statusCounts.failed || 0)} échecs`} tone={(statusCounts.failed || 0) > 0 ? 'warning' : 'ok'} />
                <CommandMetricCard label="Latence Moy." value={history.length ? `${Math.round(history.reduce((s, r) => s + latencySeconds(r), 0) / history.length)}s` : '—'} detail="Réponse moteur" tone="neutral" />
                <CommandMetricCard label="Validité Parsing" value={`${Math.round((data.summary?.parseCounts?.parsed_success / (totalRuns || 1)) * 100)}%`} detail="Intégrité JSON" tone="ok" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <div className={cn(COMMAND_PANEL, 'p-6 h-[160px] flex flex-col relative overflow-hidden group bg-[#06070a]')}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ActivityIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Pression Temps-Réel</h3>
                            </div>
                            <div className="flex gap-4">
                                {['completed', 'failed'].map(s => (
                                    <div key={s} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/20">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", s === 'completed' ? 'bg-emerald-500' : 'bg-rose-500')} />
                                        {s}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={timelineData}>
                                    <Bar dataKey="duration" radius={[1, 1, 0, 0]}>
                                        {timelineData.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.status === 'completed' ? '#10b981' : (entry.status === 'partial' ? '#f59e0b' : '#f43f5e')} fillOpacity={0.4} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, 'flex-1 flex flex-col overflow-hidden p-0 bg-[#06070a]')}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-white/[0.01]">
                            <div className="relative flex-1 max-w-sm">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/10" />
                                <input
                                    type="text"
                                    placeholder="FILTRER LES RUNS..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold tracking-widest text-white/80 placeholder:text-white/10 pl-9 uppercase"
                                />
                            </div>
                            <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{visibleRuns.length} ENTRÉES</div>
                        </div>

                        <div className="flex-1 overflow-y-auto geo-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-[#060708] border-b border-white/[0.05]">
                                    <tr>
                                        <th className="px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-white/20">Run ID</th>
                                        <th className="px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-white/20">Prompt Inspecté</th>
                                        <th className="px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-white/20">Statut</th>
                                        <th className="px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-white/20 text-right">Moteur / Latence</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {visibleRuns.map((run) => {
                                        const meta = statusMeta(run.status);
                                        const isSelected = selectedRunId === run.id;
                                        return (
                                            <tr
                                                key={run.id}
                                                onClick={() => setSelectedRunId(run.id)}
                                                className={cn(
                                                    'cursor-pointer transition-all hover:bg-white/[0.02] group',
                                                    isSelected ? 'bg-[#7c6aef]/5' : ''
                                                )}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className={cn("font-mono text-[11px] font-bold", isSelected ? 'text-[#b8adff]' : 'text-white/70')}>{run.id}</span>
                                                        <span className="text-[9px] text-white/10 font-bold uppercase tracking-widest mt-1">{formatShortTime(run.created_at)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-[12px] text-white/50 line-clamp-1 italic group-hover:text-white/80 transition-colors">"{run.query_text}"</div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                        <span className={cn("rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest", riskChipClass(run.bias_risk))}>
                                                            {modeLabel(run)}
                                                        </span>
                                                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white/25">
                                                            {evidenceLabel(run.evidence_level)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("h-1.5 w-1.5 rounded-full", meta.color.replace('text-', 'bg-'))} />
                                                        <span className={cn("text-[9px] font-bold uppercase tracking-widest", meta.color)}>{meta.label}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{run.provider}</div>
                                                    <div className="text-[10px] font-mono text-white/10">{latencySeconds(run)}s</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {selectedRunId && (
                            <motion.div
                                key={selectedRunId}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.4, ease: EASE }}
                                className={cn(COMMAND_PANEL, 'h-full flex flex-col overflow-hidden p-0 bg-[#06070a]')}
                            >
                                {detailLoading ? (
                                    <div className="flex h-full items-center justify-center p-12 opacity-20">
                                        <RefreshCwIcon className="h-10 w-10 animate-spin" />
                                    </div>
                                ) : detailError ? (
                                    <div className="flex flex-col h-full items-center justify-center p-12 text-center">
                                        <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mb-4">
                                            <AlertCircleIcon className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-[12px] font-bold uppercase tracking-widest text-white/80 mb-2">Échec du chargement</h3>
                                        <p className="text-[11px] text-white/30 max-w-[240px] leading-relaxed mb-6">Impossible de récupérer les détails de cette exécution.</p>
                                        <div className="text-[10px] font-mono text-rose-400/50 bg-rose-500/5 px-3 py-1 rounded border border-rose-500/10">
                                            {detailError}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full">
                                        <div className="p-8 border-b border-white/[0.05] bg-white/[0.01]">
                                            <div className="flex items-center justify-between mb-8">
                                                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-[12px] text-white/60">
                                                    {selectedRunDetail?.run?.id}
                                                </div>
                                                <div className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border", statusMeta(selectedRunDetail?.run?.status).chip)}>
                                                    {selectedRunDetail?.run?.status}
                                                </div>
                                            </div>

                                            <h2 className="text-[14px] font-bold text-white leading-relaxed mb-6 italic">
                                                "{selectedRunDetail?.run?.query_text}"
                                            </h2>

                                            <div className="mb-6 flex flex-wrap items-center gap-2">
                                                <span className={cn("rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest", riskChipClass(selectedRunDetail?.run?.bias_risk))}>
                                                    {modeLabel(selectedRunDetail?.run)}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/35">
                                                    {riskLabel(selectedRunDetail?.run?.bias_risk)}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/35">
                                                    {evidenceLabel(selectedRunDetail?.run?.evidence_level)}
                                                </span>
                                                {selectedRunDetail?.run?.prompt_version && (
                                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/20">
                                                        {selectedRunDetail.run.prompt_version}
                                                    </span>
                                                )}
                                            </div>

                                            {selectedRunDetail?.run?.context_injected && (
                                                <div className="mb-6 rounded-2xl border border-amber-500/15 bg-amber-500/10 p-4 text-[11px] leading-relaxed text-amber-100/70">
                                                    Run avec contexte business injecte. A ne pas utiliser comme preuve de visibilite naturelle.
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Timestamp</div>
                                                    <div className="text-[12px] font-bold text-white/70">{formatDateTime(selectedRunDetail?.run?.created_at)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Moteur</div>
                                                    <div className="text-[12px] font-bold text-white/70 uppercase">{selectedRunDetail?.run?.provider}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-8 space-y-10 geo-scrollbar">
                                            <section>
                                                <div className="flex items-center gap-2 mb-6 text-[#7c6aef]">
                                                    <CpuIcon className="h-4 w-4" />
                                                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Analyse GEO</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className={cn(COMMAND_SURFACE, "p-4")}>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Position</div>
                                                        <div className="text-[18px] font-bold text-white tabular-nums">{selectedRunDetail?.run?.target_position ?? '—'}</div>
                                                    </div>
                                                    <div className={cn(COMMAND_SURFACE, "p-4")}>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Signal</div>
                                                        <div className="text-[13px] font-bold text-white">{selectedRunDetail?.diagnostics?.run_signal_tier || 'N/A'}</div>
                                                    </div>
                                                </div>
                                                {selectedRunDetail?.diagnostics?.insufficient_evidence && (
                                                    <div className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4 text-[11px] font-bold uppercase tracking-widest text-white/25">
                                                        Preuve insuffisante
                                                    </div>
                                                )}
                                            </section>

                                            <section>
                                                <div className="flex items-center gap-2 mb-6 text-amber-400/60">
                                                    <TerminalIcon className="h-4 w-4" />
                                                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Détails de l'échange</h3>
                                                </div>
                                                <div className="space-y-6">
                                                    <div>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-3 flex items-center gap-2">
                                                            <div className="h-1 w-1 rounded-full bg-white/20" />
                                                            Prompt envoyé
                                                        </div>
                                                        <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.03] font-mono text-[11px] text-white/40 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[300px] geo-scrollbar">
                                                            {typeof selectedRunDetail?.run?.prompt_payload === 'string'
                                                                ? selectedRunDetail.run.prompt_payload
                                                                : JSON.stringify(selectedRunDetail?.run?.prompt_payload || {}, null, 2)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-3 flex items-center gap-2">
                                                            <div className="h-1 w-1 rounded-full bg-white/20" />
                                                            Réponse obtenue
                                                        </div>
                                                        <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.03] font-mono text-[11px] text-white/40 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[400px] geo-scrollbar">
                                                            {selectedRunDetail?.run?.raw_response_full || '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>

                                            <section>
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-2 text-white/30">
                                                        <HistoryIcon className="h-4 w-4" />
                                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Citations ({selectedRunDetail?.citations?.length || 0})</h3>
                                                    </div>
                                                    {(selectedRunDetail?.citations?.length || 0) > 3 && (
                                                        <button
                                                            onClick={() => setShowAllCitations(!showAllCitations)}
                                                            className="text-[9px] font-bold uppercase tracking-widest text-[#7c6aef] hover:text-[#b8adff] transition-colors"
                                                        >
                                                            {showAllCitations ? 'Réduire' : 'Voir tout'}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    {(showAllCitations ? selectedRunDetail?.citations : selectedRunDetail?.citations?.slice(0, 3))?.map((c, i) => (
                                                        <div key={i} className={cn(COMMAND_SURFACE, "p-4 group hover:bg-white/[0.04] transition-all")}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-[12px] font-bold text-white/80 group-hover:text-white">{c.host}</span>
                                                                <ArrowUpRightIcon className="h-3 w-3 text-white/10 group-hover:text-[#7c6aef] transition-colors" />
                                                            </div>
                                                            <p className="text-[11px] text-white/30 leading-relaxed italic line-clamp-2">"{c.evidence_span}"</p>
                                                        </div>
                                                    ))}
                                                    {!selectedRunDetail?.citations?.length && (
                                                        <div className="p-10 rounded-2xl border border-dashed border-white/5 text-center text-[10px] font-bold uppercase tracking-widest text-white/10">Aucune citation</div>
                                                    )}
                                                </div>
                                            </section>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </CommandPageShell>
    );
}
