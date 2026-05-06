// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownIcon, ArrowUpIcon, DownloadIcon, FilterIcon, SearchIcon } from 'lucide-react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { CommandHeader, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/tokens';

const TIME_RANGES = ['7d', '30d', '90d', '12m'];
const SEGMENT_LABELS = {
    all: 'tout',
    brand: 'marque',
    nonbrand: 'hors marque',
};

const INTENT_META = {
    Transactionnel: 'border-violet-400/25 bg-violet-400/14 text-violet-200',
    Informationnel: 'border-sky-400/25 bg-sky-400/14 text-sky-200',
    Commercial: 'border-amber-400/25 bg-amber-400/14 text-amber-200',
    Navigationnel: 'border-white/12 bg-white/[0.06] text-white/72',
};

const CHIP_TONES = ['bg-indigo-400', 'bg-violet-400', 'bg-emerald-400', 'bg-amber-400'];
const CHIP_SURFACES = [
    'border-indigo-300/22 bg-indigo-500/10 text-indigo-50',
    'border-violet-300/22 bg-violet-500/10 text-violet-50',
    'border-emerald-300/22 bg-emerald-500/10 text-emerald-50',
    'border-amber-300/22 bg-amber-500/10 text-amber-50',
];

function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n.d.';
    return Number(value).toLocaleString('fr-FR');
}

function formatPosition(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n.d.';
    return Number(value).toFixed(1);
}

function positionTone(position) {
    const pos = Number(position);
    if (!Number.isFinite(pos)) return { label: 'n.d.', className: 'bg-white/[0.06] text-white/45' };
    if (pos <= 3) return { label: 'Top 3', className: 'bg-emerald-400/14 text-emerald-200' };
    if (pos <= 10) return { label: 'Top 10', className: 'bg-sky-400/14 text-sky-200' };
    if (pos <= 20) return { label: 'Top 20', className: 'bg-amber-400/14 text-amber-200' };
    return { label: '20+', className: 'bg-rose-400/14 text-rose-200' };
}

function intentTone(intent) {
    return INTENT_META[intent] || INTENT_META.Navigationnel;
}

function normalizeRange(value) {
    return TIME_RANGES.includes(value) ? value : '30d';
}

function normalizeSegment(value) {
    return value === 'brand' || value === 'nonbrand' ? value : 'all';
}

function nextSegment(value) {
    if (value === 'all') return 'brand';
    if (value === 'brand') return 'nonbrand';
    return 'all';
}

function FilterToggle({ value, onChange }) {
    return (
        <button type="button" onClick={onChange} className={COMMAND_BUTTONS.secondary}>
            <FilterIcon className="h-3.5 w-3.5" />
            Segment
            <span className="text-white/45">| {SEGMENT_LABELS[value] || SEGMENT_LABELS.all}</span>
        </button>
    );
}

