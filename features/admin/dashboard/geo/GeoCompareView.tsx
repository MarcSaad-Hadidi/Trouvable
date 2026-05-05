// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ActivityIcon,
    BarChart3Icon,
    ChevronRightIcon,
    CpuIcon,
    GlobeIcon,
    HistoryIcon,
    LayoutGridIcon,
    PlayIcon,
    SearchIcon,
    Settings2Icon,
    SparklesIcon,
    TrophyIcon,
    ZapIcon,
    ArrowUpRightIcon
} from 'lucide-react';

import { CommandHeader, CommandMetricCard, CommandPageShell } from '@/features/admin/dashboard/shared/components/command';
import { COMMAND_BUTTONS, COMMAND_PANEL, COMMAND_SURFACE, cn } from '@/lib/tokens';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import {
    defaultGeoCompareForm,
} from '@/lib/llm-comparison/geo-compare-form';
import { buildComparisonViewModel } from '@/lib/llm-comparison/geo-insights';
import { getProviderMeta, normalizeModelLabel, signalTierLabel } from '@/lib/llm-comparison/provider-display';

/* --- Utilities --- */

function statusClass(result) {
    if (!result.ok) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (result.geo?.signal_tier === 'useful') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (result.geo?.signal_tier === 'weak') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-white/30 bg-white/5 border-white/10';
}

function scoreColor(score) {
    if (score >= 45) return 'text-emerald-400';
    if (score >= 30) return 'text-[#7c6aef]';
    if (score >= 15) return 'text-amber-400';
    return 'text-rose-400';
}

async function parseJsonResponse(response) {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error?.message || json?.error || `Erreur ${response.status}`);
    return json;
}

const EASE = [0.16, 1, 0.3, 1];

/* --- Components --- */

function ResponsePreview({ content }) {
    const [expanded, setExpanded] = useState(false);
    if (!content) return null;
    return (
        <div className="pt-4 border-t border-white/[0.04] mt-auto">
            <button
                type="button"
                className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors flex items-center gap-1"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? 'Masquer' : 'Voir Réponse Brute'}
                <ChevronRightIcon className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
            </button>
            {expanded && (
                <pre className="mt-3 geo-scrollbar text-[10px] text-white/40 whitespace-pre-wrap max-h-[150px] overflow-y-auto leading-relaxed rounded-xl bg-black/60 p-4 border border-white/5 font-mono">
                    {content}
                </pre>
            )}
        </div>
    );
}

