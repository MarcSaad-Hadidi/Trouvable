// @ts-nocheck
'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { SourcesTimelineChart } from '@/features/admin/dashboard/geo/components/GeoRealCharts';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import { LayersIcon, MousePointerClickIcon, SignalHighIcon, ActivityIcon } from 'lucide-react';

/* ── Utilities ── */

function signalStrength(count, max) {
    if (!max || !count) return 'noise';
    const ratio = count / max;
    if (ratio >= 0.5) return 'strong';
    if (ratio >= 0.15) return 'moderate';
    return 'noise';
}

const SIGNAL_COLORS = {
    strong: 'text-emerald-400',
    moderate: 'text-amber-400',
    noise: 'text-white/20',
};

function SignalDot({ strength }) {
    return <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", strength === 'strong' ? 'bg-emerald-500' : (strength === 'moderate' ? 'bg-amber-500' : 'bg-white/10'))} />;
}

/* ── Components ── */

function TopSourcesDomain({ topHosts, maxHostCount }) {
    const [showAll, setShowAll] = useState(false);
    const displayHosts = showAll ? topHosts : (topHosts || []).slice(0, 8);

    if (!topHosts?.length) return null;

    return (
        <div className={cn(COMMAND_SURFACE, "p-5")}>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Domaines Sources</div>
                    <p className="text-[11px] text-white/20 mt-1 uppercase tracking-wider">Provenance des preuves IA</p>
                </div>
                <SignalHighIcon className="h-4 w-4 text-[#7c6aef]/40" />
            </div>
            <div className="space-y-4">
                {displayHosts.map((item, i) => {
                    const strength = signalStrength(item.count, maxHostCount);
                    return (
                        <div key={i} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <SignalDot strength={strength} />
                                    <span className="text-[12px] font-bold text-white/80 truncate group-hover:text-white transition-colors">{item.host}</span>
                                </div>
                                <span className={cn("text-[11px] font-bold tabular-nums", SIGNAL_COLORS[strength])}>{item.count}</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-[#7c6aef]/60 group-hover:bg-[#7c6aef] transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.round((item.count / maxHostCount) * 100))}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            {topHosts.length > 8 && !showAll && (
                <button onClick={() => setShowAll(true)} className="w-full mt-6 py-2 rounded-lg border border-white/5 bg-white/[0.02] text-[9px] font-bold uppercase tracking-widest text-white/20 hover:bg-white/5 hover:text-white/40 transition-all">
                    Afficher les {topHosts.length} domaines
                </button>
            )}
        </div>
    );
}

function PromptCoverageList({ promptCoverage }) {
    if (!promptCoverage?.length) return null;
    const topCount = promptCoverage[0]?.count || 1;

    return (
        <div className={cn(COMMAND_SURFACE, "p-5")}>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Couverture par Prompt</div>
                    <p className="text-[11px] text-white/20 mt-1 uppercase tracking-wider">Efficacité des requêtes</p>
                </div>
                <MousePointerClickIcon className="h-4 w-4 text-[#7c6aef]/40" />
            </div>
            <div className="space-y-3">
                {promptCoverage.map((item, i) => {
                    const strength = signalStrength(item.count, topCount);
                    return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                            <SignalDot strength={strength} />
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-bold text-white/80 leading-snug group-hover:text-white transition-colors line-clamp-2 italic">"{item.query_text}"</div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[8px] font-bold uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded text-white/20">{item.category}</span>
                                    <span className="text-[9px] text-white/10 tabular-nums">Scan {item.last_seen_at ? new Date(item.last_seen_at).toLocaleDateString('fr-FR') : 'n.d.'}</span>
                                </div>
                            </div>
                            <div className={cn("text-[13px] font-bold tabular-nums shrink-0", SIGNAL_COLORS[strength])}>{item.count}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function GeoCitationsView({ sharedData }) {
    const { client, clientId } = useGeoClient();
    const ownSlice = useGeoWorkspaceSlice('citations', { enabled: !sharedData });
    const data = sharedData || ownSlice.data;

    const maxHostCount = useMemo(() => {
        if (!data?.topHosts?.length) return 1;
        return Math.max(...data.topHosts.map((row) => row.count), 1);
    }, [data]);

    if (!data) return null;

    const noCitations = data.summary.totalSourceMentions === 0;
    const hasTimeline = data.timeline?.length >= 2;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c6aef]">
                        <LayersIcon className="h-3 w-3" /> Preuves & Citations
                    </div>
                    <p className="text-[11px] text-white/35 mt-1">Sources détectées pour {client?.client_name || 'ce mandat'}.</p>
                </div>
                <ActivityIcon className="h-4 w-4 text-white/10" />
            </div>

            {noCitations ? (
                <div className={cn(COMMAND_SURFACE, "p-10 text-center")}>
                    <p className="text-[12px] text-white/40 mb-6">Aucune citation observée sur cet échantillon.</p>
                    <Link href={clientId ? `/admin/clients/${clientId}/geo/runs` : '/admin/clients'} className={COMMAND_BUTTONS.primary}>Déclencher un audit</Link>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <TopSourcesDomain topHosts={data.topHosts} maxHostCount={maxHostCount} />
                        <PromptCoverageList promptCoverage={data.promptCoverage} />
                    </div>
                    {hasTimeline && (
                        <div className={cn(COMMAND_SURFACE, "p-5")}>
                            <div className="mb-6 flex items-center gap-2">
                                <ActivityIcon className="h-4 w-4 text-[#7c6aef]" />
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Évolution Temporelle</h3>
                            </div>
                            <SourcesTimelineChart sourceMentionsTimeline={data.timeline} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
