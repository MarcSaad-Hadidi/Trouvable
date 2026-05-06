// @ts-nocheck
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PlusIcon, StarIcon } from 'lucide-react';

import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/tokens';
import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function formatRole(item) {
    return item?.role || item?.label || 'Rôle';
}

function inferFunnelStage(entry) {
    const haystack = normalizeText(`${entry?.role || ''} ${entry?.detail || ''} ${entry?.label || ''} ${entry?.url || ''}`);

    if (/(devis|tarif|prix|demo|essai|contact|services?|solution|comparatif|logiciel)/.test(haystack)) return 'bofu';
    if (/(faq|blog|guide|article|conseil|ressource|support confiance|a propos|about|reponse)/.test(haystack)) return 'tofu';
    return 'mofu';
}

function buildMatrixRows(clusters, pageRoles, coverage) {
    const roleByUrl = new Map(
        (pageRoles || [])
            .filter((item) => item?.url)
            .map((item) => [String(item.url).toLowerCase(), item]),
    );

    const roleByLabel = new Map(
        (pageRoles || [])
            .filter((item) => item?.label)
            .map((item) => [String(item.label).toLowerCase(), item]),
    );

    const rowsFromClusters = (clusters || []).slice(0, 5).map((cluster) => {
        const members = [cluster?.hubPage, ...(cluster?.supportPages || [])]
            .filter(Boolean)
            .map((item) => roleByUrl.get(String(item?.url || '').toLowerCase()) || roleByLabel.get(String(item?.label || '').toLowerCase()) || item)
            .filter(Boolean);

        const stageCounts = { tofu: 0, mofu: 0, bofu: 0 };
        members.forEach((item) => {
            stageCounts[inferFunnelStage(item)] += 1;
        });

        return {
            label: cluster?.label || 'Cluster',
            tofu: stageCounts.tofu,
            mofu: stageCounts.mofu,
            bofu: stageCounts.bofu,
        };
    }).filter((row) => row.label);

    if (rowsFromClusters.length > 0) return rowsFromClusters;

    return (coverage?.roleSummary || []).slice(0, 5).map((item, index) => ({
        label: item?.label || `Groupe ${index + 1}`,
        tofu: index === 0 ? Number(item?.value || 0) : 0,
        mofu: index === 1 ? Number(item?.value || 0) : 0,
        bofu: index >= 2 ? Number(item?.value || 0) : 0,
    }));
}

function buildClusterLookup(clusters, pageRoles) {
    const lookup = new Map();
    const roleByUrl = new Map((pageRoles || []).filter((item) => item?.url).map((item) => [String(item.url).toLowerCase(), item]));

    (clusters || []).forEach((cluster) => {
        [cluster?.hubPage, ...(cluster?.supportPages || [])].filter(Boolean).forEach((page) => {
            const key = String(page?.url || '').toLowerCase();
            if (!key) return;
            const roleEntry = roleByUrl.get(key) || page;
            lookup.set(key, {
                label: cluster?.label || 'Cluster',
                stage: inferFunnelStage(roleEntry).toUpperCase(),
            });
        });
    });

    return lookup;
}

