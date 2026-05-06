// @ts-nocheck
'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
    SparklesIcon, 
    MessageSquareIcon, 
    ZapIcon, 
    ShieldCheckIcon, 
    SearchIcon, 
    HistoryIcon, 
    PlayIcon
} from 'lucide-react';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { 
    CommandHeader, 
    CommandMetricCard, 
    CommandPageShell 
} from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';

/* ── Utilities ── */

function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function evidenceDotColor(level) {
    if (level === 'strong') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
    if (level === 'medium') return 'bg-[#7c6aef] shadow-[0_0_8px_rgba(124,106,239,0.4)]';
    return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
}

function classifyRunUsefulness(summary, lastRun) {
    if (!lastRun) return { level: 'pending', label: 'En attente', tone: 'text-white/20', bg: 'bg-white/5 border-white/10' };
    if (lastRun.status === 'running') return { level: 'running', label: 'En cours', tone: 'text-[#7c6aef]', bg: 'bg-[#7c6aef]/10 border-[#7c6aef]/20' };
    if (lastRun.status === 'failed') return { level: 'failed', label: 'Échec', tone: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };

    const docs = summary?.documents_count || 0;
    if (docs === 0) return { level: 'empty', label: 'Aucun signal', tone: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { level: 'useful', label: 'Analysé', tone: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
}

async function parseJsonResponse(response) {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
    return json;
}

/* ── Sub-components ── */

function SignalCard({ item }) {
    return (
        <div className={cn(COMMAND_SURFACE, "p-4 group hover:bg-white/[0.04] transition-all")}>
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors leading-snug">{item.label || item.title}</div>
                <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", evidenceDotColor(item.evidence_level))} />
            </div>
            {item.rationale && <p className="text-[11px] text-white/40 leading-relaxed mb-3">{item.rationale}</p>}
            <div className="flex items-center justify-between">
                <div className="flex gap-1.5 overflow-hidden">
                    {item.subreddits?.slice(0, 2).map((s, i) => (
                        <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-[#7c6aef]/60">r/{s}</span>
                    ))}
                </div>
                {item.count != null && <span className="text-[10px] font-bold text-white/20">{item.count} mentions</span>}
            </div>
        </div>
    );
}

function OpportunityCard({ item }) {
    return (
        <div className={cn(COMMAND_SURFACE, "p-5 border-l-2 border-[#7c6aef]/30 group hover:border-[#7c6aef] transition-all")}>
            <div className="text-[14px] font-bold text-white/90 mb-2">{item.title}</div>
            <p className="text-[12px] text-white/40 leading-relaxed italic">"{item.rationale}"</p>
            {item.mention_count != null && (
                <div className="mt-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                    <ZapIcon className="h-2.5 w-2.5" /> {item.mention_count} signaux associés
                </div>
            )}
        </div>
    );
}

function AiBriefingPanel({ clientId }) {
    const [briefing, setBriefing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const generateBriefing = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/admin/geo/client/${clientId}/briefing`, { method: 'POST' });
            const json = await parseJsonResponse(res);
            setBriefing(json.briefing);
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    }, [clientId]);

    return (
        <div className={cn(COMMAND_PANEL, "flex flex-col")}>
            <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4 text-[#7c6aef]" />
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Briefing IA Communautaire</h3>
                </div>
                <button 
                    onClick={generateBriefing} 
                    disabled={loading}
                    className="text-[10px] font-bold uppercase tracking-widest text-[#7c6aef] hover:text-[#b8adff] transition-colors disabled:opacity-50"
                >
                    {loading ? 'Génération...' : briefing ? 'Régénérer' : 'Générer'}
                </button>
            </div>

            <div className="p-6 overflow-y-auto geo-scrollbar max-h-[500px]">
                {loading ? (
                    <div className="py-12 text-center animate-pulse">
                        <SparklesIcon className="h-8 w-8 text-[#7c6aef]/20 mx-auto mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Synthèse sémantique des discussions...</p>
                    </div>
                ) : briefing ? (
                    <div className="space-y-6">
                        <div className="p-5 rounded-2xl bg-[#7c6aef]/5 border border-[#7c6aef]/10">
                            <p className="text-[15px] font-bold text-white/90 leading-relaxed italic">"{briefing.headline}"</p>
                        </div>
                        
                        {briefing.key_findings?.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {briefing.key_findings.map((f, i) => (
                                    <div key={i} className={cn(COMMAND_SURFACE, "p-4")}>
                                        <div className="text-[12px] font-bold text-white/80 mb-2">{f.finding}</div>
                                        <p className="text-[11px] text-white/40 leading-relaxed">{f.evidence}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60">Irritants / Pain Points</h4>
                                <ul className="space-y-2">
                                    {briefing.pain_points?.map((p, i) => (
                                        <li key={i} className="flex gap-3 text-[12px] text-white/50"><div className="h-1 w-1 rounded-full bg-amber-400 mt-2 shrink-0" /> {p}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60">Signaux d'achat</h4>
                                <ul className="space-y-2">
                                    {briefing.buying_signals?.map((s, i) => (
                                        <li key={i} className="flex gap-3 text-[12px] text-white/50"><div className="h-1 w-1 rounded-full bg-emerald-400 mt-2 shrink-0" /> {s}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center opacity-20">
                        <MessageSquareIcon className="h-12 w-12 mx-auto mb-4" />
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Données brutes prêtes pour synthèse</p>
                    </div>
                )}
                {error && <p className="mt-4 text-[11px] text-rose-400">{error}</p>}
            </div>
        </div>
    );
}

/* ── Main View ── */

export default function GeoSocialView() {
    const { clientId, invalidateWorkspace } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('social');
    const [launching, setLaunching] = useState(false);

    const summary = data?.summary || {};
    const lastRun = summary.last_run || null;
    const runUsefulness = classifyRunUsefulness(summary, lastRun);
    
    const topSignals = useMemo(() => {
        if (!data) return { complaints: [], questions: [], themes: [] };
        return {
            complaints: data.topComplaints || [],
            questions: data.topQuestions || [],
            themes: data.topThemes || []
        };
    }, [data]);

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Veille Communautaire"
            subtitle="Analyse des discussions, irritants et signaux d'émergence sur Reddit et forums."
            actions={(
                <div className="flex gap-2">
                    <Link href={`/admin/clients/${clientId}/geo/runs`} className={COMMAND_BUTTONS.secondary}>
                        <HistoryIcon className="h-4 w-4" /> Historique
                    </Link>
                    <button 
                        onClick={async () => {
                            setLaunching(true);
                            try {
                                // Logic similar to legacy but streamlined
                                await fetch(`/api/admin/geo/client/${clientId}/continuous/actions`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'worker_tick', maxRunsToExecute: 1 })
                                });
                                invalidateWorkspace();
                            } catch (e) { console.error(e); } finally { setLaunching(false); }
                        }}
                        disabled={launching}
                        className={COMMAND_BUTTONS.primary}
                    >
                        <PlayIcon className={cn("h-4 w-4", launching && "animate-pulse")} />
                        {launching ? 'Lancement...' : 'Collecter Maintenant'}
                    </button>
                </div>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Synchronisation des discussions...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Documents" value={summary.documents_count || 0} detail="Sources collectées" tone="info" />
                <CommandMetricCard label="Clusters Thématiques" value={summary.clusters_count || 0} detail="Patterns sémantiques" tone="neutral" />
                <CommandMetricCard label="Statut Collecte" value={runUsefulness.label} detail={formatDateTime(lastRun?.started_at)} tone={runUsefulness.level === 'useful' ? 'ok' : 'warning'} />
                <CommandMetricCard label="Actionnabilité" value={summary.opportunities_count || 0} detail="Opportunités IA" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    {/* Main Signals Matrix */}
                    <div className={cn(COMMAND_PANEL, "p-0 overflow-hidden flex flex-col")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Signaux Observés</h3>
                            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-white/20">
                                <SearchIcon className="h-3.5 w-3.5" /> {summary.total_discussions || 0} discussions
                            </div>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60 mb-2">Plaintes & Irritants</div>
                                {topSignals.complaints.length > 0 ? topSignals.complaints.map((s, i) => <SignalCard key={i} item={s} />) : <p className="text-[11px] text-white/10 italic">Aucun signal.</p>}
                            </div>
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#7c6aef]/60 mb-2">Questions Fréquentes</div>
                                {topSignals.questions.length > 0 ? topSignals.questions.map((s, i) => <SignalCard key={i} item={s} />) : <p className="text-[11px] text-white/10 italic">Aucun signal.</p>}
                            </div>
                            <div className="space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 mb-2">Thèmes Porteurs</div>
                                {topSignals.themes.length > 0 ? topSignals.themes.map((s, i) => <SignalCard key={i} item={s} />) : <p className="text-[11px] text-white/10 italic">Aucun signal.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Opportunities */}
                    {(data.faqOpportunities?.length || data.contentOpportunities?.length) && (
                        <div className={cn(COMMAND_PANEL, "p-6")}>
                            <div className="flex items-center gap-2 mb-6">
                                <ZapIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Angles d'Action (IA)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[...(data.faqOpportunities || []), ...(data.contentOpportunities || [])].slice(0, 4).map((o, i) => (
                                    <OpportunityCard key={i} item={o} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <AiBriefingPanel clientId={clientId} />

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Cibles de Recherche</h3>
                        </div>
                        <div className="space-y-2">
                            {(summary.query_seeds || []).map((seed, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-3 flex items-center justify-between group cursor-default")}>
                                    <div className="text-[12px] text-white/60 group-hover:text-white transition-colors truncate pr-2">{seed}</div>
                                    <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-4">Détails Collecte</div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-white/35 uppercase tracking-widest">Connecteur</span>
                                <span className="text-emerald-400 font-bold uppercase tracking-widest">Actif</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-white/35 uppercase tracking-widest">Sources</span>
                                <span className="text-white/80 font-bold">Reddit, Forums, Web</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-white/35 uppercase tracking-widest">Période</span>
                                <span className="text-white/80 font-bold">Derniers 30 jours</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
