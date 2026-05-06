// @ts-nocheck
'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { COMMAND_SURFACE, cn } from '@/lib/tokens';
import { TargetIcon, UsersIcon, ShieldXIcon } from 'lucide-react';

/* ── Utilities ── */

function threatLevel(count, topCount) {
    if (!topCount || !count) return 'low';
    const ratio = count / topCount;
    if (ratio >= 0.6) return 'high';
    if (ratio >= 0.25) return 'medium';
    return 'low';
}

const THREAT_COLORS = {
    high: 'text-rose-400',
    medium: 'text-amber-400',
    low: 'text-white/20',
};

/* ── Components ── */

function SubstitutionAlert({ count, baseHref }) {
    if (!count || count <= 0) return null;
    return (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 flex items-start gap-4">
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                <ShieldXIcon className="h-4 w-4 text-rose-500" />
            </div>
            <div className="min-w-0">
                <div className="text-[13px] font-bold text-rose-400">Substitution Concurrentielle Détectée</div>
                <p className="text-[11px] text-rose-200/40 mt-1 max-w-lg leading-relaxed italic">
                    Un concurrent est recommandé mais la cible est absente dans {count} run(s). Risque critique de perte de conversion.
                </p>
                <Link href={`${baseHref}/opportunities`} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-400/80 hover:text-rose-300 mt-3 transition-colors uppercase tracking-widest">
                    Voir les Correctifs GEO →
                </Link>
            </div>
        </div>
    );
}

function ConfirmedCompetitorsList({ competitors, topCount }) {
    if (!competitors?.length) return null;
    return (
        <div className={cn(COMMAND_SURFACE, "p-5")}>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Concurrents Confirmés</div>
                    <p className="text-[11px] text-white/20 mt-1 uppercase tracking-wider">Pression concurrentielle directe</p>
                </div>
                <UsersIcon className="h-4 w-4 text-[#7c6aef]/40" />
            </div>
            <div className="space-y-2">
                {competitors.map((item, i) => {
                    const level = threatLevel(item.count, topCount);
                    return (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", level === 'high' ? 'bg-rose-500' : (level === 'medium' ? 'bg-amber-500' : 'bg-white/10'))} />
                            <span className="text-[13px] font-bold text-white/80 flex-1 truncate group-hover:text-white transition-colors">{item.name}</span>
                            <span className={cn("text-[11px] font-bold tabular-nums shrink-0", THREAT_COLORS[level])}>
                                {item.count} mention{item.count > 1 ? 's' : ''}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CompetitorPrompts({ promptsWithCompetitors }) {
    if (!promptsWithCompetitors?.length) return null;
    return (
        <div className={cn(COMMAND_SURFACE, "p-5")}>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Prompts à Risque</div>
                    <p className="text-[11px] text-white/20 mt-1 uppercase tracking-wider">Exposition concurrentielle</p>
                </div>
                <TargetIcon className="h-4 w-4 text-[#7c6aef]/40" />
            </div>
            <div className="space-y-3">
                {promptsWithCompetitors.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                        <div className={cn("mt-1.5 h-1 w-1 rounded-full shrink-0", item.recommended_competitors > 0 ? 'bg-rose-500' : 'bg-amber-500')} />
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-bold text-white/70 leading-snug group-hover:text-white transition-colors line-clamp-2 italic">"{item.query_text}"</div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[8px] font-bold uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded text-white/20">{item.category}</span>
                                {item.recommended_competitors > 0 && (
                                    <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest">Substitution</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function GeoCompetitorsView({ sharedData }) {
    const { client, clientId } = useGeoClient();
    const ownSlice = useGeoWorkspaceSlice('competitors', { enabled: !sharedData });
    const data = sharedData || ownSlice.data;

    const topCount = useMemo(() => {
        if (!data?.topCompetitors?.length) return 1;
        return Math.max(...data.topCompetitors.map((c) => c.count), 1);
    }, [data]);

    if (!data) return null;

    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';

    return (
        <div className="space-y-6">
            <div className="px-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c6aef]">
                    <UsersIcon className="h-3 w-3" /> Pression Concurrentielle
                </div>
                <p className="text-[11px] text-white/35 mt-1">Paysage concurrentiel observé pour {client?.client_name || 'ce mandat'}.</p>
            </div>

            <SubstitutionAlert count={data.summary.runsWithoutTargetButCompetitor} baseHref={geoBase} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ConfirmedCompetitorsList competitors={data.topCompetitors} topCount={topCount} />
                <CompetitorPrompts promptsWithCompetitors={data.promptsWithCompetitors} />
            </div>
        </div>
    );
}
