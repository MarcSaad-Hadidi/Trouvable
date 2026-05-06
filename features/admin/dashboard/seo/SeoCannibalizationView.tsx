// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLinkIcon, GitMergeIcon, GripHorizontalIcon, NetworkIcon, ShieldAlertIcon } from 'lucide-react';

import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/tokens';

const severityOrder = { high: 0, medium: 1, low: 2 };

function formatCompactNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 'n.d.';
    if (numeric >= 1000) return `${(numeric / 1000).toFixed(numeric >= 10000 ? 0 : 1)}k`;
    return numeric.toLocaleString('fr-FR');
}

function formatNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'n.d.';
    return numeric.toLocaleString('fr-FR');
}

function getGroupKeyword(group) {
    const match = String(group?.title || '').match(/«\s*(.+?)\s*»/);
    if (match?.[1]) return match[1];
    return String(group?.title || '')
        .replace(/^Groupe\s+\d+\s+·\s+/i, '')
        .trim() || group?.pages?.[0]?.label || 'Groupe';
}

function heatTone(group) {
    if (!group) return 'none';
    if (group.confidenceTone === 'high') return 'critical';
    if (group.confidenceTone === 'medium') return 'medium';
    return 'low';
}

function HeatmapCell({ severity }) {
    const colors = {
        critical: 'bg-rose-500/80',
        medium: 'bg-amber-500/40',
        low: 'bg-white/5',
        none: 'bg-white/[0.02]',
    };

    return <div className={cn('h-8 w-full cursor-pointer rounded-sm transition-colors hover:ring-1 ring-white/20', colors[severity] || colors.none)} />;
}

function buildMetricCards(groups) {
    const criticalCount = groups.filter((group) => group.confidenceTone === 'high').length;
    const trafficAtRisk = groups.reduce((sum, group) => sum + Number(group?.measured?.sharedClicks || 0), 0);
    const pageCount = new Set(groups.flatMap((group) => (group?.pages || []).map((page) => page?.url || page?.label).filter(Boolean))).size;
    const actionableCount = groups.filter((group) => group?.winner?.page || group?.action?.label).length;

    return [
        {
            id: 'critical',
            label: 'Conflits Critiques',
            value: criticalCount,
            detail: criticalCount > 0 ? 'Perte de position directe potentielle' : 'Aucun conflit critique mesuré',
            tone: criticalCount > 0 ? 'critical' : 'neutral',
        },
        {
            id: 'traffic',
            label: 'Trafic à Risque',
            value: trafficAtRisk > 0 ? formatCompactNumber(trafficAtRisk) : 'n.d.',
            detail: trafficAtRisk > 0 ? 'Clics mensuels observés sur requêtes partagées' : 'Aucune mesure GSC suffisante',
            tone: trafficAtRisk > 0 ? 'warning' : 'neutral',
        },
        {
            id: 'pages',
            label: 'Pages Impliquées',
            value: pageCount,
            detail: pageCount > 0 ? 'Dans des clusters de conflit' : 'Aucune page en conflit visible',
            tone: pageCount > 0 ? 'info' : 'neutral',
        },
        {
            id: 'actionable',
            label: 'Arbitrages Prêts',
            value: actionableCount,
            detail: actionableCount > 0 ? 'Groupes avec recommandation ou page gagnante' : 'Aucun arbitrage encore exploitable',
            tone: actionableCount > 0 ? 'ok' : 'neutral',
        },
    ];
}

function derivePageShare(page, pages) {
    const clicksTotal = pages.reduce((sum, item) => sum + Number(item?.fallbackMetrics?.clicks || 0), 0);
    const impressionsTotal = pages.reduce((sum, item) => sum + Number(item?.fallbackMetrics?.impressions || 0), 0);

    if (clicksTotal > 0) {
        return Math.round((Number(page?.fallbackMetrics?.clicks || 0) / clicksTotal) * 100);
    }

    if (impressionsTotal > 0) {
        return Math.round((Number(page?.fallbackMetrics?.impressions || 0) / impressionsTotal) * 100);
    }

    return null;
}

