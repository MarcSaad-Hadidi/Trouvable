// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2Icon, SearchIcon, SparklesIcon, TagIcon, AlertTriangleIcon } from 'lucide-react';

import { useGeoClient, useSeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import { useIssueHandoff } from '@/features/admin/dashboard/shared/context/IssueHandoffContext';
import { problemRefFromSearchParams } from '@/lib/correction-prompts/problem-ref';
import CorrectionPromptGenerator from '@/features/admin/dashboard/seo/CorrectionPromptGenerator';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, cn } from '@/lib/tokens';
import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import Link from 'next/link';

const COLUMN_META = {
    critical: { title: 'Critiques', color: 'bg-rose-400', icon: AlertTriangleIcon },
    medium: { title: 'À traiter', color: 'bg-amber-400', icon: TagIcon },
    low: { title: 'Éligibles', color: 'bg-emerald-400', icon: CheckCircle2Icon },
};

function priorityBucket(issue) {
    const priority = String(issue?.priority || 'medium').toLowerCase();
    if (priority === 'critical' || priority === 'high') return 'critical';
    if (priority === 'low') return 'low';
    return 'medium';
}

function compactText(value, fallback) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
}

export default function SeoCorrectionPromptsPage() {
    const searchParams = useSearchParams();
    const preferredIssueId = searchParams.get('issueId');
    const autoGenerate = searchParams.get('auto') === '1';
    const { client, clientId } = useGeoClient();
    const { openHandoff } = useIssueHandoff();
    const { data, loading, error } = useSeoWorkspaceSlice('health');
    const [selectedIssueId, setSelectedIssueId] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!clientId) return;
        if (searchParams.get('handoffUi') === 'page') return;
        const ref = problemRefFromSearchParams(clientId, searchParams);
        if (!ref) return;
        if (ref.source === 'seo_health_issue') return;
        openHandoff(ref);
    }, [clientId, openHandoff, searchParams]);

    const baseHref = clientId ? `/admin/clients/${clientId}` : '/admin/clients';
    const promptableIssues = useMemo(() => (data?.issues || []).filter((issue) => issue?.promptAvailable !== false), [data?.issues]);
    const filteredIssues = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return promptableIssues;
        return promptableIssues.filter((issue) => `${issue.title || ''} ${issue.description || ''} ${issue.evidence || ''}`.toLowerCase().includes(needle));
    }, [promptableIssues, search]);

    useEffect(() => {
        if (!filteredIssues.length) {
            setSelectedIssueId(null);
            return;
        }
        if (preferredIssueId && filteredIssues.some((issue) => issue.id === preferredIssueId)) {
            setSelectedIssueId(preferredIssueId);
            return;
        }
        setSelectedIssueId((current) => current && filteredIssues.some((issue) => issue.id === current) ? current : filteredIssues[0].id);
    }, [preferredIssueId, filteredIssues]);

    const selectedIssue = filteredIssues.find((issue) => issue.id === selectedIssueId) || null;
    const grouped = useMemo(() => ({
        critical: filteredIssues.filter((issue) => priorityBucket(issue) === 'critical'),
        medium: filteredIssues.filter((issue) => priorityBucket(issue) === 'medium'),
        low: filteredIssues.filter((issue) => priorityBucket(issue) === 'low'),
    }), [filteredIssues]);

    if (loading) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Prompts de correction IA" subtitle="Chargement des problèmes éligibles et du générateur réel." />}>
                <div className={cn(COMMAND_PANEL, 'p-8')}>
                    <div className="text-[15px] font-semibold text-white/90">Chargement de l’atelier de prompts</div>
                    <p className="mt-2 text-[13px] text-white/55">Les issues SEO Health éligibles et le contexte de génération sont en cours d’assemblage.</p>
                </div>
            </CommandPageShell>
        );
    }

    if (error) {
        return (
            <CommandPageShell header={<CommandHeader eyebrow="SEO Ops" title="Prompts de correction IA" subtitle="Atelier connecté aux problèmes réels du dossier." />}>
                <CommandEmptyState title="Prompts de correction indisponibles" description={error} action={<Link href={`${baseHref}/seo/health`} className={COMMAND_BUTTONS.primary}>Retour santé SEO</Link>} />
            </CommandPageShell>
        );
    }

    if (!data || data.emptyState || promptableIssues.length === 0) {
        return (
            <CommandPageShell
                header={<CommandHeader eyebrow="SEO Ops" title="Prompts de correction IA" subtitle={`Atelier de génération pour ${client?.client_name || 'ce mandat'}.`} actions={<Link href={`${baseHref}/seo/health`} className={COMMAND_BUTTONS.primary}>Santé SEO</Link>} />}
            >
                <CommandEmptyState title={data?.emptyState?.title || 'Aucun problème éligible pour prompt'} description={data?.emptyState?.description || 'Le dernier audit ne fournit pas encore de problème technique SEO exploitable pour la génération de prompt.'} />
            </CommandPageShell>
        );
    }

    const metrics = [
        { label: 'Problèmes éligibles', value: promptableIssues.length, detail: 'Issues SEO Health avec preuve exploitable.', tone: 'info' },
        { label: 'Critiques', value: grouped.critical.length, detail: 'Priorité haute à corriger.', tone: grouped.critical.length > 0 ? 'critical' : 'neutral' },
        { label: 'À traiter', value: grouped.medium.length, detail: 'Bloc de production courant.', tone: 'warning' },
        { label: 'Éligibles légers', value: grouped.low.length, detail: 'Améliorations à faible friction.', tone: 'ok' },
    ];

    return (
        <CommandPageShell
            header={
                <CommandHeader
                    eyebrow="SEO Ops"
                    title="Prompts de correction IA"
                    subtitle={`Board de génération relié aux vrais problèmes SEO Health de ${client?.client_name || 'ce mandat'}, sans prompts de démo ni backlog fictif.`}
                    actions={
                        <>
                            <Link href={`${baseHref}/seo/health`} className={COMMAND_BUTTONS.secondary}>Santé SEO</Link>
                            <Link href={`${baseHref}/seo/opportunities`} className={COMMAND_BUTTONS.secondary}>Opportunités SEO</Link>
                        </>
                    }
                />
            }
        >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {metrics.map((metric) => <CommandMetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} />)}
            </div>

            <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <input
                        type="text"
                        placeholder="Rechercher un problème..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="bg-white/[0.03] border border-white/[0.08] rounded-full pl-8 pr-4 py-1.5 text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
                    />
                </div>
                <div className="text-[11px] text-white/40">{filteredIssues.length} problème(s) visibles</div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 min-h-[640px] mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
                    {Object.entries(COLUMN_META).map(([key, meta]) => {
                        const items = grouped[key] || [];
                        const Icon = meta.icon;
                        return (
                            <div key={key} className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <div className="flex items-center gap-2">
                                        <div className={cn('w-2 h-2 rounded-full', meta.color)} />
                                        <h3 className="text-[13px] font-semibold text-white/90">{meta.title}</h3>
                                    </div>
                                    <span className="text-[10px] font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{items.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none pb-4">
                                    {items.length > 0 ? items.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedIssueId(item.id)}
                                            className={cn(COMMAND_PANEL, 'w-full p-4 flex flex-col gap-3 text-left group transition-colors', selectedIssue?.id === item.id ? 'ring-1 ring-indigo-400/30 bg-white/[0.05]' : 'hover:bg-white/[0.04]')}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="text-[12px] font-semibold text-white/90 leading-snug">{item.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                                                            <Icon className="w-3 h-3" />
                                                            {item.priority || 'medium'}
                                                        </span>
                                                        <span className="text-[10px] text-indigo-300/80">{item.reliability || 'unavailable'}</span>
                                                    </div>
                                                </div>
                                                <ReliabilityPill value={item.reliability || 'unavailable'} />
                                            </div>
                                            <div className="bg-black/40 rounded-lg p-2.5 border border-white/[0.05] overflow-hidden">
                                                <div className="text-[10px] font-mono text-white/60 leading-relaxed line-clamp-4">
                                                    {compactText(item.evidence, 'Preuve indisponible.')}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="text-[10px] text-white/45">{compactText(item.description, 'Description indisponible.')}</div>
                                                <span className="text-[10px] font-medium px-3 py-1 rounded bg-white/[0.05] text-white/70">Sélectionner</span>
                                            </div>
                                        </button>
                                    )) : <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-[12px] text-white/45">Aucun problème dans cette colonne.</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={cn(COMMAND_PANEL, 'p-0 overflow-hidden flex flex-col')}>
                    <div className="p-5 border-b border-white/[0.05] bg-white/[0.02]">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Prompt exécutable
                        </div>
                        <h3 className="mt-3 text-[18px] font-semibold text-white/92">{selectedIssue?.title || 'Sélectionner un problème'}</h3>
                        <p className="mt-2 text-[12px] leading-relaxed text-white/48">Sélection ancrée dans la preuve observée. Le générateur reste branché au backend réel de correction.</p>
                    </div>
                    <div className="p-5 space-y-4 overflow-y-auto scrollbar-none">
                        {selectedIssue ? (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                        <div className="text-[10px] uppercase tracking-[0.12em] text-white/38">Priorité</div>
                                        <div className="mt-2 text-[14px] font-semibold text-white">{selectedIssue.priority || 'medium'}</div>
                                    </div>
                                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                        <div className="text-[10px] uppercase tracking-[0.12em] text-white/38">Fiabilité</div>
                                        <div className="mt-2 text-[14px] font-semibold text-white">{selectedIssue.reliability || 'unavailable'}</div>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12px] text-white/72 leading-relaxed">
                                    {compactText(selectedIssue.evidence, 'Preuve indisponible.')}
                                </div>
                                <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
                                    <CorrectionPromptGenerator clientId={clientId} issue={selectedIssue} autoGenerate={autoGenerate} />
                                </div>
                                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-200/70">Discipline de vérité</div>
                                    <div className="mt-2 text-[12px] leading-relaxed text-white/58">Prompt ancré dans la preuve observée, avec contraintes et validations dérivées du contexte dépôt.</div>
                                </div>
                            </>
                        ) : (
                            <CommandEmptyState title="Aucun problème sélectionné" description="Choisis une carte à gauche pour générer un prompt réel." />
                        )}
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
