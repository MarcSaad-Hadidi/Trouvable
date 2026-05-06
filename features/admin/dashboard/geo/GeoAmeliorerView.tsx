// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    CheckCircle2Icon,
    CircleDashedIcon,
    ClockIcon,
    ShieldAlertIcon,
    UserIcon,
    PlusIcon,
    ArrowRightIcon
} from 'lucide-react';

import { CommandHeader, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function formatShortDate(value) {
    if (!value) return null;
    try {
        return new Date(value).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
    } catch { return null; }
}

function priorityChip(priority) {
    if (priority === 'high') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (priority === 'medium') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-white/5 text-white/40 border-white/10';
}

const EASE = [0.16, 1, 0.3, 1];

/* ── Components ── */

function OpportunityCard({ card, columnId, pendingId, onUpdateStatus, index }) {
    const priority = card.priority || card.review_item?.priority || 'info';
    const title = card.title || card.review_item?.title || 'Action';
    const description = card.description || card.rationale || card.review_item?.description || card.review_item?.evidence_summary || 'Aucun détail supplémentaire.';
    const category = card.category || card.review_item?.category || 'GEO';
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.4, ease: EASE }}
            className={cn(
                COMMAND_SURFACE,
                'group flex flex-col p-4 transition-all hover:bg-white/[0.04] relative overflow-hidden',
                columnId === 'done' && 'opacity-60 grayscale-[0.5] hover:opacity-90 hover:grayscale-0'
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <span className={cn('rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border', priorityChip(priority))}>
                    {priority}
                </span>
                <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest">{category}</span>
            </div>

            <h4 className="text-[13px] font-bold leading-snug text-white/90 group-hover:text-white transition-colors mb-2">
                {title}
            </h4>

            <p className="text-[11px] leading-relaxed text-white/40 line-clamp-3 mb-4 italic">
                "{description}"
            </p>

            <div className="flex items-center justify-between border-t border-white/[0.05] pt-3 mt-auto">
                <div className="flex items-center gap-2">
                    {card.owner ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7c6aef]/20 border border-[#7c6aef]/30 text-[9px] font-bold text-[#b8adff]">
                            {card.owner.charAt(0)}
                        </div>
                    ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/5 bg-white/5 text-white/10">
                            <UserIcon className="h-2.5 w-2.5" />
                        </div>
                    )}
                    {card.created_at && (
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{formatShortDate(card.created_at)}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {columnId === 'todo' && (
                        <button
                            onClick={() => onUpdateStatus(card.id, 'in_progress')}
                            disabled={pendingId === card.id}
                            className="p-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-[#7c6aef]/20 hover:border-[#7c6aef]/30 transition-all"
                        >
                            <ArrowRightIcon className="h-3 w-3" />
                        </button>
                    )}
                    {columnId === 'doing' && (
                        <button
                            onClick={() => onUpdateStatus(card.id, 'done')}
                            disabled={pendingId === card.id}
                            className="p-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        >
                            <CheckCircle2Icon className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default function GeoOpportunitiesPage() {
    const { clientId, invalidateWorkspace } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('opportunities');
    const [pendingId, setPendingId] = useState(null);
    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';

    const columns = useMemo(() => ([
        { id: 'todo', title: 'À Faire', icon: CircleDashedIcon, color: 'text-[#7c6aef]', items: data?.byStatus?.open || [] },
        { id: 'doing', title: 'En cours', icon: ClockIcon, color: 'text-amber-400', items: data?.byStatus?.in_progress || [] },
        { id: 'blocked', title: 'Bloqué', icon: ShieldAlertIcon, color: 'text-rose-400', items: data?.byStatus?.dismissed || [] },
        { id: 'done', title: 'Terminé', icon: CheckCircle2Icon, color: 'text-emerald-400', items: data?.byStatus?.done || [] },
    ]), [data]);

    async function updateStatus(id, status) {
        if (!clientId || !id || pendingId) return;
        setPendingId(id);
        try {
            await fetch(`/api/admin/geo/client/${clientId}/opportunities/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            invalidateWorkspace();
        } finally { setPendingId(null); }
    }

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Feuille de Route Action"
            subtitle="Pilotage des optimisations et correctifs issus des analyses GEO. Kanban opérationnel."
            actions={(
                <Link href={`${geoBase}/runs`} className={COMMAND_BUTTONS.primary}>
                    <PlusIcon className="h-4 w-4" /> Nouvelle Analyse
                </Link>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Synchronisation de la file d'action...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="mt-2 flex h-[calc(100vh-280px)] min-h-[600px] gap-4 overflow-x-auto pb-6 geo-scrollbar">
                {columns.map((column) => (
                    <div key={column.id} className="flex w-[320px] shrink-0 flex-col rounded-[24px] border border-white/[0.04] bg-[#06070a] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-white/[0.01]">
                            <div className="flex items-center gap-2.5">
                                <column.icon className={cn('h-4 w-4', column.color)} />
                                <h3 className={cn('text-[12px] font-bold uppercase tracking-[0.14em]', column.color)}>{column.title}</h3>
                            </div>
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/30 border border-white/10">
                                {column.items.length}
                            </span>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-4 geo-scrollbar">
                            {column.items.map((card, index) => (
                                <OpportunityCard 
                                    key={card.id || index}
                                    card={card}
                                    columnId={column.id}
                                    pendingId={pendingId}
                                    onUpdateStatus={updateStatus}
                                    index={index}
                                />
                            ))}
                            {column.items.length === 0 && (
                                <div className="h-32 flex items-center justify-center rounded-[20px] border border-dashed border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/10">
                                    Vide
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </CommandPageShell>
    );
}