export default function GeoCompareView({ linkedClientId = null }) {
    const isClientLinkedMode = Boolean(linkedClientId);
    const [form, setForm] = useState(defaultGeoCompareForm({ clientLinked: isClientLinkedMode }));
    const [clientContext, setClientContext] = useState(null);
    const [trackedPrompts, setTrackedPrompts] = useState([]);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const activeClientId = isClientLinkedMode ? linkedClientId : (form.client_id || '');
    const hasTrackedPrompts = trackedPrompts.length > 0;

    const viewModel = useMemo(() => {
        if (!result) return null;
        return buildComparisonViewModel(result, clientContext || {});
    }, [result, clientContext]);

    async function loadClientWorkspace(clientId) {
        if (!clientId) return;
        try {
            const [clientResponse, promptsResponse] = await Promise.all([
                fetch(`/api/admin/geo/client/${clientId}`, { cache: 'no-store' }),
                fetch(`/api/admin/geo/client/${clientId}/prompts`, { cache: 'no-store' }),
            ]);
            const clientJson = await parseJsonResponse(clientResponse);
            const promptsJson = await parseJsonResponse(promptsResponse);

            const businessDetails = clientJson?.client?.business_details || {};
            const context = {
                targetName: clientJson?.client?.client_name || '',
                targetDomain: clientJson?.client?.website_url || '',
                competitors: Array.isArray(businessDetails?.competitors) ? businessDetails.competitors : [],
            };

            const prompts = Array.isArray(promptsJson?.prompts) ? promptsJson.prompts.filter(p => p.is_active !== false) : [];
            setClientContext(context);
            setTrackedPrompts(prompts);

            setForm((current) => ({
                ...current,
                client_id: clientId,
                prompt_mode: prompts.length > 0 ? 'tracked' : 'free',
                tracked_query_id: prompts[0]?.id || '',
                url: context.targetDomain || current.url,
            }));
        } catch (e) { setError(e.message); }
    }

    useEffect(() => {
        if (linkedClientId) loadClientWorkspace(linkedClientId);
    }, [linkedClientId]);

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="GEO Comparison Bench"
            subtitle="Banc d'essai multi-moteurs pour valider la robustesse et l'émergence des signaux."
            actions={(
                <button
                    onClick={async () => {
                        setError(null); setRunning(true); setResult(null);
                        try {
                            const res = await fetch('/api/admin/llm-compare', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    source_type: form.source_type,
                                    prompt: form.prompt.trim(),
                                    provider_timeout_ms: 30000,
                                    ...(form.source_type === 'url' ? { url: form.url.trim() } : { text: form.text.trim() }),
                                    ...(activeClientId ? { client_id: activeClientId } : {}),
                                }),
                            });
                            setResult(await parseJsonResponse(res));
                        } catch (e) { setError(e.message); } finally { setRunning(false); }
                    }}
                    disabled={running}
                    className={COMMAND_BUTTONS.primary}
                >
                    <PlayIcon className={cn("h-4 w-4", running && "animate-pulse")} />
                    {running ? 'Audit en cours...' : 'Lancer Comparison'}
                </button>
            )}
        />
    );

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Providers" value="4 Active" detail="GPT, Claude, Gemini, Perplexity" tone="info" />
                <CommandMetricCard label="Contexte" value={clientContext?.targetName || 'Sandbox'} detail={clientContext?.targetDomain || 'Mode libre'} tone={activeClientId ? 'ok' : 'neutral'} />
                <CommandMetricCard label="Flux Source" value={form.source_type === 'url' ? 'URL Crawler' : 'Texte Brut'} detail="Moteur d'extraction" tone="neutral" />
                <CommandMetricCard label="Cohérence" value={viewModel ? `${viewModel.summary.successful_count}/4` : '—'} detail="Inter-moteurs" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12 h-[calc(100vh-280px)] min-h-[600px]">
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                    <div className={cn(COMMAND_PANEL, "p-8 space-y-8 bg-[#06070a]")}>
                        <div className="flex items-center gap-2 text-[#7c6aef]">
                            <Settings2Icon className="h-4 w-4" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Configuration Bench</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-white/20">Source Intelligence</label>
                                <div className="flex gap-2">
                                    {['url', 'text'].map(t => (
                                        <button key={t} onClick={() => setForm(c => ({ ...c, source_type: t }))} className={cn("flex-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all", form.source_type === t ? "bg-[#7c6aef]/10 border-[#7c6aef]/40 text-[#b8adff]" : "bg-white/5 border-white/5 text-white/10")}>
                                            {t === 'url' ? 'Crawler URL' : 'Texte Brut'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.source_type === 'url' ? (
                                <div className="relative group">
                                    <GlobeIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-[#7c6aef] transition-colors" />
                                    <input className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-[13px] text-white focus:outline-none focus:border-[#7c6aef]/30" value={form.url} onChange={e => setForm(c => ({ ...c, url: e.target.value }))} placeholder="https://..." />
                                </div>
                            ) : (
                                <textarea className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-[13px] text-white focus:outline-none min-h-[120px] italic" value={form.text} onChange={e => setForm(c => ({ ...c, text: e.target.value }))} placeholder="Collez le texte source..." />
                            )}

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/20">Intention GEO</label>
                                    {hasTrackedPrompts && (
                                        <button onClick={() => setForm(c => ({ ...c, prompt_mode: c.prompt_mode === 'tracked' ? 'free' : 'tracked' }))} className="text-[9px] font-bold text-[#7c6aef] uppercase tracking-widest">
                                            {form.prompt_mode === 'tracked' ? 'PROMPT SUIVI' : 'MODE LIBRE'}
                                        </button>
                                    )}
                                </div>
                                {form.prompt_mode === 'tracked' && hasTrackedPrompts && (
                                    <select className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] text-white focus:outline-none mb-3" value={form.tracked_query_id} onChange={e => { const p = trackedPrompts.find(x => x.id === e.target.value); setForm(c => ({ ...c, tracked_query_id: e.target.value, prompt: p?.query_text || c.prompt })); }}>
                                        {trackedPrompts.map(p => <option key={p.id} value={p.id} className="bg-[#0a0a0c]">{p.query_text}</option>)}
                                    </select>
                                )}
                                <textarea className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-[14px] text-white/90 focus:outline-none min-h-[150px] leading-relaxed italic border-l-2 border-[#7c6aef]/40" value={form.prompt} onChange={e => setForm(c => ({ ...c, prompt: e.target.value }))} placeholder="Décrivez l'intention..." />
                            </div>
                        </div>
                    </div>

                    {viewModel && (
                        <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                            <div className="flex items-center gap-2 mb-8 text-emerald-400">
                                <TrophyIcon className="h-4 w-4" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Verdict Radar</h3>
                            </div>
                            <div className="space-y-4">
                                <div className={cn(COMMAND_SURFACE, "p-5 border-l-2 border-emerald-500/40")}>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Leader Performance</div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[16px] font-bold text-white uppercase">{getProviderMeta(viewModel.summary.best_overall_provider).label}</div>
                                        <div className="text-[15px] font-bold text-emerald-400">{viewModel.results.find(r => r.provider === viewModel.summary.best_overall_provider)?.geo?.score}/75</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={cn(COMMAND_SURFACE, "p-4")}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Unanimité</div>
                                        <div className="text-[15px] font-bold text-white tabular-nums">{viewModel.summary.successful_count}/4 OK</div>
                                    </div>
                                    <div className={cn(COMMAND_SURFACE, "p-4")}>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Brand Recognition</div>
                                        <div className="text-[15px] font-bold text-[#7c6aef] tabular-nums">{viewModel.summary.providers_with_brand_mention.length}/4</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
                    {!viewModel ? (
                        <div className={cn(COMMAND_PANEL, "flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#06070a]")}>
                            <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8 opacity-20">
                                <BarChart3Icon className="h-10 w-10" />
                            </div>
                            <h3 className="text-[15px] font-bold text-white/50 mb-3">Banc d'essai en attente</h3>
                            <p className="text-[12px] text-white/20 max-w-sm mx-auto leading-relaxed uppercase tracking-widest font-bold">Lancez la comparaison pour évaluer les modèles.</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col gap-4 overflow-y-auto geo-scrollbar pb-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {viewModel.results.map((provider) => {
                                    const meta = getProviderMeta(provider.provider);
                                    const score = provider.geo?.score || 0;
                                    return (
                                        <div key={provider.provider} className={cn(COMMAND_PANEL, "p-0 flex flex-col overflow-hidden bg-[#06070a]")}>
                                            <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white border border-white/10", meta.color)}>{meta.initials}</div>
                                                    <div>
                                                        <div className="text-[13px] font-bold text-white">{meta.label}</div>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/20">{normalizeModelLabel(provider.model)}</div>
                                                    </div>
                                                </div>
                                                <div className={cn("px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border", statusClass(provider))}>
                                                    {provider.ok ? signalTierLabel(provider.geo?.signal_tier) : 'Échec'}
                                                </div>
                                            </div>

                                            <div className="p-6 flex-1 flex flex-col gap-5">
                                                {provider.error ? (
                                                    <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-[12px] text-rose-300 italic leading-relaxed">"{provider.error.message}"</div>
                                                ) : (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className={cn(COMMAND_SURFACE, "p-4")}>
                                                                <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Score</div>
                                                                <div className={cn("text-[18px] font-bold tabular-nums", scoreColor(score))}>{score}/75</div>
                                                            </div>
                                                            <div className={cn(COMMAND_SURFACE, "p-4")}>
                                                                <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Citations</div>
                                                                <div className="text-[18px] font-bold text-white tabular-nums">{provider.geo?.citations_count || 0}</div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className="text-[9px] font-bold uppercase tracking-widest text-white/20">Sources Majoritaires</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(provider.geo?.citations || []).slice(0, 4).map((c, i) => (
                                                                    <span key={i} className="text-[10px] px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-white/40">{c.host}</span>
                                                                ))}
                                                                {!provider.geo?.citations?.length && <span className="text-[10px] text-white/10 italic">Aucune source</span>}
                                                            </div>
                                                        </div>

                                                        <ResponsePreview content={provider.content} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={cn(COMMAND_PANEL, "p-8 bg-[#06070a]")}>
                                <div className="flex items-center gap-2 mb-8 text-[#7c6aef]">
                                    <SparklesIcon className="h-4 w-4" />
                                    <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]">Audit Comparatif IA</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/20">Insights & Calibration</div>
                                        <div className="space-y-4">
                                            {viewModel.hints.map((hint, i) => (
                                                <div key={i} className="flex items-start gap-4 text-[13px] text-white/50 leading-relaxed border-l border-white/5 pl-6 italic">
                                                    "{hint}"
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/20">Signaux par Type</div>
                                        <div className="space-y-3">
                                            {viewModel.results.some(r => r.geo?.citations?.length) ? (
                                                <>
                                                    <div className="flex items-center justify-between text-[12px] border-b border-white/5 pb-3">
                                                        <span className="text-white/40 font-bold uppercase tracking-widest">Éditorial</span>
                                                        <span className="text-[#7c6aef] font-bold uppercase tracking-widest">Couverture Élevée</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[12px] border-b border-white/5 pb-3">
                                                        <span className="text-white/40 font-bold uppercase tracking-widest">Réseaux</span>
                                                        <span className="text-amber-400 font-bold uppercase tracking-widest">Faible</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[12px] border-b border-white/5 pb-3">
                                                        <span className="text-white/40 font-bold uppercase tracking-widest">Annuaires</span>
                                                        <span className="text-emerald-400 font-bold uppercase tracking-widest">Exposé</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-[11px] text-white/20 italic">Synthesis unavailable.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </CommandPageShell>
    );
}
