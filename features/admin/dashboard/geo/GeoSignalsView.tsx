// @ts-nocheck
'use client';

import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Orbit, RadioTower, ZapIcon, ActivityIcon, TargetIcon, LayersIcon } from 'lucide-react';
import Link from 'next/link';

import { 
    CommandHeader, 
    CommandMetricCard, 
    CommandPageShell,
    COMMAND_BUTTONS, 
    COMMAND_PANEL, 
    COMMAND_SURFACE, 
    cn 
} from '@/features/admin/dashboard/shared/components/command';
import GeoCitationsView from '@/features/admin/dashboard/geo/GeoCitationsView';
import GeoCompetitorsView from '@/features/admin/dashboard/geo/GeoCompetitorsView';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Main View ── */

export default function GeoSignalsView() {
    const searchParams = useSearchParams();
    const focus = searchParams.get('focus') || '';
    const { client, clientId } = useGeoClient();
    const { data: citationsData, loading: citationsLoading } = useGeoWorkspaceSlice('citations');
    const { data: competitorsData, loading: competitorsLoading } = useGeoWorkspaceSlice('competitors');

    useEffect(() => {
        if (!focus) return;
        const el = document.getElementById(focus === 'competitors' ? 'concurrents' : focus);
        if (el) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [focus]);

    const header = (
        <CommandHeader
            eyebrow="IA / Signaux"
            title="Observatoire des Signaux"
            subtitle="Analyse convergente des citations et de la pression concurrentielle sur les moteurs IA."
        />
    );

    if (citationsLoading || competitorsLoading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Synchronisation des capteurs radar...</div></CommandPageShell>;

    const coverage = citationsData?.summary?.citationCoveragePercent || 0;
    const uniqueHosts = citationsData?.summary?.uniqueSourceHosts || 0;
    const confirmedCompetitors = competitorsData?.summary?.competitorMentions || 0;
    const totalRuns = citationsData?.summary?.totalCompletedRuns || 0;

    if (!citationsData && !competitorsData) {
        return (
            <CommandPageShell header={header}>
                <div className={cn(COMMAND_PANEL, "p-20 text-center")}>
                    <Orbit className="mx-auto mb-4 h-12 w-12 text-white/10" />
                    <h3 className="text-lg font-bold text-white mb-2">Signaux en attente</h3>
                    <p className="text-sm text-white/40 max-w-md mx-auto mb-8">Les indicateurs radar s'activeront dès que les premières exécutions GEO seront disponibles.</p>
                    <Link href={clientId ? `/admin/clients/${clientId}/geo/runs` : '/admin/clients'} className={COMMAND_BUTTONS.primary}>Démarrer un scan</Link>
                </div>
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Couverture Source" value={`${coverage}%`} detail="Présence citations" tone={coverage > 50 ? 'ok' : (coverage > 20 ? 'warning' : 'neutral')} />
                <CommandMetricCard label="Domaines Uniques" value={uniqueHosts} detail="Hôtes distincts" tone="info" />
                <CommandMetricCard label="Concurrents" value={confirmedCompetitors} detail="Mentions actives" tone={confirmedCompetitors > 0 ? 'warning' : 'neutral'} />
                <CommandMetricCard label="Runs Terminés" value={totalRuns} detail="Moteur radar" tone="neutral" />
            </div>

            <div className="flex flex-col gap-8 mt-2">
                <section id="sources" className="scroll-mt-32">
                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a] border-white/[0.08] shadow-[0_0_50px_rgba(255,255,255,0.02)]")}>
                        <GeoCitationsView sharedData={citationsData} />
                    </div>
                </section>
 
                <section id="concurrents" className="scroll-mt-32">
                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a] border-rose-500/20 shadow-[0_0_60px_rgba(244,63,94,0.08)]")}>
                        <GeoCompetitorsView sharedData={competitorsData} />
                    </div>
                </section>
            </div>
        </CommandPageShell>
    );
}