export default function SeoVisibilityPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { client, clientId } = useGeoClient();

    const range = normalizeRange(searchParams.get('range'));
    const segment = normalizeSegment(searchParams.get('segment'));
    const searchType = searchParams.get('searchType') || null;
    const country = searchParams.get('country') || null;
    const device = searchParams.get('device') || null;

    const requestParams = useMemo(() => ({
        range,
        segment,
        ...(searchType ? { searchType } : {}),
        ...(country ? { country } : {}),
        ...(device ? { device } : {}),
    }), [country, device, range, searchType, segment]);

    const { data, loading, error } = useSeoWorkspaceSlice('visibility', { params: requestParams });
    const [query, setQuery] = useState('');

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const topQueries = data?.topQueries || [];
    const deviceSplit = data?.deviceSplit || {};
    const intentBreakdown = data?.intentBreakdown || [];
    const movers = data?.movers || { winners: [], losers: [] };
    const freshness = data?.freshness || {};
    const gscSource = data?.gscSource || {};
    const trendLabel = range === '12m' ? '12m' : range;
    const gscFilterSummary = [
        `type ${gscSource?.filters?.searchType || 'web'}`,
        gscSource?.filters?.country ? `pays ${gscSource.filters.country}` : null,
        gscSource?.filters?.device ? `appareil ${gscSource.filters.device}` : null,
        `segment ${SEGMENT_LABELS[gscSource?.filters?.segment] || SEGMENT_LABELS.all}`,
    ].filter(Boolean).join(' · ');

    function updateSearchParams(nextValues) {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(nextValues || {}).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                params.delete(key);
                return;
            }
            params.set(key, String(value));
        });

        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }

    const chips = useMemo(() => {
        const items = [
            { label: 'Search Console', detail: freshness?.gsc?.status || 'unavailable' },
            { label: 'GA4', detail: freshness?.ga4?.status || 'unavailable' },
            { label: `Fenêtre ${range}`, detail: segment === 'all' ? 'tout' : SEGMENT_LABELS[segment] },
            { label: `${formatNumber(data?.trackedKeywordCount || topQueries.length)} requêtes`, detail: gscSource?.mode === 'live' ? 'GSC brut' : 'indisponible' },
        ];
        return items;
    }, [data?.trackedKeywordCount, freshness, gscSource?.mode, range, segment, topQueries.length]);

    const filteredQueries = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return topQueries.filter((row) => {
            if (needle && !String(row.query || '').toLowerCase().includes(needle)) return false;
            return true;
        });
    }, [query, topQueries]);

    const deviceDonutData = Array.isArray(deviceSplit?.categories) ? deviceSplit.categories : [];
    const deviceSplitAvailable = deviceSplit?.status === 'available' && deviceDonutData.length > 0;
    const hasIntentData = intentBreakdown.some((item) => Number(item.count || 0) > 0);

    function cycleFilter() {
        updateSearchParams({ segment: nextSegment(segment) });
    }

    function changeRange(nextRange) {
        updateSearchParams({ range: nextRange });
    }

    function exportCsv() {
        if (!filteredQueries.length) return;
        const rows = [
            ['Requête', 'Position', 'Delta', 'Intent', 'Clics', 'Impressions', 'CTR'],
            ...filteredQueries.map((row) => [
                row.query,
                formatPosition(row.position),
                row.positionDelta ?? '',
                row.intent || '',
                row.clicks ?? '',
                row.impressions ?? '',
                row.ctr ?? '',
            ]),
        ];
        const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `seo-visibility-${clientId || 'client'}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    if (loading) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Visibilité SEO" subtitle="Chargement des métriques organiques, des requêtes et des supports de mesure." />}>
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/90">Chargement de la visibilité SEO</div>
                    <p className="mt-2 text-[13px] text-white/55">Le cockpit attend les données Search Console et GA4 du dossier courant.</p>
                </div>
            </CommandPageShell>
        );
    }

    if (error) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Visibilité SEO" subtitle="Salle de marche organique du dossier courant." />}>
                <CommandEmptyState title="Visibilité SEO indisponible" description={error} action={<Link href={`${baseHref}/seo/health`} className={COMMAND_BUTTONS.primary}>Voir la santé SEO</Link>} />
            </CommandPageShell>
        );
    }

    if (!data || data.emptyState) {
        return (
            <CommandPageShell
                header={(
                    <CommandHeader
                        eyebrow="SEO Ops"
                        title="Visibilité SEO"
                        subtitle={`Salle de marche organique pour ${client?.client_name || 'ce dossier'}, sans concurrent ni mot-clé inventé.`}
                        actions={<Link href={`${baseHref}/dossier/connectors`} className={COMMAND_BUTTONS.primary}>Connecteurs</Link>}
                    />
                )}
            >
                <CommandEmptyState title={data?.emptyState?.title || 'Visibilité SEO indisponible'} description={data?.emptyState?.description || 'Aucune donnée organique exploitable n a été trouvée pour cette période.'} />
            </CommandPageShell>
        );
    }

    return (
        <CommandPageShell
            header={(
                <CommandHeader
                    title="Visibilité SEO"
                    subtitle="Salle de marche organique. Même propriété GSC, même période, mêmes filtres, mêmes chiffres."
                    actions={(
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-full border border-white/[0.10] bg-white/[0.04] p-1">
                                {TIME_RANGES.map((rangeId) => (
                                    <button
                                        key={rangeId}
                                        type="button"
                                        onClick={() => changeRange(rangeId)}
                                        className={cn(
                                            'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                                            rangeId === range ? 'bg-white/[0.10] text-white' : 'text-white/45 hover:text-white/80',
                                        )}
                                    >
                                        {rangeId}
                                    </button>
                                ))}
                            </div>
                            <FilterToggle value={segment} onChange={cycleFilter} />
                            <button type="button" onClick={exportCsv} className={COMMAND_BUTTONS.primary}>
                                <DownloadIcon className="h-3.5 w-3.5" />
                                Exporter
                            </button>
                        </div>
                    )}
                />
            )}
        >
            {gscSource?.mode !== 'live' && (
                <div className="rounded-[18px] border border-amber-300/25 bg-amber-400/[0.08] px-4 py-3 text-[12px] text-amber-100/90">
                    Données Search Console brutes indisponibles pour cette vue. {gscSource?.reason || 'Aucune raison détaillée fournie.'}
                </div>
            )}
            {gscSource?.property && (
                <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[11px] text-white/60">
                    Propriété GSC: <span className="text-white/86">{gscSource.property}</span>
                    {' '}· Période: <span className="text-white/86">{gscSource?.period?.currentStartDate || 'n.d.'} → {gscSource?.period?.endDate || 'n.d.'}</span>
                    {' '}· Filtres: <span className="text-white/86">{gscFilterSummary}</span>
                </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {chips.map((chip, index) => (
                    <div key={chip.label} className={cn('flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 transition-colors hover:brightness-110', CHIP_SURFACES[index % CHIP_SURFACES.length])}>
                        <div className={cn('h-2 w-2 rounded-full', CHIP_TONES[index % CHIP_TONES.length])} />
                        <span className="text-[12px] font-medium text-white/88">{chip.label}</span>
                        <span className="text-[11px] text-white/56">{chip.detail}</span>
                    </div>
                ))}
            </div>

            <div className="grid min-h-[620px] grid-cols-1 gap-4 lg:grid-cols-3">
                <div className={cn(COMMAND_PANEL, 'col-span-1 flex flex-col overflow-hidden lg:col-span-2')}>
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[linear-gradient(180deg,rgba(25,33,46,0.98)_0%,rgba(17,21,30,0.94)_100%)] p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="relative">
                                <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Rechercher un mot-clé..."
                                    className="w-64 rounded-full border border-white/[0.12] bg-[linear-gradient(180deg,rgba(18,24,34,0.98)_0%,rgba(15,19,28,0.96)_100%)] pl-8 pr-4 py-1.5 text-[12px] text-white outline-none transition-all placeholder:text-white/32 focus:border-indigo-400/45"
                                />
                            </div>
                            <span className="text-[11px] text-white/42">{filteredQueries.length} mots-clés suivis</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead className="sticky top-0 z-10 bg-[#0c0f15]/96 backdrop-blur">
                                <tr className="border-b border-white/[0.08]">
                                    <th className="px-4 py-3 font-medium text-white/42">Mot-clé</th>
                                    <th className="w-28 px-4 py-3 font-medium text-white/42">Position</th>
                                    <th className="w-36 px-4 py-3 font-medium text-white/42">Intention</th>
                                    <th className="w-28 px-4 py-3 text-right font-medium text-white/42">Impressions</th>
                                    <th className="w-36 px-4 py-3 font-medium text-white/42">Tendance ({trendLabel})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {filteredQueries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-white/52">
                                            {topQueries.length === 0
                                                ? (gscSource?.mode !== 'live'
                                                    ? (gscSource?.reason || 'Données GSC indisponibles pour cette période.')
                                                    : 'Aucune donnée de suivi réelle disponible pour ce mandat.')
                                                : 'Aucun mot-clé ne correspond au filtre actuel.'}
                                        </td>
                                    </tr>
                                ) : filteredQueries.map((row) => {
                                    const posTone = positionTone(row.position);
                                    const posDelta = Number(row.positionDelta);
                                    const hasDelta = Number.isFinite(posDelta) && posDelta !== 0;
                                    const sparkline = row.sparkline || [];
                                    const sparklineMax = Math.max(...sparkline.slice(-12).map((item) => Number(item.value || 0)), 1);
                                    return (
                                        <tr key={row.query} className="group cursor-pointer transition-colors hover:bg-white/[0.03]">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white/92">{row.query}</span>
                                                    <div className="flex gap-1">
                                                        {Array.from({ length: Math.max(1, Math.min(4, Math.round((Number(row.clicks || 0) + Number(row.impressions || 0)) / 250))) }).map((_, index) => (
                                                            <span key={`${row.query}-${index}`} className="h-1.5 w-1.5 rounded-full bg-white/20" />
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 tabular-nums">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white">{formatPosition(row.position)}</span>
                                                    {hasDelta ? (
                                                        <span className={cn('flex items-center rounded px-1.5 py-0.5 text-[10px]', posDelta > 0 ? 'bg-emerald-400/12 text-emerald-300' : 'bg-rose-400/12 text-rose-300')}>
                                                            {posDelta > 0 ? <ArrowUpIcon className="mr-0.5 h-2.5 w-2.5" /> : <ArrowDownIcon className="mr-0.5 h-2.5 w-2.5" />}
                                                            {Math.abs(posDelta)}
                                                        </span>
                                                    ) : (
                                                        <span className={cn('rounded px-1.5 py-0.5 text-[10px]', posTone.className)}>{posTone.label}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', intentTone(row.intent))}>{row.intent}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-white/74">{formatNumber(row.impressions)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex h-7 w-24 items-end gap-0.5">
                                                    {sparkline.slice(-12).map((point, index) => (
                                                        <div
                                                            key={`${row.query}-${point.date}-${index}`}
                                                            className="flex-1 rounded-t-[2px] bg-indigo-500/55 transition-colors group-hover:bg-indigo-400"
                                                            style={{ height: `${Math.max(10, (Number(point.value || 0) / sparklineMax) * 100)}%` }}
                                                        />
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-none">
                    <div className={cn(COMMAND_PANEL, 'bg-[linear-gradient(180deg,rgba(25,28,39,0.98)_0%,rgba(19,18,31,0.95)_100%)] p-5')}>
                        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/42">Répartition des recherches par appareil</h3>
                        {!deviceSplitAvailable ? (
                            <div className="rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.03] p-4 text-[12px] text-white/58">
                                <div className="font-medium text-white/76">Répartition par appareil indisponible</div>
                                <div className="mt-1 text-white/52">
                                    {deviceSplit?.detail || deviceSplit?.reason || 'Aucune donnée appareil disponible pour ce mandat.'}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative flex h-44 items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={deviceDonutData} innerRadius={46} outerRadius={72} paddingAngle={2} dataKey="value" stroke="none">
                                                {deviceDonutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value, _name, item) => [`${formatNumber(item?.payload?.count)} impressions (${value}%)`, item?.payload?.name]}
                                                contentStyle={{ backgroundColor: '#0b0d13', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', fontSize: '12px' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-[34px] font-semibold tracking-[-0.05em] text-white">{formatNumber(deviceSplit.totalSearches)}</span>
                                        <span className="text-[11px] text-white/42">Impressions</span>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap justify-center gap-4">
                                    {deviceDonutData.map((entry) => (
                                        <div key={entry.name} className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span className="text-[11px] text-white/62">{entry.name}</span>
                                            <span className="text-[11px] font-semibold text-white/92 tabular-nums">{formatNumber(entry.count)}</span>
                                            <span className="text-[11px] text-white/62 tabular-nums">({entry.value}%)</span>
                                        </div>
                                    ))}
                                </div>
                                {deviceSplit?.detail ? (
                                    <div className="mt-3 text-center text-[10px] text-white/46">
                                        {deviceSplit.detail}
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>

                    <div className={cn(COMMAND_PANEL, 'bg-[linear-gradient(180deg,rgba(24,26,37,0.98)_0%,rgba(17,17,28,0.95)_100%)] p-5')}>
                        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-white/42">Répartition par intention</h3>
                        {hasIntentData ? (
                            <div className="space-y-3">
                                {intentBreakdown.map((item) => (
                                    <div key={item.name}>
                                        <div className="mb-1.5 flex justify-between text-[11px]">
                                            <span className="text-white/70">{item.name}</span>
                                            <span className="font-medium text-white tabular-nums">{item.percent}%</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full',
                                                    item.name === 'Transactionnel'
                                                        ? 'bg-violet-400'
                                                        : item.name === 'Informationnel'
                                                            ? 'bg-sky-400'
                                                            : item.name === 'Commercial'
                                                                ? 'bg-amber-400'
                                                                : 'bg-white/35',
                                                )}
                                                style={{ width: `${Math.max(0, item.percent)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.03] p-4 text-[12px] text-white/58">
                                Aucune donnée d’intention exploitable n’est disponible pour cette période.
                            </div>
                        )}
                    </div>

                    <div className={cn(COMMAND_PANEL, 'flex min-h-[220px] flex-col overflow-hidden p-0')}>
                        <div className="flex border-b border-white/[0.08]">
                            <div className="flex-1 border-r border-white/[0.08] bg-emerald-400/8 p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                                Gagnants
                            </div>
                            <div className="flex-1 bg-rose-400/8 p-3 text-center text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                                Perdants
                            </div>
                        </div>
                        <div className="flex flex-1 divide-x divide-white/[0.08]">
                            <div className="flex-1 space-y-3 p-3">
                                {movers.winners.length > 0 ? movers.winners.map((row) => (
                                    <div key={`winner-${row.query}`} className="flex items-center justify-between gap-2">
                                        <span className="truncate pr-2 text-[11px] text-white/84">{row.query}</span>
                                        <span className="flex shrink-0 items-center text-[10px] font-bold tabular-nums text-emerald-400">
                                            <ArrowUpIcon className="mr-0.5 h-2.5 w-2.5" />{Math.abs(Number(row.positionDelta || 0))}
                                        </span>
                                    </div>
                                )) : <div className="text-[11px] text-white/45">Aucune hausse nette.</div>}
                            </div>
                            <div className="flex-1 space-y-3 p-3">
                                {movers.losers.length > 0 ? movers.losers.map((row) => (
                                    <div key={`loser-${row.query}`} className="flex items-center justify-between gap-2">
                                        <span className="truncate pr-2 text-[11px] text-white/84">{row.query}</span>
                                        <span className="flex shrink-0 items-center text-[10px] font-bold tabular-nums text-rose-400">
                                            <ArrowDownIcon className="mr-0.5 h-2.5 w-2.5" />{Math.abs(Number(row.positionDelta || 0))}
                                        </span>
                                    </div>
                                )) : <div className="text-[11px] text-white/45">Aucune baisse nette.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
