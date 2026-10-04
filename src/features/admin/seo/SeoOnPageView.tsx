// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ChevronRightIcon, ExternalLinkIcon, FileCodeIcon, GlobeIcon, LinkIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/shared/context/ClientContext';
import CommandEmptyState from '@/features/admin/shared/components/command/CommandEmptyState';
import { CommandHeader, CommandPageShell } from '@/features/admin/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/design/tokens';
import SourceStatusNotice from '@/components/shared/metrics/SourceStatusNotice';

function buildPageModels(blocks) {
    const pages = new Map();
    for (const block of blocks || []) {
        for (const item of block.items || []) {
            const key = item.url || item.label || item.context;
            if (!key) continue;
            const current = pages.get(key) || {
                id: key,
                url: item.url || null,
                label: item.label || item.url || item.context || 'Page',
                score: 100,
                status: 'ok',
                evidenceCount: 0,
                blocks: [],
            };
            current.evidenceCount += 1;
            current.blocks.push({
                blockId: block.id,
                title: block.title,
                status: block.status,
                reliability: block.reliability,
                summary: block.summary,
                detail: block.detail,
                suggestion: block.suggestion,
                evidence: item.evidence || item.context || item.url || 'Preuve indisponible.',
            });
            if (block.status === 'critical') {
                current.score -= 30;
                current.status = 'critical';
            } else if (block.status === 'warning') {
                current.score -= 18;
                if (current.status !== 'critical') current.status = 'warning';
            } else {
                current.score -= 6;
            }
            pages.set(key, current);
        }
    }

    return Array.from(pages.values()).map((page) => ({
        ...page,
        score: Math.max(15, Math.min(100, page.score)),
        sparkline: page.blocks.map((block) => block.status === 'critical' ? 25 : block.status === 'warning' ? 55 : 85),
    })).sort((a, b) => a.score - b.score || b.evidenceCount - a.evidenceCount);
}

function statusClass(status) {
    if (status === 'critical') return 'text-rose-400 border-rose-400/20';
    if (status === 'warning') return 'text-amber-400 border-amber-400/20';
    return 'text-emerald-400 border-emerald-400/20';
}

function blockScore(status) {
    if (status === 'critical') return 30;
    if (status === 'warning') return 60;
    return 85;
}

