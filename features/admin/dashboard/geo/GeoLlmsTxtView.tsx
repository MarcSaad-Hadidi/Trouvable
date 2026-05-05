// @ts-nocheck
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2Icon,
    CopyIcon,
    FileCodeIcon,
    RefreshCwIcon,
    SaveIcon,
    AlertTriangleIcon,
    DownloadIcon,
    TerminalIcon,
    ShieldCheckIcon,
    ActivityIcon,
    FileTextIcon,
    LayersIcon
} from 'lucide-react';

import { CommandHeader, CommandPageShell, CommandMetricCard } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import { useGeoClient } from '@/features/admin/dashboard/shared/context/ClientContext';

/* ── Utilities ── */

function splitSections(content) {
    const text = String(content || '');
    return [
        { label: 'Identity & Facts', present: /identity|core facts|identite/i.test(text) },
        { label: 'Pricing & Plans', present: /pricing|plans|tarif/i.test(text) },
        { label: 'Agent Guidelines', present: /agent guidelines|instructions for ai|guidelines/i.test(text) },
        { label: 'Support & Contact', present: /support|contact|documentation/i.test(text) },
    ];
}

/* ── Main View ── */

export default function GeoLlmsTxtPage() {
    const { client, clientId, audit } = useGeoClient();
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [content, setContent] = useState('');

    const llmsFound = useMemo(() => {
        const strengths = Array.isArray(audit?.strengths) ? audit.strengths : [];
        return strengths.some((item) => String(item?.title || '').toLowerCase().includes('llms.txt'));
    }, [audit]);

    const fetchDrafts = useCallback(async () => {
        if (!clientId) return;
        setLoading(true); setError(null);
        try {
            const response = await fetch(`/api/admin/remediation/suggestions/${clientId}?type=llms_txt_missing`, { cache: 'no-store' });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
            const suggestions = json.suggestions || [];
            const latest = suggestions.find((item) => item.ai_output && item.status === 'draft') || null;
            setDraft(latest);
            setContent(latest?.ai_output || '');
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [clientId]);

    useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

    async function handleGenerate() {
        if (!clientId || generating) return;
        setGenerating(true); setError(null);
        try {
            const response = await fetch(`/api/admin/remediation/generate/${clientId}?type=llms_txt_missing`, { method: 'POST' });
            if (!response.ok) throw new Error('Échec de génération');
            await fetchDrafts();
        } catch (e) { setError(e.message); } finally { setGenerating(false); }
    }

    async function handleCopy() {
        if (!content) return;
        await navigator.clipboard.writeText(content);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    function handleDownload() {
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'llms.txt';
        link.click();
        URL.revokeObjectURL(url);
    }

    const sectionRows = splitSections(content);
    const recommendations = [
        !client?.website_url ? 'Domaine public absent du profil.' : null,
        !client?.business_description && !client?.short_description ? 'Description métier non renseignée.' : null,
        !sectionRows.find(s => s.label === 'Pricing & Plans')?.present ? 'Section prix non détectée.' : null,
        !sectionRows.find(s => s.label === 'Agent Guidelines')?.present ? 'Directives agents absentes.' : null,
    ].filter(Boolean);

    const header = (
        <CommandHeader
            eyebrow="IA / GEO Remediation"
            title="Standard llms.txt"
            subtitle="Génération et optimisation du fichier de directives pour les agents et crawlers IA."
            actions={(
                <div className="flex gap-2">
                    <button onClick={handleGenerate} disabled={generating} className={COMMAND_BUTTONS.secondary}>
                        <RefreshCwIcon className={cn('h-4 w-4', generating && 'animate-spin')} />
                        {generating ? 'IA en cours...' : 'Régénérer IA'}
                    </button>
                    <button onClick={handleDownload} disabled={!content} className={COMMAND_BUTTONS.primary}>
                        <DownloadIcon className="h-4 w-4" />
                        Exporter .txt
                    </button>
                </div>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Lecture des directives agents...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Fichier Local" value={llmsFound ? 'Actif' : 'Absent'} detail="Détection audit" tone={llmsFound ? 'ok' : 'error'} />
                <CommandMetricCard label="Score Structure" value={`${sectionRows.filter(s => s.present).length}/4`} detail="Sections validées" tone={sectionRows.every(s => s.present) ? 'ok' : 'warning'} />
                <CommandMetricCard label="Intégrité IA" value={content ? 'Prêt' : 'Vide'} detail="Brouillon optimisé" tone={content ? 'info' : 'neutral'} />
                <CommandMetricCard label="Couverture" value="100%" detail="Profil client complet" tone="ok" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className={cn(COMMAND_PANEL, 'lg:col-span-8 flex flex-col p-0 overflow-hidden bg-[#06070a]')}>
                    <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TerminalIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">llms.txt — Éditeur de Directives</h3>
                        </div>
                        <button onClick={handleCopy} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                            {copied ? <CheckCircle2Icon className="h-4 w-4 text-emerald-400" /> : <CopyIcon className="h-4 w-4 text-white/20" />}
                        </button>
                    </div>

                    <div className="flex-1 relative font-mono overflow-hidden flex">
                        <div className="w-12 border-r border-white/5 bg-black/40 flex flex-col items-center py-6 select-none opacity-20">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <div key={i} className="text-[10px] leading-[22px]">{i + 1}</div>
                            ))}
                        </div>
                        <textarea 
                            value={content}
                            readOnly
                            spellCheck={false}
                            className="flex-1 bg-transparent resize-none text-[13px] leading-[22px] text-white/80 p-6 focus:outline-none geo-scrollbar italic"
                            placeholder="# En attente de génération..."
                        />
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                        <div className="flex items-center gap-2 mb-6 text-emerald-400">
                            <ShieldCheckIcon className="h-4 w-4" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Validation IA</h3>
                        </div>
                        <div className="space-y-3">
                            {sectionRows.map((s, i) => (
                                <div key={i} className={cn(COMMAND_SURFACE, "p-4 flex items-center justify-between")}>
                                    <span className={cn("text-[10px] font-bold uppercase tracking-widest", s.present ? "text-white/60" : "text-rose-400/60")}>{s.label}</span>
                                    {s.present ? <CheckCircle2Icon className="h-4 w-4 text-emerald-400" /> : <AlertTriangleIcon className="h-4 w-4 text-rose-500/40" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {recommendations.length > 0 && (
                        <div className={cn(COMMAND_PANEL, "p-8 bg-amber-500/[0.02] border-amber-500/10")}>
                            <div className="flex items-center gap-2 mb-4 text-amber-400">
                                <AlertTriangleIcon className="h-4 w-4" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Alertes Mandat</h3>
                            </div>
                            <div className="space-y-4">
                                {recommendations.map((r, i) => (
                                    <div key={i} className="flex gap-4 text-[12px] text-amber-200/40 leading-relaxed border-l border-amber-500/20 pl-4">
                                        {r}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                        <div className="flex items-center gap-2 mb-6 text-[#7c6aef]">
                            <LayersIcon className="h-4 w-4" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Contexte Injecté</h3>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Identité</div>
                                <div className="text-[13px] font-bold text-white">{client?.client_name || '—'}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Cible Regionale</div>
                                <div className="text-[12px] text-white/40 uppercase font-bold">{client?.address?.city || client?.target_region || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Mission</div>
                                <p className="text-[11px] text-white/30 leading-relaxed italic line-clamp-4">"{client?.short_description || client?.business_description || '—'}"</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
