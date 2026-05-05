// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { 
    AlertCircleIcon, 
    BellIcon, 
    ShieldCheckIcon, 
    ActivityIcon, 
    FilterIcon, 
    ChevronRightIcon, 
    ZapIcon, 
    ClockIcon,
    TerminalIcon
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

/* ── Constants ── */

const SEVERITY_META = {
    critique: { label: 'CRITIQUE', color: 'text-rose-300', bg: 'bg-rose-500/30 border-rose-500/50', dot: 'bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]' },
    avertissement: { label: 'VIGILANCE', color: 'text-amber-300', bg: 'bg-amber-500/30 border-amber-500/50', dot: 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]' },
    info: { label: 'SIGNAL', color: 'text-[#b8adff]', bg: 'bg-[#7c6aef]/30 border-[#7c6aef]/50', dot: 'bg-[#7c6aef] shadow-[0_0_12px_rgba(124,106,239,0.8)]' },
    ok: { label: 'OPTIMAL', color: 'text-emerald-300', bg: 'bg-emerald-500/30 border-emerald-500/50', dot: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]' },
};

const SEVERITY_KEYS = ['critique', 'avertissement', 'info', 'ok'];

/* ── Components ── */
 
function AlertCard({ alert }) {
    const meta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
    const isCrit = alert.severity === 'critique';
    
    return (
        <div className={cn(
            COMMAND_SURFACE, 
            "p-8 group hover:bg-white/[0.06] transition-all border-l-4 relative overflow-hidden", 
            isCrit ? "border-rose-500 bg-rose-500/[0.03] shadow-[0_0_50px_rgba(244,63,94,0.05)]" : "border-white/10"
        )}>
            {isCrit && (
                <div className="absolute top-0 right-0 p-2">
                    <AlertCircleIcon className="h-4 w-4 text-rose-500/20 animate-pulse" />
                </div>
            )}
 
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-5">
                    <div className={cn("px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-[0.25em] border shadow-sm", meta.bg, meta.color)}>
                        {meta.label}
                    </div>
                    <h4 className={cn("text-[18px] font-black transition-colors leading-tight", isCrit ? "text-white" : "text-white/90 group-hover:text-white")}>{alert.title}</h4>
                </div>
                <ReliabilityPill value={alert.reliability} />
            </div>
            
            <div className="p-5 rounded-2xl bg-black/80 border border-white/[0.08] mb-8 relative overflow-hidden group-hover:border-white/20 transition-colors">
                <div className={cn("absolute top-0 left-0 w-1.5 h-full opacity-40", isCrit ? "bg-rose-500" : "bg-white/10")} />
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/20 mb-3 ml-2">Preuve de l'Incident</div>
                <p className="text-[14px] text-white/80 leading-relaxed italic pr-4 ml-2 font-medium">"{alert.evidence}"</p>
            </div>
 
            <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#7c6aef]/10 border border-[#7c6aef]/30 group-hover:border-[#7c6aef]/60 transition-all shadow-[0_0_20px_rgba(124,106,239,0.1)]">
                    <ZapIcon className="h-4 w-4 text-[#7c6aef]" />
                    <div className="text-[12px] text-[#d4ccff] font-black uppercase tracking-widest">
                        {alert.suggestedAction}
                    </div>
                </div>
                <button className="ml-auto text-[11px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:underline decoration-[#7c6aef] underline-offset-4 transition-all">
                    Ignorer le signal
                </button>
            </div>
        </div>
    );
}

function FreshnessItem({ label, state, hours }) {
    const tone = state === 'fresh' ? 'text-emerald-400' : state === 'warning' ? 'text-amber-400' : 'text-rose-400';
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/20">{label}</span>
            <div className="flex items-center gap-2">
                {hours != null && <span className="text-[10px] font-mono text-white/20">{hours}h</span>}
                <div className={cn("text-[10px] font-bold uppercase tracking-widest", tone)}>
                    {state === 'fresh' ? 'À Jour' : state === 'warning' ? 'En retard' : 'Critique'}
                </div>
            </div>
        </div>
    );
}

/* ── Main View ── */