function buildCalendar(referenceDate) {
    const date = new Date(referenceDate);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    const weeks = [];
    const cursor = new Date(gridStart);
    for (let weekIndex = 0; weekIndex < 5; weekIndex += 1) {
        const week = [];
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            week.push({
                date: new Date(cursor),
                isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
                isToday: cursor.toDateString() === new Date().toDateString(),
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    return {
        label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(monthStart),
        weeks,
    };
}

export default function SeoContentPage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useSeoWorkspaceSlice('content');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const clusters = data?.clusters || [];
    const pageRoles = data?.pageRoles || [];
    const contentDecay = data?.contentDecay?.items || [];
    const refreshItems = data?.refreshOpportunities?.items || [];
    const missingItems = data?.missingPages?.items || [];
    const mergeItems = data?.mergeOpportunities?.items || [];
    const summaryCards = (data?.summaryCards || []).map((card) => (
        card.id === 'priority_count'
            ? { ...card, label: 'Signaux éditoriaux' }
            : card
    ));

    const matrixRows = useMemo(
        () => buildMatrixRows(clusters, pageRoles, data?.coverage),
        [clusters, pageRoles, data?.coverage],
    );

    const clusterLookup = useMemo(
        () => buildClusterLookup(clusters, pageRoles),
        [clusters, pageRoles],
    );

    const referenceDate = data?.auditMeta?.createdAt ? new Date(data.auditMeta.createdAt) : new Date();
    const calendar = useMemo(() => buildCalendar(referenceDate), [data?.auditMeta?.createdAt]);
    const calendarLegend = {
        published: pageRoles.length,
        scheduled: refreshItems.length + contentDecay.length + mergeItems.length,
        draft: missingItems.length,
    };

    if (loading) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Matrice de Contenu" subtitle="Chargement de la matrice éditoriale et des signaux de couverture." />}>
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/90">Chargement du contenu SEO</div>
                    <p className="mt-2 text-[13px] text-white/55">Le cockpit attend la couverture éditoriale, les clusters et les signaux de retravail du dossier.</p>
                </div>
            </CommandPageShell>
        );
    }

    if (error) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Matrice de Contenu" subtitle="Planification éditoriale, analyse des gaps sémantiques par étape du tunnel." />}>
                <CommandEmptyState title="Contenu SEO indisponible" description={error} action={<Link href={`${baseHref}/seo/on-page`} className={COMMAND_BUTTONS.primary}>Optimisation on-page</Link>} />
            </CommandPageShell>
        );
    }

    if (!data || data.emptyState) {
        return (
            <CommandPageShell
                header={
                    <CommandHeader
                        eyebrow="SEO Ops"
                        title="Matrice de Contenu"
                        subtitle={`Planification éditoriale, analyse des gaps sémantiques par étape du tunnel pour ${client?.client_name || 'ce mandat'}.`}
                        actions={<Link href={`${baseHref}/seo/opportunities`} className={COMMAND_BUTTONS.primary}>Opportunités SEO</Link>}
                    />
                }
            >
                <CommandEmptyState title={data?.emptyState?.title || 'Aucune lecture éditoriale disponible'} description={data?.emptyState?.description || 'Le dossier ne remonte pas encore de structure contenu exploitable.'} />
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell
            header={
                <CommandHeader
                    eyebrow="SEO Ops"
                    title="Matrice de Contenu"
                    subtitle="Planification éditoriale, analyse des gaps sémantiques par étape du tunnel."
                    actions={<Link href={`${baseHref}/seo/opportunities`} className={COMMAND_BUTTONS.primary}>Opportunités SEO</Link>}
                />
            }
        >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {summaryCards.map((card) => (
                    <CommandMetricCard
                        key={card.id}
                        label={card.label}
                        value={card.value}
                        detail={card.detail}
                        tone={card.status || card.tone || 'neutral'}
                    />
                ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className={cn(COMMAND_PANEL, 'flex h-[480px] flex-col overflow-hidden p-0')}>
                    <div className="border-b border-white/[0.05] bg-white/[0.02] p-5">
                        <h3 className="text-[12px] font-semibold text-white/90">Matrice Sémantique vs Tunnel</h3>
                        <p className="mt-1 text-[11px] text-white/50">Identification des opportunités ("gaps") par cluster thématique.</p>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-auto p-5">
                        {matrixRows.length > 0 ? (
                            <div className="min-w-[500px]">
                                <div className="mb-2 grid grid-cols-4 gap-2">
                                    <div className="col-span-1" />
                                    {[
                                        { id: 'tofu', label: 'Sensibilisation' },
                                        { id: 'mofu', label: 'Considération' },
                                        { id: 'bofu', label: 'Décision' },
                                    ].map((stage) => (
                                        <div key={stage.id} className="text-center">
                                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/60">{stage.id}</div>
                                            <div className="truncate px-1 text-[9px] text-white/30">{stage.label}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    {matrixRows.map((row) => (
                                        <div key={row.label} className="grid grid-cols-4 gap-2">
                                            <div className="col-span-1 flex items-center justify-end pr-3">
                                                <span className="text-right text-[11px] font-medium text-white/80">{row.label}</span>
                                            </div>
                                            {['tofu', 'mofu', 'bofu'].map((stageKey) => {
                                                const count = Number(row?.[stageKey] || 0);
                                                const isEmpty = count === 0;
                                                const isLow = count > 0 && count <= 3;

                                                return (
                                                    <div
                                                        key={`${row.label}-${stageKey}`}
                                                        className={cn(
                                                            'group relative flex h-12 cursor-pointer items-center justify-center rounded-lg border transition-colors',
                                                            isEmpty
                                                                ? 'border-rose-400/20 bg-rose-400/5 hover:bg-rose-400/10'
                                                                : isLow
                                                                    ? 'border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10'
                                                                    : 'border-white/[0.05] bg-white/[0.03] hover:bg-white/[0.08]',
                                                        )}
                                                    >
                                                        {isEmpty ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[14px] font-bold text-rose-400/50 group-hover:hidden">0</span>
                                                                <PlusIcon className="hidden h-4 w-4 text-rose-400 group-hover:block" />
                                                            </div>
                                                        ) : (
                                                            <span className={cn('text-[14px] font-bold tabular-nums', isLow ? 'text-amber-400/80' : 'text-white/70')}>
                                                                {count}
                                                            </span>
                                                        )}

                                                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/80 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
                                                            <span className="text-[9px] font-semibold text-white/90">
                                                                {isEmpty ? 'Aucune page classée' : `${count} page(s) observée(s)`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <CommandEmptyState title="Aucun cluster exploitable" description="Le dossier ne remonte pas encore de clustering éditorial suffisamment propre pour alimenter cette matrice." />
                        )}
                    </div>
                </div>

                <div className={cn(COMMAND_PANEL, 'flex h-[480px] flex-col overflow-hidden p-0')}>
                    <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] p-5">
                        <div>
                            <h3 className="text-[12px] font-semibold text-white/90">Calendrier Éditorial</h3>
                            <p className="mt-1 text-[11px] capitalize text-white/50">{calendar.label}</p>
                        </div>
                        <div className="flex gap-3">
                            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/60"><div className="h-2 w-2 rounded-full bg-emerald-400/50" /> Publié {calendarLegend.published > 0 ? `(${calendarLegend.published})` : ''}</span>
                            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/60"><div className="h-2 w-2 rounded-full bg-sky-400/50" /> Programmé {calendarLegend.scheduled > 0 ? `(${calendarLegend.scheduled})` : ''}</span>
                            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/60"><div className="h-2 w-2 rounded-full bg-amber-400/50" /> Brouillon {calendarLegend.draft > 0 ? `(${calendarLegend.draft})` : ''}</span>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col overflow-hidden p-4">
                        <div className="mb-1 grid grid-cols-7 gap-1">
                            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day) => (
                                <div key={day} className="py-1 text-center text-[9px] font-bold uppercase tracking-widest text-white/30">{day}</div>
                            ))}
                        </div>

                        <div className="grid flex-1 grid-cols-7 grid-rows-5 gap-1">
                            {calendar.weeks.flat().map((day, index) => (
                                <div
                                    key={`${day.date.toISOString()}-${index}`}
                                    className={cn(
                                        'relative flex flex-col overflow-hidden rounded-md border p-1 transition-colors',
                                        day.isToday
                                            ? 'border-indigo-500/50 bg-indigo-500/10'
                                            : day.isCurrentMonth
                                                ? 'border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.04]'
                                                : 'border-white/[0.02] bg-white/[0.005] opacity-60',
                                    )}
                                >
                                    <span className={cn('mb-1 w-full pr-1 text-right text-[9px] font-semibold', day.isToday ? 'text-indigo-300' : day.isCurrentMonth ? 'text-white/30' : 'text-white/15')}>
                                        {day.date.getDate()}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[11px] leading-relaxed text-white/52">
                            Aucune date de publication par page n’est stockée dans le repo actuel. La grille est conservée pour le nouveau UI, mais elle reste volontairement honnête tant qu’un vrai planning éditorial n’existe pas côté backend.
                        </div>
                    </div>
                </div>
            </div>

            <div className={cn(COMMAND_PANEL, 'mt-6 overflow-hidden p-0')}>
                <div className="border-b border-white/[0.05] bg-white/[0.02] p-5">
                    <h3 className="text-[12px] font-semibold text-white/90">Top Contenus Observés</h3>
                </div>
                {pageRoles.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead>
                                <tr className="border-b border-white/[0.05]">
                                    <th className="px-5 py-3 font-medium text-white/40">Article</th>
                                    <th className="px-5 py-3 font-medium text-white/40">Cluster & Tunnel</th>
                                    <th className="px-5 py-3 font-medium text-white/40">Rôle</th>
                                    <th className="px-5 py-3 font-medium text-white/40">Fiabilité</th>
                                    <th className="px-5 py-3 font-medium text-white/40">Détail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02]">
                                {pageRoles.slice(0, 6).map((item, index) => {
                                    const lookup = clusterLookup.get(String(item?.url || '').toLowerCase()) || null;
                                    return (
                                        <tr key={item.id || `${item.label}-${index}`} className="group cursor-pointer transition-colors hover:bg-white/[0.02]">
                                            <td className="px-5 py-3 font-medium text-white/90">
                                                <div className="flex items-center gap-2">
                                                    <StarIcon className={cn('h-3.5 w-3.5', index === 0 ? 'fill-amber-400/20 text-amber-400' : 'text-transparent')} />
                                                    {item.url ? (
                                                        <a href={item.url} target="_blank" rel="noreferrer" className="max-w-[280px] truncate text-white/90 hover:text-white">
                                                            {item.label || item.url}
                                                        </a>
                                                    ) : (
                                                        <span>{item.label}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/60">{lookup?.label || 'Hors cluster'}</span>
                                                    <span className="text-[10px] text-white/20">•</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">{lookup?.stage || inferFunnelStage(item).toUpperCase()}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-white/72">{formatRole(item)}</td>
                                            <td className="px-5 py-3"><ReliabilityPill value={item.reliability || 'unavailable'} /></td>
                                            <td className="px-5 py-3 text-white/55">{item.detail || item.evidence || 'Aucun détail.'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-5">
                        <CommandEmptyState title="Aucun contenu détaillé" description="Le dossier ne remonte pas encore de pages suffisamment structurées pour alimenter cette table." />
                    </div>
                )}
            </div>
        </CommandPageShell>
    );
}

