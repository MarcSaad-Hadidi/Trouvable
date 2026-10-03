'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Cable, ChevronRight, Server } from 'lucide-react';

import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import {
    DossierEmptyState,
    DossierErrorState,
    DossierLoadingState,
    DossierQuickLinkCard,
    connectorStatusLabel,
    connectorStatusTone,
    formatDateTime,
    fadeUp,
    stagger,
} from './DossierViewShared';
import { CommandHeader, CommandPageShell, COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/features/admin/shared/components/command';

function RackUnit({ item, expanded, onToggle }) {
    const tone = connectorStatusTone(item?.status);
    return (
        <div className={cn('overflow-hidden', COMMAND_PANEL)}>
            <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-6"
            >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/40">
                    <Server className="h-5 w-5 text-white/35" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-white/95">{item.label}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${tone}`}>
                            {connectorStatusLabel(item?.status)}
                        </span>
                    </div>
                    {item.description ? (
                        <p className="mt-1 text-[12px] text-white/45 line-clamp-1 sm:line-clamp-2">{item.description}</p>
                    ) : null}
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 text-white/25 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {expanded ? (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-white/[0.08] bg-white/[0.02]"
                    >
                        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-start sm:p-6">
                            <div className="space-y-3">
                                {item.detail ? <p className="text-[12px] text-white/40">{item.detail}</p> : null}
                                {item.metrics?.length ? (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {item.metrics.map((m) => (
                                            <div key={m.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                                                <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/35">{m.label}</div>
                                                <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-white/88">{m.value ?? 'n.d.'}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                {item.incidents?.length ? (
                                    <div className="space-y-2">
                                        {item.incidents.slice(0, 3).map((incident) => (
                                            <div key={incident.id} className="rounded-xl border border-red-400/20 bg-red-500/[0.08] px-3 py-2 text-[11px] text-red-100/90">
                                                {incident.label}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex flex-col items-stretch gap-3 sm:items-end">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/30">Fiabilité</span>
                                    <ReliabilityPill value={item?.reliability} />
                                </div>
                                {item.latestRun?.timestamp ? (
                                    <div className="text-right text-[11px] text-white/50">{formatDateTime(item.latestRun.timestamp)}</div>
                                ) : (
                                    <span className="text-[11px] text-white/28">Pas d’observation</span>
                                )}
                                {item.href ? (
                                    <Link href={item.href} className={cn(COMMAND_BUTTONS.secondary, 'justify-center rounded-xl')}>
                                        Ouvrir
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

export default function DossierConnectorsView() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('dossier-connectors');
    const base = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const [openId, setOpenId] = useState(null);

    const quickLinks = useMemo(
        () => [
            ...(data?.quickLinks?.shared || []),
            ...(data?.quickLinks?.seo || []),
            ...(data?.quickLinks?.geo || []),
        ],
        [data],
    );

    if (loading) return <DossierLoadingState label="Chargement des connecteurs du dossier…" />;
    if (error) return <DossierErrorState message={error} />;
    if (!data) {
        return (
            <div className="p-5 md:p-7 max-w-[1600px] mx-auto">
                <DossierEmptyState
                    title="Connecteurs indisponibles"
                    description="L'état transverse des sources du mandat n'a pas pu être chargé."
                />
            </div>
        );
    }

    function toggle(id) {
        setOpenId((cur) => (cur === id ? null : id));
    }

    const summaryCards = Array.isArray(data?.summaryCards) ? data.summaryCards : [];
    const connectorItems = Array.isArray(data?.items) ? data.items : [];

    const header = (
        <CommandHeader
            eyebrow="dossier.connectors.rack"
            title="Rack des connecteurs"
            subtitle="Chaque source est une unité rack extensible : pas de mosaïque ni de colonnes masonry — lecture verticale opérateur, détail en tiroir."
            meta={(
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
                    <Cable className="h-3.5 w-3.5 text-violet-300/80" />
                    Baie technique
                </span>
            )}
            actions={(
                <>
                    <Link href={`${base}/dossier`} className={COMMAND_BUTTONS.secondary}>
                        Dossier
                    </Link>
                    <Link href={`${base}/geo/continuous`} className={cn(COMMAND_BUTTONS.primary, 'gap-2')}>
                        <Cable className="h-4 w-4" />
                        Suivi continu
                    </Link>
                </>
            )}
        />
    );

    return (
        <CommandPageShell header={header} className="text-white">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto max-w-[1100px] space-y-8 pb-8">
                {summaryCards.length > 0 ? (
                    <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-3">
                        {summaryCards.map((card) => (
                            <div key={card.id || card.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
                                <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">{card.label}</div>
                                <div className="mt-2 text-2xl font-bold tabular-nums text-white/92">{card.value ?? 'n.d.'}</div>
                                {card.detail ? <div className="mt-1 text-[11px] text-white/38">{card.detail}</div> : null}
                            </div>
                        ))}
                    </motion.div>
                ) : null}

                <motion.section variants={fadeUp} className="space-y-3">
                    {connectorItems.length > 0 ? (
                        connectorItems.map((item) => (
                            <RackUnit key={item.id} item={item} expanded={openId === item.id} onToggle={toggle} />
                        ))
                    ) : (
                        <DossierEmptyState {...(data?.emptyState || { title: 'Aucun connecteur', description: 'Aucun connecteur dossier disponible pour cette vue.' })} />
                    )}
                </motion.section>

                {quickLinks.length > 0 ? (
                    <motion.div variants={fadeUp} className="space-y-4 border-t border-white/[0.06] pt-10">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/28">Poursuivre ailleurs</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {quickLinks.map((item) => (
                                <DossierQuickLinkCard key={`${item.section}-${item.id}`} item={item} />
                            ))}
                        </div>
                    </motion.div>
                ) : null}
            </motion.div>
        </CommandPageShell>
    );
}
