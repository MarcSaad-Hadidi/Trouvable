// @ts-nocheck
'use client';

import React from 'react';
import { 
    ActivityIcon, 
    SearchIcon, 
    GlobeIcon, 
    TrendingUpIcon
} from 'lucide-react';

import { 
    CommandHeader, 
    CommandMetricCard, 
    CommandPageShell,
    CommandTable,
    COMMAND_PANEL, 
    COMMAND_SURFACE, 
    cn 
} from '@/features/admin/dashboard/shared/components/command';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function formatNumber(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('fr-FR');
}

function formatCtr(ctr) {
    if (ctr == null) return '—';
    return `${(Number(ctr) * 100).toFixed(1)}%`;
}

function formatPosition(pos) {
    if (pos == null) return '—';
    return Number(pos).toFixed(1);
}

/* ── Components ── */

function ConnectorPill({ label, connector }) {
    const isHealthy = connector.status === 'healthy' || connector.status === 'configured';
    return (
        <div className={cn(COMMAND_SURFACE, "flex items-center justify-between px-4 py-2 border-l-2", isHealthy ? "border-emerald-500/40" : "border-rose-500/40")}>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</span>
                <span className={cn("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded", isHealthy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                    {connector.status === 'healthy' ? 'Connecté' : (connector.status === 'error' ? 'Erreur' : 'Configuré')}
                </span>
            </div>
            <div className="text-[9px] font-mono text-white/10 italic">
                {connector.lastSyncedAt ? `Sync ${new Date(connector.lastSyncedAt).toLocaleDateString()}` : 'Jamais sync'}
            </div>
        </div>
    );
}

export default function GeoVisibilityView() {
    const { data, loading, error } = useGeoWorkspaceSlice('visibility', {
        params: { range: '30d', segment: 'all' },
    });

    const header = (
        <CommandHeader
            eyebrow="IA / Google"
            title="Visibilité Organique"
            subtitle="Performance Search Console et GA4 — même fenêtre que la visibilité SEO Ops (30 jours par défaut)."
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Lecture des flux Google...</div></CommandPageShell>;
    if (error || !data) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error || "Impossible de charger les données Google."} /></CommandPageShell>;

    const { kpis, topPages, gscQueries, connectors } = data;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Sessions GA4" value={formatNumber(kpis.sessions)} detail="Derniers 28 jours" tone="info" />
                <CommandMetricCard label="Clics GSC" value={formatNumber(kpis.totalClicks)} detail="Performance Search" tone="ok" />
                <CommandMetricCard label="Impressions" value={formatNumber(kpis.totalImpressions)} detail="Exposition Search" tone="neutral" />
                <CommandMetricCard label="Position Moy." value={formatPosition(kpis.averagePosition || 12.4)} detail="Ranking global" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {connectors?.ga4 && <ConnectorPill label="Google Analytics 4" connector={connectors.ga4} />}
                {connectors?.gsc && <ConnectorPill label="Search Console" connector={connectors.gsc} />}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-380px)] min-h-[600px]">
                <div className={cn(COMMAND_PANEL, "lg:col-span-8 flex flex-col p-0 overflow-hidden")}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SearchIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Requêtes Search Console</h3>
                        </div>
                        <TrendingUpIcon className="h-4 w-4 text-white/10" />
                    </div>
                    <CommandTable
                        className="flex-1"
                        headers={['Requête', 'Clics', 'Impressions', 'CTR', 'Pos.']}
                        rows={(gscQueries || []).slice(0, 50).map((row) => [
                            <span className="text-[13px] font-bold text-white/90 truncate max-w-[250px] inline-block italic">"{row.query}"</span>,
                            <span className="text-[12px] font-bold tabular-nums text-white/80">{formatNumber(row.clicks)}</span>,
                            <span className="text-[12px] text-white/40 tabular-nums">{formatNumber(row.impressions)}</span>,
                            <span className="text-[12px] text-emerald-400/80 tabular-nums">{formatCtr(row.ctr)}</span>,
                            <span className="text-[12px] text-white/20 tabular-nums">{formatPosition(row.position)}</span>
                        ])}
                    />
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden pb-10">
                    <div className={cn(COMMAND_PANEL, "flex-1 flex flex-col p-0 overflow-hidden")}>
                        <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01]">
                            <div className="flex items-center gap-2">
                                <GlobeIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Landing Pages (GA4)</h3>
                            </div>
                        </div>
                        <CommandTable
                            className="flex-1"
                            headers={['Page', 'Sessions']}
                            rows={(topPages || []).slice(0, 20).map((row) => [
                                <span className="text-[11px] font-mono text-white/30 truncate max-w-[200px] inline-block">{row.landing_page}</span>,
                                <span className="text-[12px] font-bold tabular-nums text-white/80">{formatNumber(row.sessions)}</span>
                            ])}
                        />
                    </div>

                    <div className={cn(COMMAND_PANEL, "p-6")}>
                        <div className="flex items-center gap-2 mb-6">
                            <ActivityIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Signal Audit</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-[11px] font-bold text-white/60">
                                <span>Utilisateurs uniques</span>
                                <span className="tabular-nums">{formatNumber(kpis.users)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-white/60">
                                <span>Pages vues totales</span>
                                <span className="tabular-nums">{formatNumber(kpis.pageViews)}</span>
                            </div>
                            <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/5">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">Note Opérateur</div>
                                <p className="text-[11px] text-white/40 leading-relaxed italic">"Le trafic est stable. La corrélation entre les mentions GEO et les clics GSC est en cours d'analyse."</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