export default function GeoAlertsView() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('alerts');
    const [sevFilter, setSevFilter] = useState({ critique: true, avertissement: true, info: true, ok: false });

    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    const summary = data?.summary || {};
    const systemStatus = data?.systemStatus || {};

    const filteredAlerts = useMemo(
        () => alerts.filter((a) => sevFilter[a.severity]),
        [alerts, sevFilter]
    );

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Incident Feed"
            subtitle="Agrégat temps-réel des signaux d'alerte : crawlers, schema, cohérence et préparation."
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Agrégation des signaux d'alerte...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Alertes Actives" value={summary.total || 0} detail="Incidents détectés" tone={summary.criticalCount > 0 ? 'critical' : (summary.warningCount > 0 ? 'warning' : 'ok')} />
                <CommandMetricCard label="Critiques" value={summary.criticalCount || 0} detail="Priorité opérateur" tone={summary.criticalCount > 0 ? 'critical' : 'neutral'} />
                <CommandMetricCard label="Vigilance" value={summary.warningCount || 0} detail="Points à surveiller" tone={summary.warningCount > 0 ? 'warning' : 'neutral'} />
                <CommandMetricCard label="Audit" value="Frais" detail="Dernière lecture < 24h" tone="ok" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-0 overflow-hidden flex flex-col")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BellIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Flux d'incidents</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                {SEVERITY_KEYS.map(k => (
                                    <button 
                                        key={k}
                                        onClick={() => setSevFilter(prev => ({ ...prev, [k]: !prev[k] }))}
                                        className={cn("flex items-center gap-2 transition-all", sevFilter[k] ? "opacity-100" : "opacity-30 grayscale")}
                                    >
                                        <div className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_META[k].dot)} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{SEVERITY_META[k].label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {filteredAlerts.length > 0 ? (
                                filteredAlerts.map((a, i) => <AlertCard key={i} alert={a} />)
                            ) : (
                                <div className="py-20 text-center opacity-20">
                                    <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4" />
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Aucun incident détecté sur ce périmètre</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6 text-emerald-400">
                            <ShieldCheckIcon className="h-4 w-4" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]">Recommandations Stratégiques</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(data.recommendations || []).map((r, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-5 border-l-2 border-[#7c6aef]/30")}>
                                    <div className="text-[13px] font-bold text-white mb-2">{r.title}</div>
                                    <p className="text-[11px] text-white/40 leading-relaxed mb-3">{r.action}</p>
                                    <div className={cn("px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest inline-block border", SEVERITY_META[r.severity]?.bg)}>
                                        {SEVERITY_META[r.severity]?.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <ActivityIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Santé du Système</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/20">Fraîcheur des Données</h4>
                                <div className="space-y-1">
                                    <FreshnessItem label="Dernier Audit" state={systemStatus.freshness?.audit?.state} hours={systemStatus.freshness?.audit?.hours} />
                                    <FreshnessItem label="Dernier Run" state={systemStatus.freshness?.runs?.state} hours={systemStatus.freshness?.runs?.hours} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/20">Jobs & Connecteurs</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={cn(COMMAND_SURFACE, "p-3")}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Jobs Actifs</div>
                                        <div className="text-[14px] font-bold text-white">{systemStatus.jobs?.active || 0} / {systemStatus.jobs?.total || 0}</div>
                                    </div>
                                    <div className={cn(COMMAND_SURFACE, "p-3")}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Erreurs Jobs</div>
                                        <div className={cn("text-[14px] font-bold", systemStatus.jobs?.failed > 0 ? "text-rose-400" : "text-emerald-400")}>{systemStatus.jobs?.failed || 0}</div>
                                    </div>
                                    <div className={cn(COMMAND_SURFACE, "p-3")}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Connecteurs</div>
                                        <div className="text-[14px] font-bold text-white">{systemStatus.connectors?.configured || 0}</div>
                                    </div>
                                    <div className={cn(COMMAND_SURFACE, "p-3")}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Erreurs Conn.</div>
                                        <div className={cn("text-[14px] font-bold", systemStatus.connectors?.error > 0 ? "text-rose-400" : "text-emerald-400")}>{systemStatus.connectors?.error || 0}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <TerminalIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Moniteur Opérationnel</h3>
                        </div>
                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-white/40 leading-relaxed">
                            <div className="flex gap-2">
                                <span className="text-[#7c6aef]">INF</span>
                                <span>Initialisation flux agrégé...</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-emerald-400">OK</span>
                                <span>Synchro connecteurs terminée.</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[#7c6aef]">INF</span>
                                <span>Vérification seuils GEO terminée.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
