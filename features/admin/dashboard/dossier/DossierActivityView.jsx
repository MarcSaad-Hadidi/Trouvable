'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Crosshair, LayoutList, PanelRight } from 'lucide-react';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import {
    DossierEmptyState,
    DossierErrorState,
    DossierLoadingState,
    DossierQuickLinkCard,
    formatDateTime,
    stagger,
} from './DossierViewShared';
import { CommandHeader, CommandPageShell, COMMAND_BUTTONS, cn } from '@/features/admin/dashboard/shared/components/command';

export default function DossierActivityView() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('dossier-activity');
    const base = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const [focusId, setFocusId] = useState(null);

    const items = Array.isArray(data?.items) ? data.items : [];
    const focused = useMemo(() => items.find((i) => i.id === focusId) || items[0] || null, [items, focusId]);

    if (loading) return <DossierLoadingState label="Chargement de l’activité du dossier…" />;
    if (error) return <DossierErrorState message={error} />;
    if (!data) {
        return (
            <div className="p-5 md:p-7 max-w-[1600px] mx-auto">
                <DossierEmptyState
                    title="Activité indisponible"
                    description="Le journal transverse du dossier n'a pas pu être constitué à partir des sources disponibles."
                />
            </div>
        );
    }

    const quickLinks = [...(data?.quickLinks?.shared || []), ...(data?.quickLinks?.geo || [])];

    const header = (
        <CommandHeader
            eyebrow="console.mission.log"
            title="Centre de lecture événements"
            subtitle="Triptyque : filtres et métriques à gauche, fil principal au centre, inspection sémantique à droite — sans chronologie latérale classique."
            actions={(
                <>
                    <Link href={`${base}/dossier`} className={COMMAND_BUTTONS.secondary}>Dossier</Link>
                    <Link href={`${base}/geo/continuous`} className={cn(COMMAND_BUTTONS.primary, 'gap-2')}>
                        <Activity className="h-4 w-4" />
                        Suivi continu
                    </Link>
                </>
            )}
        />
    );

    return (
        <CommandPageShell header={header} className="text-white">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="mx-auto grid max-w-[1900px] gap-0 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:min-h-[calc(100vh-200px)]">
                {/* Colonne A — métriques & raccourcis */}
                <aside className="border-b border-white/[0.05] bg-[#060708] p-6 lg:border-b-0 lg:border-r lg:border-white/[0.05]">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30 mb-6">
                        <LayoutList className="h-4 w-4 text-[#7c6aef]" />
                        Statistiques Flux
                    </div>
                    <div className="space-y-3">
                        {Array.isArray(data.summaryCards) && data.summaryCards.length > 0 ? (
                            data.summaryCards.map((item) => (
                                <div key={item.id || item.label} className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 py-4 group hover:bg-white/[0.02] transition-colors">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/20 group-hover:text-white/40 transition-colors">{item.label}</div>
                                    <div className="mt-1 text-2xl font-bold tabular-nums text-white/90">{item.value ?? '—'}</div>
                                    {item.detail ? <div className="mt-1 text-[10px] text-white/20 italic">"{item.detail}"</div> : null}
                                </div>
                            ))
                        ) : (
                            <p className="text-[11px] text-white/35">Pas de synthèse agrégée pour ce flux.</p>
                        )}
                    </div>
                    {quickLinks.length > 0 ? (
                        <div className="mt-6 space-y-2 border-t border-white/[0.06] pt-5">
                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/28">Sauts</div>
                            <div className="flex flex-col gap-2">
                                {quickLinks.slice(0, 5).map((item) => (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2 text-[11px] font-medium text-white/65 hover:border-sky-400/25 hover:text-white"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </aside>

                {/* Colonne B — fil principal type terminal */}
                <main className="min-w-0 border-b border-white/[0.05] lg:border-b-0 bg-[#060708]">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/[0.05] bg-[#060708]/95 px-6 py-4 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/30">
                            <Crosshair className="h-4 w-4 text-emerald-400" />
                            {items.length} Entrées de Registre
                        </div>
                    </div>
                    <div className="max-h-[min(78vh,920px)] overflow-y-auto geo-scrollbar px-2">
                        {items.length > 0 ? (
                            <div className="divide-y divide-white/[0.05]">
                                {items.map((item, index) => {
                                    const active = focused?.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setFocusId(item.id)}
                                            className={`w-full text-left px-6 py-6 transition-all border-b border-white/[0.03] last:border-0 ${
                                                active ? 'bg-emerald-500/[0.03] border-l-2 border-l-emerald-500' : 'hover:bg-white/[0.01]'
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="font-mono text-[10px] text-white/10">{String(index + 1).padStart(3, '0')}</span>
                                                {item.category ? (
                                                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] bg-[#7c6aef]/10 text-[#7c6aef] border border-[#7c6aef]/20">
                                                        {item.category}
                                                    </span>
                                                ) : null}
                                                {item.statusLabel ? (
                                                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] bg-white/5 text-white/40 border border-white/10">
                                                        {item.statusLabel}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="mt-3 text-[15px] font-bold text-white/90">{item.title}</div>
                                            {item.description ? (
                                                <p className="mt-1 text-[12px] leading-relaxed text-white/30 line-clamp-2 italic">"{item.description}"</p>
                                            ) : null}
                                            {item.timestamp ? (
                                                <div className="mt-4 text-[10px] font-mono text-white/10 uppercase tracking-widest">{formatDateTime(item.timestamp)}</div>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6">
                                <DossierEmptyState {...data.emptyState} />
                            </div>
                        )}
                    </div>
                </main>

                {/* Colonne C — inspecteur */}
                <aside className="border-l border-white/[0.05] bg-[#060708] p-6">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30 mb-6">
                        <PanelRight className="h-4 w-4 text-[#7c6aef]" />
                        Inspecteur de Registre
                    </div>
                    <AnimatePresence mode="wait">
                        {focused ? (
                            <motion.div
                                key={focused.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c6aef] mb-4">Payload</div>
                                    <h2 className="text-[18px] font-bold leading-snug text-white/90">{focused.title}</h2>
                                    {focused.description ? (
                                        <p className="mt-4 text-[13px] leading-relaxed text-white/40 italic">"{focused.description}"</p>
                                    ) : null}
                                    {focused.timestamp ? (
                                        <div className="mt-6 rounded-xl border border-white/[0.05] bg-black/40 px-4 py-3 text-[11px] font-mono text-white/20 uppercase tracking-widest">
                                            {formatDateTime(focused.timestamp)}
                                        </div>
                                    ) : null}
                                </div>
                                {focused.href ? (
                                    <Link
                                        href={focused.href}
                                        className={cn(COMMAND_BUTTONS.primary, 'w-full justify-center rounded-xl')}
                                    >
                                        Ouvrir la ressource liée
                                    </Link>
                                ) : null}
                            </motion.div>
                        ) : (
                            <p className="mt-6 text-[12px] text-white/35">
                                Sélectionnez une ligne du fil pour afficher le détail ici.
                            </p>
                        )}
                    </AnimatePresence>

                    {quickLinks.length > 5 ? (
                        <div className="mt-8 space-y-3 border-t border-white/[0.06] pt-6">
                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/28">Cartes larges</div>
                            <div className="space-y-2">
                                {quickLinks.map((item) => (
                                    <DossierQuickLinkCard key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    ) : null}
                </aside>
        </motion.div>
        </CommandPageShell>
    );
}