export default function SeoOnPagePage() {
    const { client, clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('seo-on-page');
    const [search, setSearch] = useState('');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const pages = useMemo(() => buildPageModels(data?.blocks || []), [data?.blocks]);
    const filteredPages = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return pages;
        return pages.filter((page) => String(page.label || page.url || '').toLowerCase().includes(needle));
    }, [pages, search]);
    const [selectedPageId, setSelectedPageId] = useState(null);

    const selectedPage = useMemo(() => {
        const current = filteredPages.find((page) => page.id === selectedPageId);
        return current || filteredPages[0] || null;
    }, [filteredPages, selectedPageId]);

    if (loading) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Optimisation on-page" subtitle="Chargement de l’inspecteur page par page." />}>
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/90">Chargement de l’inspecteur on-page</div>
                    <p className="mt-2 text-[13px] text-white/55">Le panneau attend les blocs éditoriaux réellement observés dans l’audit.</p>
                </div>
            </CommandPageShell>
        );
    }

    if (error) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Optimisation on-page" subtitle="Analyse éditoriale par page." />}>
                <CommandEmptyState title="Analyse on-page indisponible" description={error} action={<Link href={`${baseHref}/seo/health`} className={COMMAND_BUTTONS.primary}>Santé SEO</Link>} />
            </CommandPageShell>
        );
    }

    if (!data || data.emptyState || pages.length === 0) {
        return (
            <CommandPageShell
                header={<CommandHeader eyebrow="SEO Ops" title="Optimisation on-page" subtitle={`Inspecteur éditorial pour ${client?.client_name || 'ce mandat'}.`} actions={<Link href={`${baseHref}/seo/opportunities`} className={COMMAND_BUTTONS.primary}>Opportunités SEO</Link>} />}
            >
                <SourceStatusNotice status={data?.status} errors={data?.errors} />
                <CommandEmptyState title={data?.emptyState?.title || 'Aucune page inspectable'} description={data?.emptyState?.description || 'Le dernier audit ne fournit pas encore de blocs on-page exploitables par page.'} />
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell
            header={
                <CommandHeader
                    eyebrow="SEO Ops"
                    title="Inspecteur On-Page"
                    subtitle={`Analyse granulaire, page par page, à partir des vrais blocs détectés dans le dossier ${client?.client_name || ''}.`}
                    actions={
                        <>
                            <Link href={`${baseHref}/seo/visibility`} className={COMMAND_BUTTONS.secondary}>Visibilité SEO</Link>
                            <Link href={`${baseHref}/seo/opportunities`} className={COMMAND_BUTTONS.primary}>Opportunités SEO</Link>
                        </>
                    }
                />
            }
        >
                <SourceStatusNotice status={data?.status} errors={data?.errors} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {(data.summaryCards || []).map((card) => (
                    <div key={card.id} className={cn(COMMAND_PANEL, 'p-4')}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4]">{card.label}</div>
                        <div className="mt-4 text-[28px] font-semibold tracking-[-0.05em] text-white">{card.value}</div>
                        <div className="mt-3 text-[11px] leading-relaxed text-white/[0.6]">{card.detail}</div>
                    </div>
                ))}
            </div>

            <div className="flex h-[calc(100vh-180px)] min-h-[600px] gap-4 mt-4">
                <div className={cn(COMMAND_PANEL, 'w-[35%] flex flex-col overflow-hidden p-0')}>
                    <div className="p-4 border-b border-white/[0.05] bg-white/[0.02]">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                placeholder="Rechercher une URL..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                        <div className="flex items-center justify-between mt-3 px-1 text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                            <span>{filteredPages.length} pages analysées</span>
                            <span>Score</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-white/[0.02]">
                        {filteredPages.map((page) => (
                            <button
                                key={page.id}
                                type="button"
                                onClick={() => setSelectedPageId(page.id)}
                                className={cn(
                                    'w-full p-3 flex items-center justify-between text-left transition-colors group',
                                    selectedPage?.id === page.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]',
                                )}
                            >
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <GlobeIcon className={cn('w-3.5 h-3.5 shrink-0', page.status === 'critical' ? 'text-rose-400' : page.status === 'warning' ? 'text-amber-400' : 'text-emerald-400')} />
                                        <span className={cn('text-[12px] font-mono truncate transition-colors', selectedPage?.id === page.id ? 'text-white' : 'text-white/70 group-hover:text-white/90')}>
                                            {page.url || page.label}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-white/30 pl-5.5">{page.evidenceCount} preuve(s) · {page.blocks.length} bloc(s)</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="w-12 h-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={page.sparkline.map((value, index) => ({ value, index }))}>
                                                <Area type="monotone" dataKey="value" stroke={page.status === 'critical' ? '#f87171' : page.status === 'warning' ? '#fbbf24' : '#34d399'} fill="none" strokeWidth={1.5} isAnimationActive={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className={cn('w-8 h-8 rounded bg-white/5 border flex items-center justify-center text-[11px] font-bold tabular-nums', statusClass(page.status))}>{page.score}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className={cn(COMMAND_PANEL, 'w-[65%] flex flex-col overflow-hidden p-0')}>
                    {selectedPage ? (
                        <>
                            <div className="p-6 border-b border-white/[0.05] bg-gradient-to-b from-white/[0.03] to-transparent">
                                <div className="flex items-start justify-between gap-4 mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 text-[11px] text-white/40 mb-2">
                                            <span>Audit actif</span>
                                            <ChevronRightIcon className="w-3 h-3" />
                                            <span className="truncate max-w-[200px]">{data.auditMeta?.sourceUrl || 'source indisponible'}</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            {selectedPage.url || selectedPage.label}
                                            {selectedPage.url ? (
                                                <a href={selectedPage.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors">
                                                    <ExternalLinkIcon className="w-4 h-4" />
                                                </a>
                                            ) : null}
                                        </h2>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Score page</span>
                                        <span className="text-3xl font-bold tabular-nums tracking-tight text-white">{selectedPage.score}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-black/40 rounded-xl p-3 border border-white/[0.05]">
                                        <div className="text-[10px] text-white/40 mb-1">Blocs touchés</div>
                                        <div className="text-[14px] font-semibold tabular-nums text-white/90">{selectedPage.blocks.length}</div>
                                    </div>
                                    <div className="bg-black/40 rounded-xl p-3 border border-white/[0.05]">
                                        <div className="text-[10px] text-white/40 mb-1">Preuves</div>
                                        <div className="text-[14px] font-semibold tabular-nums text-white/90">{selectedPage.evidenceCount}</div>
                                    </div>
                                    <div className="bg-black/40 rounded-xl p-3 border border-white/[0.05]">
                                        <div className="text-[10px] text-white/40 mb-1">Audit</div>
                                        <div className="text-[14px] font-semibold tabular-nums text-white/90">{data.auditMeta?.siteTypeLabel || 'n.d.'}</div>
                                    </div>
                                    <div className="bg-black/40 rounded-xl p-3 border border-white/[0.05]">
                                        <div className="text-[10px] text-white/40 mb-1">Statut</div>
                                        <div className={cn('text-[14px] font-semibold flex items-center gap-1', selectedPage.status === 'critical' ? 'text-rose-400' : selectedPage.status === 'warning' ? 'text-amber-400' : 'text-emerald-400')}>{selectedPage.status}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
                                <h3 className="text-[12px] font-semibold uppercase tracking-widest text-white/40 mb-4">Rubriques d’analyse</h3>
                                <div className="space-y-4 mb-8">
                                    {selectedPage.blocks.map((block) => (
                                        <div key={`${selectedPage.id}-${block.blockId}`} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', block.status === 'critical' ? 'bg-rose-400/10 text-rose-400' : block.status === 'warning' ? 'bg-amber-400/10 text-amber-400' : 'bg-emerald-400/10 text-emerald-400')}>
                                                    {block.status === 'critical' ? <LinkIcon className="w-4 h-4" /> : <FileCodeIcon className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1 gap-2">
                                                        <h4 className="text-[13px] font-semibold text-white/90">{block.title}</h4>
                                                        <span className={cn('text-[12px] font-bold tabular-nums', block.status === 'critical' ? 'text-rose-400' : block.status === 'warning' ? 'text-amber-400' : 'text-emerald-400')}>{blockScore(block.status)}/100</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden mb-3">
                                                        <div className={cn('h-full rounded-full', block.status === 'critical' ? 'bg-rose-400' : block.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${blockScore(block.status)}%` }} />
                                                    </div>
                                                    <p className="text-[12px] text-white/60 leading-relaxed">{block.summary || block.detail || 'Aucune synthèse disponible.'}</p>
                                                    <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/30 p-3 text-[11px] text-white/72">{block.evidence}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
                                    <div className="px-4 py-2 border-b border-indigo-500/20 flex items-center justify-between bg-indigo-500/10">
                                        <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-widest">Suggestion opérateur</span>
                                        <Link href={`${baseHref}/seo/opportunities`} className="text-[10px] font-medium text-white/70 hover:text-white bg-black/40 px-2 py-1 rounded transition-colors">Ouvrir backlog</Link>
                                    </div>
                                    <div className="p-4 bg-black/40 overflow-x-auto text-[12px] leading-relaxed text-white/72">
                                        {selectedPage.blocks.find((block) => block.suggestion)?.suggestion || 'Aucune suggestion éditoriale détaillée n’est encore disponible pour cette page.'}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-8"><CommandEmptyState title="Aucune page sélectionnée" description="Aucune page on-page n’a été trouvée pour ce dossier." /></div>
                    )}
                </div>
            </div>
        </CommandPageShell>
    );
}