function buildHeatmapSeverity(rowGroup, columnGroup, rowIndex, colIndex) {
    if (rowIndex === colIndex) return heatTone(rowGroup);
    if (rowGroup?.confidenceTone === 'high' || columnGroup?.confidenceTone === 'high') return 'medium';
    if (rowGroup?.confidenceTone === 'medium' || columnGroup?.confidenceTone === 'medium') return 'low';
    return 'none';
}

function ChevronRightIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

export default function SeoCannibalizationPage() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useSeoWorkspaceSlice('cannibalization');
    const [expandedClusterId, setExpandedClusterId] = useState(null);

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const groups = useMemo(
        () => [...(data?.groups || [])].sort((left, right) => (severityOrder[left.confidenceTone] ?? 9) - (severityOrder[right.confidenceTone] ?? 9)),
        [data?.groups],
    );
    const selectedGroup = groups.find((group) => group.id === expandedClusterId) || groups[0] || null;
    const metricCards = useMemo(() => buildMetricCards(groups), [groups]);

    if (loading) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Graphe de Cannibalisation" subtitle="Chargement des recouvrements et arbitrages réels." />}>
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/90">Chargement de la cannibalisation SEO</div>
                    <p className="mt-2 text-[13px] text-white/55">Le cockpit attend les groupes de recouvrement observés sur le dossier courant.</p>
                </div>
            </CommandPageShell>
        );
    }

    if (error) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Graphe de Cannibalisation" subtitle="Détection des conflits de mots-clés où plusieurs pages de votre site se concurrencent dans les SERPs." />}>
                <CommandEmptyState title="Cannibalisation SEO indisponible" description={error} action={<Link href={`${baseHref}/seo/content`} className={COMMAND_BUTTONS.primary}>Contenu SEO</Link>} />
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell
            header={
                <CommandHeader
                    eyebrow="SEO Ops"
                    title="Graphe de Cannibalisation"
                    subtitle="Détection des conflits de mots-clés où plusieurs pages de votre site se concurrencent dans les SERPs."
                    actions={<Link href={`${baseHref}/seo/actions`} className={COMMAND_BUTTONS.primary}>Lancer une détection</Link>}
                />
            }
        >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {metricCards.map((card) => (
                    <CommandMetricCard key={card.id} label={card.label} value={card.value} detail={card.detail} tone={card.tone} />
                ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-4 lg:col-span-2">
                    <div className="text-[14px] font-semibold text-white/90">Clusters de Conflit</div>

                    {groups.length > 0 ? (
                        <div className="space-y-3">
                            {groups.map((group) => {
                                const isExpanded = expandedClusterId ? expandedClusterId === group.id : selectedGroup?.id === group.id;
                                const trafficRisk = Number(group?.measured?.sharedClicks || 0);

                                return (
                                    <div
                                        key={group.id}
                                        className={cn(
                                            COMMAND_PANEL,
                                            'overflow-hidden p-0 transition-all duration-300',
                                            isExpanded ? 'ring-1 ring-indigo-500/30' : 'hover:bg-white/[0.04]',
                                        )}
                                    >
                                        <div
                                            onClick={() => setExpandedClusterId(isExpanded ? null : group.id)}
                                            className="flex cursor-pointer select-none items-center justify-between bg-white/[0.01] p-4"
                                        >
                                            <div className="flex min-w-0 items-center gap-4">
                                                <div className={cn('h-2 w-2 rounded-full', group.confidenceTone === 'high' ? 'bg-rose-500' : group.confidenceTone === 'medium' ? 'bg-amber-400' : 'bg-white/20')} />
                                                <div className="min-w-0">
                                                    <div className="truncate text-[13px] font-bold text-white/90">"{getGroupKeyword(group)}"</div>
                                                    <div className="mt-0.5 text-[10px] text-white/40">{group.pages.length} URLs en compétition</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="hidden text-right sm:block">
                                                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">Trafic à risque</div>
                                                    <div className="text-[12px] font-mono font-bold text-amber-400">{trafficRisk > 0 ? `${formatNumber(trafficRisk)} clics/mo` : 'n.d.'}</div>
                                                </div>
                                                <ChevronRightIcon className={cn('h-4 w-4 text-white/30 transition-transform duration-300', isExpanded && 'rotate-90')} />
                                            </div>
                                        </div>

                                        {isExpanded ? (
                                            <div className="border-t border-white/[0.05] bg-black/20">
                                                <div className="space-y-4 p-4">
                                                    <div className="space-y-2">
                                                        {group.pages.map((page, index) => {
                                                            const share = derivePageShare(page, group.pages);
                                                            const isLeader = String(page?.url || page?.label || '') === String(group?.winner?.page?.url || group?.winner?.page?.label || '');
                                                            return (
                                                                <div key={`${group.id}-${page.label}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                                                                    <GripHorizontalIcon className="h-4 w-4 shrink-0 text-white/10" />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="mb-1 flex items-center gap-2">
                                                                            <span className="truncate font-mono text-[12px] text-white/80">{page.label || page.url || 'Page concernée'}</span>
                                                                            {isLeader ? <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-emerald-400">Leader</span> : null}
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-3 text-[10px]">
                                                                            <span className="text-white/40">Intention: <span className="text-white/70">{group.conflictTypeLabel || 'À confirmer'}</span></span>
                                                                            <span className="text-white/40">Pos: <span className="font-bold text-white/70">#{page?.fallbackMetrics?.position ? Number(page.fallbackMetrics.position).toFixed(0) : 'n.d.'}</span></span>
                                                                            <span className="text-white/40">Clics: <span className="tabular-nums text-white/70">{formatNumber(page?.fallbackMetrics?.clicks)}</span></span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-24 shrink-0 px-2">
                                                                        <div className="mb-1 flex justify-between text-[9px]">
                                                                            <span className="text-white/40">Part</span>
                                                                            <span className="font-bold text-white">{share === null ? 'n.d.' : `${share}%`}</span>
                                                                        </div>
                                                                        <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                                                                            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${share || 0}%` }} />
                                                                        </div>
                                                                    </div>
                                                                    {page.url ? (
                                                                        <a href={page.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white" title="Voir l'URL">
                                                                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                                                                        </a>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:flex-row sm:items-center">
                                                        <div>
                                                            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-indigo-300">
                                                                <GitMergeIcon className="h-3.5 w-3.5" /> Recommandation opérateur
                                                            </div>
                                                            <p className="max-w-lg text-[12px] leading-relaxed text-white/70">{group?.action?.why || group?.summary || 'Aucun arbitrage recommandé pour le moment.'}</p>
                                                        </div>
                                                        <div className="flex shrink-0 gap-2">
                                                            <button type="button" onClick={() => setExpandedClusterId(null)} className={cn(COMMAND_BUTTONS.secondary, 'border-white/10')}>
                                                                Ignorer
                                                            </button>
                                                            <Link href={`${baseHref}/seo/actions`} className={COMMAND_BUTTONS.primary}>Générer Plan d'action</Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={cn(COMMAND_PANEL, 'p-6')}>
                            <CommandEmptyState
                                title={data?.emptyState?.title || 'Aucun recouvrement net observé'}
                                description={data?.emptyState?.description || 'Le dossier ne montre pas encore de conflit suffisamment fiable pour remplir les clusters de cette vue.'}
                            />
                        </div>
                    )}
                </div>

                <div className="col-span-1 flex flex-col gap-6">
                    <div className={cn(COMMAND_PANEL, 'p-5')}>
                        <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-white/90">
                            <ShieldAlertIcon className="h-4 w-4 text-amber-400" /> Matrice de Sévérité
                        </div>

                        {groups.length > 0 ? (
                            <>
                                <div className="flex">
                                    <div className="mt-4 mr-2 flex w-24 flex-col gap-1">
                                        {groups.slice(0, 5).map((group) => (
                                            <div key={group.id} className="flex h-8 items-center justify-end truncate text-[9px] font-mono text-white/40">{getGroupKeyword(group)}</div>
                                        ))}
                                    </div>

                                    <div className="flex-1">
                                        <div className="mb-2 flex h-4 gap-1">
                                            {groups.slice(0, 5).map((group, index) => (
                                                <div key={`${group.id}-${index}`} className="flex-1 text-center text-[9px] text-white/30">/url-{index + 1}</div>
                                            ))}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {groups.slice(0, 5).map((rowGroup, rowIndex) => (
                                                <div key={`${rowGroup.id}-${rowIndex}`} className="flex gap-1">
                                                    {groups.slice(0, 5).map((columnGroup, colIndex) => (
                                                        <div key={`${rowGroup.id}-${columnGroup.id}`} className="flex-1">
                                                            <HeatmapCell severity={buildHeatmapSeverity(rowGroup, columnGroup, rowIndex, colIndex)} />
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-center gap-3">
                                    <span className="flex items-center gap-1.5 text-[9px] text-white/40"><div className="h-2 w-2 rounded-sm bg-rose-500" /> Critique</span>
                                    <span className="flex items-center gap-1.5 text-[9px] text-white/40"><div className="h-2 w-2 rounded-sm bg-amber-500/50" /> Moyen</span>
                                    <span className="flex items-center gap-1.5 text-[9px] text-white/40"><div className="h-2 w-2 rounded-sm bg-white/5" /> Sain</span>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-[11px] leading-relaxed text-white/50">
                                Aucun groupe confirmé à projeter dans la matrice pour l’instant.
                            </div>
                        )}
                    </div>

                    <div className={cn(COMMAND_PANEL, 'flex min-h-[300px] flex-1 flex-col p-5')}>
                        <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-white/90">
                            <NetworkIcon className="h-4 w-4 text-indigo-400" /> Topologie
                        </div>

                        {selectedGroup ? (
                            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/[0.05] bg-black/20">
                                <div className="pointer-events-none absolute inset-0 opacity-20">
                                    <svg width="100%" height="100%">
                                        <line x1="50%" y1="50%" x2="30%" y2="30%" stroke="white" strokeWidth="1" />
                                        <line x1="50%" y1="50%" x2="70%" y2="30%" stroke="white" strokeWidth="1" />
                                        <line x1="50%" y1="50%" x2="50%" y2="72%" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4" />
                                    </svg>
                                </div>

                                <div className="relative h-full w-full">
                                    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                                        <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400 bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                            <span className="text-xs font-bold text-indigo-200">KW</span>
                                        </div>
                                        <span className="mt-2 rounded border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] text-white/80">{getGroupKeyword(selectedGroup)}</span>
                                    </div>

                                    {(selectedGroup.pages || []).slice(0, 3).map((page, index) => {
                                        const positions = [
                                            'absolute left-[22%] top-[24%] flex flex-col items-center',
                                            'absolute right-[22%] top-[24%] flex flex-col items-center',
                                            'absolute bottom-[22%] left-1/2 flex -translate-x-1/2 flex-col items-center',
                                        ];
                                        const isPrimary = String(page?.url || page?.label || '') === String(selectedGroup?.winner?.page?.url || selectedGroup?.winner?.page?.label || '');
                                        return (
                                            <div key={`${selectedGroup.id}-${page.label}-${index}`} className={positions[index]}>
                                                <div className={cn('z-10 flex items-center justify-center rounded border', isPrimary ? 'h-10 w-10 border-rose-500 bg-rose-500/10' : 'h-8 w-8 border-white/20 bg-white/5')}>
                                                    <span className={cn('text-[10px]', isPrimary ? 'font-bold text-rose-400' : 'text-white/60')}>URL</span>
                                                </div>
                                                <span className={cn('mt-1 text-[8px]', isPrimary ? 'font-bold text-rose-400/80' : 'text-white/40')}>
                                                    {String(page?.label || page?.url || 'page').slice(0, 26)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <CommandEmptyState title="Aucun cluster sélectionné" description="Sélectionnez un cluster pour visualiser ses relations." />
                        )}
                        <p className="mt-3 text-center text-[10px] text-white/40">{selectedGroup ? 'Lecture simplifiée à partir du groupe actuellement ouvert.' : 'Sélectionnez un cluster pour visualiser ses relations.'}</p>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}

