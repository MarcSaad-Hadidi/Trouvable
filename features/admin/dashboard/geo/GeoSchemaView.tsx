// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangleIcon,
    CheckCircle2Icon,
    ChevronRightIcon,
    HashIcon,
    NetworkIcon,
    ShieldAlertIcon,
} from 'lucide-react';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';

function toneFromStatus(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('couvert') || normalized.includes('present') || normalized.includes('aligne')) return 'valid';
    if (normalized.includes('partiel') || normalized.includes('confirmer')) return 'warning';
    return 'error';
}

function statusIcon(status) {
    const tone = toneFromStatus(status);
    if (tone === 'valid') return <CheckCircle2Icon className="h-4 w-4 text-emerald-400" />;
    if (tone === 'warning') return <ShieldAlertIcon className="h-4 w-4 text-amber-400" />;
    return <AlertTriangleIcon className="h-4 w-4 text-rose-400" />;
}

function statusChip(status) {
    const tone = toneFromStatus(status);
    if (tone === 'valid') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (tone === 'warning') return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
}

export default function GeoSchemaPage() {
    const { clientId } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('schema');
    const [expandedRow, setExpandedRow] = useState(null);
    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';
    const seoBase = clientId ? `/admin/clients/${clientId}/seo` : '/admin/clients';

    const orbitNodes = useMemo(() => {
        return (data?.coverageItems || []).slice(0, 5).map((item, index) => ({
            id: item.key,
            label: item.label,
            status: item.operatorStatus,
            top: ['10%', '35%', '35%', '78%', '78%'][index],
            left: ['50%', '12%', '86%', '24%', '76%'][index],
            center: index === 0,
        }));
    }, [data]);

    return (
        <CommandPageShell
            header={(
                <CommandHeader
                    eyebrow="GEO Ops"
                    title="Schema & entites"
                    subtitle="Validation reelle du balisage structure, des entites et des manques detectes sur le dernier audit exploitable."
                    actions={(
                        <>
                            <Link href={`${seoBase}/health`} className={COMMAND_BUTTONS.secondary}>Voir audit</Link>
                            <Link href={`${geoBase}/consistency`} className={COMMAND_BUTTONS.primary}>Voir fiabilite IA</Link>
                        </>
                    )}
                />
            )}
        >
            {loading ? (
                <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-8 text-[13px] text-white/55">Chargement du schema...</div>
            ) : error ? (
                <CommandEmptyState title="Lecture schema indisponible" description={error} />
            ) : data?.emptyState ? (
                <CommandEmptyState title={data.emptyState.title} description={data.emptyState.description} />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <CommandMetricCard label="Couverture schema" value={`${data?.summary?.coveragePercent ?? 0}%`} detail={`${data?.summary?.observedTypeCount ?? 0} types observes`} tone={(data?.summary?.coveragePercent ?? 0) >= 70 ? 'ok' : 'warning'} />
                        <CommandMetricCard label="Entites detectees" value={data?.summary?.observedTypeCount ?? 0} detail="Types structures distincts" tone="info" />
                        <CommandMetricCard label="Ecarts critiques" value={data?.summary?.criticalGapCount ?? 0} detail="Manques qui bloquent l'ancrage" tone={(data?.summary?.criticalGapCount ?? 0) > 0 ? 'critical' : 'neutral'} />
                        <CommandMetricCard label="Fraicheur audit" value={data?.summary?.auditFreshness || 'n.d.'} detail="Dernier audit structure" tone="neutral" />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3 h-[calc(100vh-280px)] min-h-[600px]">
                        <div className={cn(COMMAND_PANEL, 'lg:col-span-1 p-0 flex flex-col overflow-hidden')}>
                            <div className="flex items-center justify-between border-b border-white/[0.05] p-5">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-white/90">
                                    <NetworkIcon className="h-4 w-4 text-indigo-400" />
                                    Graphe d'entite marque
                                </div>
                                <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">Organization</span>
                            </div>

                            <div className="relative flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/5 via-black/20 to-transparent">
                                <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: 0.3 }}>
                                    <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4 4" />
                                    <line x1="50%" y1="50%" x2="15%" y2="40%" stroke="#8b5cf6" strokeWidth="2" />
                                    <line x1="50%" y1="50%" x2="85%" y2="40%" stroke="#8b5cf6" strokeWidth="2" />
                                    <line x1="50%" y1="50%" x2="25%" y2="80%" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4 4" />
                                    <line x1="50%" y1="50%" x2="75%" y2="80%" stroke="#8b5cf6" strokeWidth="2" />
                                </svg>

                                <div className="absolute inset-0">
                                    <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-indigo-400 bg-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                                            <span className="text-sm font-bold text-white">Marque</span>
                                        </div>
                                    </div>

                                    {orbitNodes.map((node) => (
                                        <div
                                            key={node.id}
                                            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                                            style={{ top: node.top, left: node.left }}
                                        >
                                            <div className={cn(
                                                'mb-1 flex h-10 w-10 items-center justify-center rounded-full border',
                                                toneFromStatus(node.status) === 'valid'
                                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                                    : toneFromStatus(node.status) === 'warning'
                                                        ? 'border-amber-500/30 bg-amber-500/10'
                                                        : 'border-rose-500/30 bg-rose-500/10',
                                            )}>
                                                <HashIcon className={cn(
                                                    'h-4 w-4',
                                                    toneFromStatus(node.status) === 'valid'
                                                        ? 'text-emerald-400'
                                                        : toneFromStatus(node.status) === 'warning'
                                                            ? 'text-amber-400'
                                                            : 'text-rose-400',
                                                )} />
                                            </div>
                                            <span className="rounded border border-white/[0.05] bg-black/50 px-2 py-0.5 text-[10px] text-white/65">{node.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="absolute bottom-4 left-4 right-4 text-center text-[10px] text-white/40">
                                    Graphe derive de la couverture schema observee sur le dernier audit.
                                </div>
                            </div>
                        </div>

                        <div className={cn(COMMAND_PANEL, 'lg:col-span-2 flex flex-col overflow-hidden p-0')}>
                            <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.01] p-4">
                                <h3 className="text-[12px] font-semibold text-white/90">Validateur des blocs schema</h3>
                                <div className="flex gap-2">
                                    <span className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50">{data.coverageItems.filter((item) => toneFromStatus(item.operatorStatus) === 'valid').length} valides</span>
                                    <span className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50">{data.coverageItems.filter((item) => toneFromStatus(item.operatorStatus) === 'warning').length} avert.</span>
                                    <span className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50">{data.summary.criticalGapCount || 0} erreurs</span>
                                </div>
                            </div>

                            <div className="flex-1 divide-y divide-white/[0.02] overflow-y-auto scrollbar-none">
                                {(data.coverageItems || []).map((item) => (
                                    <div key={item.key} className="flex flex-col">
                                        <div
                                            onClick={() => setExpandedRow(expandedRow === item.key ? null : item.key)}
                                            className="group flex cursor-pointer items-center gap-4 p-3 transition-colors hover:bg-white/[0.03]"
                                        >
                                            <div className="w-6 flex justify-center">{statusIcon(item.operatorStatus)}</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex items-center gap-2">
                                                    <span className="text-[12px] font-medium text-white/85">{item.label}</span>
                                                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/50">{item.coveragePercent}%</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {(item.observedTypes || []).slice(0, 4).map((type) => (
                                                        <span key={type} className="rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] text-indigo-300/70">{type}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="hidden text-right sm:block">
                                                <div className="text-[10px] text-white/40">{item.foundCount}/{item.expectedCount} proprietes</div>
                                                <div className="text-[9px] text-white/30">{item.reliability || 'n.d.'}</div>
                                            </div>
                                            <ChevronRightIcon className={cn('h-4 w-4 text-white/20 transition-transform duration-200', expandedRow === item.key && 'rotate-90')} />
                                        </div>

                                        <AnimatePresence>
                                            {expandedRow === item.key ? (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden border-t border-white/[0.05] bg-black/20"
                                                >
                                                    <div className="flex flex-col gap-4 p-4">
                                                        {(item.missingProperties || []).length > 0 ? (
                                                            <div className={cn(
                                                                'rounded-lg border p-3',
                                                                toneFromStatus(item.operatorStatus) === 'error' ? 'border-rose-500/20 bg-rose-500/5' : 'border-amber-500/20 bg-amber-500/5',
                                                            )}>
                                                                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/65">Proprietes manquantes</div>
                                                                <ul className="space-y-1">
                                                                    {item.missingProperties.map((issue) => (
                                                                        <li key={issue} className="flex items-start gap-2 text-[11px] text-white/70">
                                                                            <span className="mt-1 h-1 w-1 rounded-full bg-white/20 shrink-0" />
                                                                            {issue}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ) : null}

                                                        <div className="rounded-lg border border-white/[0.05] bg-[#0d1117] p-3">
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-[10px] font-mono text-white/40">Preuve observee</span>
                                                                <span className={cn('rounded px-2 py-0.5 text-[9px]', statusChip(item.operatorStatus))}>{item.operatorStatus}</span>
                                                            </div>
                                                            <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/72">{item.evidence || 'Aucune preuve textuelle supplementaire.'}</div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ) : null}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </CommandPageShell>
    );
}
