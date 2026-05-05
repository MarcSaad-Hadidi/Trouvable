// @ts-nocheck
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    History,
    Play,
    Radar,
    PlusCircleIcon,
    SparklesIcon,
    ActivityIcon,
    Trash2Icon,
    PauseIcon,
    Edit3Icon,
    ZapIcon,
    ChevronRightIcon,
    CheckCircle2Icon,
    AlertCircleIcon,
    ClockIcon,
    SearchIcon,
    ListIcon,
    ArrowUpRightIcon,
    PlayIcon
} from 'lucide-react';

import { useGeoClient, useGeoWorkspaceSlice } from '@/features/admin/dashboard/shared/context/ClientContext';
import {
    CommandHeader,
    CommandMetricCard,
    CommandPageShell,
    COMMAND_BUTTONS,
    COMMAND_PANEL,
    COMMAND_SURFACE,
    cn,
} from '@/features/admin/dashboard/shared/components/command';
import CommandEmptyState from '@/features/admin/dashboard/shared/components/command/CommandEmptyState';
import QualityPill from '@/components/shared/metrics/QualityPill';

/* --- Constants --- */

const DEFAULT_FORM = {
    query_text: '',
    category: 'discovery',
    discovery_mode: 'blind_discovery',
    locale: 'fr-CA',
    prompt_mode: 'user_like',
    is_active: true,
};

const PROMPT_MODE_LABELS = {
    user_like: 'Question naturelle',
    operator_probe: 'Sonde opérateur',
};

const EASE = [0.16, 1, 0.3, 1];

/* --- Helpers --- */

function resolvePromptMode(prompt) {
    return prompt.prompt_mode || prompt.prompt_metadata?.prompt_mode || 'user_like';
}

function discoveryModeLabel(prompt) {
    return prompt.discovery_mode_label || prompt.discovery_mode || 'Mode inconnu';
}

function discoveryModeTone(prompt) {
    if (prompt.context_injected || prompt.bias_risk === 'context_injected') return 'text-amber-400/70';
    if (prompt.source_grounded || prompt.bias_risk === 'source_grounded') return 'text-emerald-400/70';
    if (prompt.bias_risk === 'brand_name_only') return 'text-sky-400/70';
    return 'text-white/25';
}

function promptStatusDotClass(prompt) {
    if (!prompt.is_active) return 'bg-white/10';
    if (prompt.quality_status === 'strong') return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
    if (prompt.quality_status === 'weak') return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
    return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
}

function executionStatusMeta(status) {
    if (status === 'completed') return { label: 'Terminée', cls: 'text-emerald-400', dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' };
    if (status === 'partial') return { label: 'Partielle', cls: 'text-amber-400', dot: 'bg-amber-400' };
    if (status === 'running') return { label: 'En cours', cls: 'text-[#7c6aef]', dot: 'bg-[#7c6aef] animate-pulse shadow-[0_0_8px_rgba(124,106,239,0.4)]' };
    if (status === 'failed') return { label: 'Échouée', cls: 'text-rose-400', dot: 'bg-rose-400' };
    return { label: '—', cls: 'text-white/20', dot: 'bg-white/10' };
}

function promptLifecycleLabel(prompt) {
    if (!prompt.is_active) return { text: 'INACTIF', cls: 'text-white/20' };
    if (prompt.quality_status === 'weak') return { text: 'À RENFORCER', cls: 'text-rose-400' };
    if (prompt.quality_status === 'review') return { text: 'À REVOIR', cls: 'text-amber-400' };
    if (!prompt.last_run) return { text: 'PRÊT', cls: 'text-[#7c6aef]' };
    if (prompt.last_run.target_found) return { text: 'PERFORMANT', cls: 'text-emerald-400' };
    return { text: 'ACTIF', cls: 'text-white/40' };
}

async function parseJsonResponse(response) {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Erreur ${response.status}`);
    return json;
}

/* --- Components --- */

function PromptCreationSurface({ form, setForm, categoryOptions, discoveryModeOptions = [], submitting, onSubmit, client, actionNotice, actionError }) {
    const [aiRefining, setAiRefining] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState(null);

    const handleAiRefine = useCallback(async () => {
        const rawText = form.query_text.trim();
        if (!rawText || rawText.length < 5) return;
        setAiRefining(true);
        setAiSuggestion(null);
        try {
            const response = await fetch('/api/admin/clients/onboarding/suggest-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_query: rawText,
                    business_name: client?.client_name || '',
                    business_type: client?.business_type || '',
                    intent_family: form.category || '',
                    prompt_mode: form.prompt_mode || 'user_like',
                }),
            });
            const json = await parseJsonResponse(response);
            setAiSuggestion(json.suggestion);
        } catch { /* Silent fail */ } finally {
            setAiRefining(false);
        }
    }, [form, client]);

    return (
        <div className={cn(COMMAND_PANEL, "p-6 bg-[#06070a]")}>
            <div className="flex items-center gap-2 mb-6 text-[#7c6aef]">
                <PlusCircleIcon className="h-4 w-4" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Nouveau Prompt</h3>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
                <div className="relative group">
                    <textarea
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-[13px] text-white placeholder:text-white/5 focus:border-[#7c6aef]/40 focus:ring-0 transition-all min-h-[100px] resize-none italic"
                        value={form.query_text}
                        onChange={(e) => setForm((c) => ({ ...c, query_text: e.target.value }))}
                        placeholder="Quelle est la meilleure solution pour..."
                        disabled={submitting}
                    />
                    <button
                        type="button"
                        onClick={handleAiRefine}
                        disabled={aiRefining || submitting || form.query_text.length < 5}
                        className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#7c6aef]/10 border border-[#7c6aef]/20 text-[10px] font-bold uppercase tracking-widest text-[#7c6aef] hover:bg-[#7c6aef]/20 transition-all disabled:opacity-0"
                    >
                        <SparklesIcon className={cn("h-3 w-3", aiRefining && "animate-pulse")} />
                        {aiRefining ? 'IA...' : 'Affiner'}
                    </button>
                </div>

                {aiSuggestion && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-[#7c6aef]/20 bg-[#7c6aef]/5 p-4">
                        <p className="text-[12px] text-white/80 leading-relaxed italic mb-4">"{aiSuggestion}"</p>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => { setForm((c) => ({ ...c, query_text: aiSuggestion })); setAiSuggestion(null); }} className="text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 bg-[#7c6aef] text-white rounded-lg">Utiliser</button>
                            <button type="button" onClick={() => setAiSuggestion(null)} className="text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 text-white/40 hover:text-white transition-colors">Ignorer</button>
                        </div>
                    </motion.div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-white/20 ml-1">Catégorie</label>
                        <select className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] text-white focus:outline-none focus:border-[#7c6aef]/30" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} disabled={submitting}>
                            {categoryOptions.map((o) => <option key={o.key} value={o.key} className="bg-[#0a0a0c]">{o.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-white/20 ml-1">Mode</label>
                        <select className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] text-white focus:outline-none focus:border-[#7c6aef]/30" value={form.prompt_mode} onChange={(e) => setForm((c) => ({ ...c, prompt_mode: e.target.value }))} disabled={submitting}>
                            <option value="user_like" className="bg-[#0a0a0c]">Naturel</option>
                            <option value="operator_probe" className="bg-[#0a0a0c]">Sonde</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/20 ml-1">Mesure</label>
                    <select className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] text-white focus:outline-none focus:border-[#7c6aef]/30" value={form.discovery_mode} onChange={(e) => setForm((c) => ({ ...c, discovery_mode: e.target.value }))} disabled={submitting}>
                        {(discoveryModeOptions.length ? discoveryModeOptions.filter((o) => o.key !== 'operator_extraction') : [{ key: 'blind_discovery', label: 'Decouverte spontanee' }]).map((o) => (
                            <option key={o.key} value={o.key} className="bg-[#0a0a0c]">{o.label}</option>
                        ))}
                    </select>
                </div>

                <button type="submit" disabled={submitting || !form.query_text.trim()} className={cn(COMMAND_BUTTONS.primary, "w-full justify-center py-3 rounded-xl")}>
                    <PlusCircleIcon className="h-4 w-4" />
                    Enregistrer Prompt
                </button>
            </form>
        </div>
    );
}

async function createPromptDirectly({ clientId, queryText, category, promptMode, discoveryMode, locale }) {
    const response = await fetch('/api/admin/queries/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clientId,
            query_text: queryText,
            category: category || 'discovery',
            discovery_mode: discoveryMode,
            locale: locale || 'fr-CA',
            prompt_mode: promptMode || 'user_like',
            is_active: true,
            prompt_origin: 'ai_generated_batch',
        }),
    });
    return parseJsonResponse(response);
}

function AiPromptListSurface({ client, clientId, invalidateWorkspace, categoryOptions, submitting: parentSubmitting }) {
    const [open, setOpen] = useState(false);
    const [guidance, setGuidance] = useState('');
    const [category, setCategory] = useState('');
    const [promptMode, setPromptMode] = useState('');
    const [count, setCount] = useState(4);
    const [generating, setGenerating] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [addingIds, setAddingIds] = useState(new Set());
    const [addedIds, setAddedIds] = useState(new Set());

    const mandateContext = [client?.client_name, client?.business_type, client?.address?.city || client?.target_region].filter(Boolean);
    const hasMandateContext = mandateContext.length > 0;

    const handleGenerate = useCallback(async () => {
        setGenerating(true);
        setResults(null);
        setError(null);
        try {
            const response = await fetch('/api/admin/clients/onboarding/generate-prompt-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent: guidance.trim() || undefined,
                    category,
                    prompt_mode: promptMode || undefined,
                    count,
                    business_name: client?.client_name || '',
                    business_type: client?.business_type || '',
                    target_region: client?.address?.city || client?.target_region || '',
                    seo_description: client?.seo_description || '',
                    services: Array.isArray(client?.business_details?.services) ? client.business_details.services.join(', ') : '',
                }),
            });
            const json = await parseJsonResponse(response);
            setResults(json.prompts || []);
        } catch (err) {
            setError(err.message || 'Échec de la génération');
        } finally {
            setGenerating(false);
        }
    }, [guidance, category, promptMode, count, client]);

    const handleAddItem = useCallback(async (item) => {
        setAddingIds(prev => new Set(prev).add(item.id));
        try {
            await createPromptDirectly({
                clientId,
                queryText: item.query_text,
                category: item.intent_family,
                promptMode: item.prompt_mode,
                discoveryMode: item.discovery_mode,
            });
            setAddedIds(prev => new Set(prev).add(item.id));
            invalidateWorkspace();
        } catch {} finally {
            setAddingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
        }
    }, [clientId, invalidateWorkspace]);

    if (!open) {
        return (
            <div className={cn(COMMAND_PANEL, "p-6 bg-[#06070a] border-dashed border-[#7c6aef]/20 hover:border-[#7c6aef]/40 transition-all cursor-pointer group")} onClick={() => setOpen(true)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#7c6aef]/10 flex items-center justify-center text-[#7c6aef]">
                            <SparklesIcon className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7c6aef]">Génération Assistée</div>
                            <div className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">IA génère des prompts selon le mandat</div>
                        </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-white/10 group-hover:text-[#7c6aef] transition-colors" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn(COMMAND_PANEL, "p-6 bg-[#06070a] space-y-6")}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-white/95">Générer des prompts pour ce mandat</h3>
                    <p className="text-[11px] text-white/40 mt-0.5">
                        Contexte : {mandateContext.join(' · ') || 'Inconnu'}
                    </p>
                </div>
                <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white transition-all uppercase tracking-widest">Fermer</button>
            </div>

            {hasMandateContext && (
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <div className="grid grid-cols-3 gap-4 mb-2">
                        <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Client</p>
                            <p className="text-[11px] text-white/60 truncate">{client?.client_name}</p>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Type</p>
                            <p className="text-[11px] text-white/60 truncate">{client?.business_type}</p>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Région</p>
                            <p className="text-[11px] text-white/60 truncate">{client?.address?.city || client?.target_region}</p>
                        </div>
                    </div>
                    {client?.seo_description && (
                        <div className="pt-2 border-t border-white/[0.04]">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Description</p>
                            <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">{client.seo_description}</p>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    <select
                        className="bg-black/40 border border-[#7c6aef]/20 rounded-xl px-3 py-2.5 text-[12px] text-white focus:outline-none focus:border-[#7c6aef]/50"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                    >
                        <option value="" className="bg-[#0a0a0c]">Catégorie (auto)</option>
                        {categoryOptions.map(o => <option key={o.key} value={o.key} className="bg-[#0a0a0c]">{o.label}</option>)}
                    </select>
                    <select
                        className="bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-[12px] text-white focus:outline-none focus:border-[#7c6aef]/30"
                        value={promptMode}
                        onChange={e => setPromptMode(e.target.value)}
                    >
                        <option value="" className="bg-[#0a0a0c]">Mode (varié)</option>
                        <option value="user_like" className="bg-[#0a0a0c]">Question naturelle</option>
                        <option value="operator_probe" className="bg-[#0a0a0c]">Sonde opérateur</option>
                    </select>
                    <select
                        className="bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-[12px] text-white focus:outline-none focus:border-[#7c6aef]/30"
                        value={count}
                        onChange={e => setCount(Number(e.target.value))}
                    >
                        <option value={3} className="bg-[#0a0a0c]">3 prompts</option>
                        <option value={4} className="bg-[#0a0a0c]">4 prompts</option>
                        <option value={5} className="bg-[#0a0a0c]">5 prompts</option>
                        <option value={6} className="bg-[#0a0a0c]">6 prompts</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[11px] text-white/30 ml-1 block">Angle supplémentaire (optionnel)</label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-white/5 focus:outline-none focus:border-[#7c6aef]/30"
                            placeholder="Ex. Focus sur les services d'urgence, ou cibler les jeunes familles"
                            value={guidance}
                            onChange={e => setGuidance(e.target.value)}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="px-8 py-3 rounded-xl bg-white text-black font-bold text-[12px] hover:bg-white/90 transition-all disabled:opacity-50 shrink-0"
                        >
                            {generating ? 'IA...' : 'Générer'}
                        </button>
                    </div>
                </div>
            </div>

            {results && (
                <div className="space-y-2 pt-4 border-t border-white/5">
                    {results.map((item, i) => (
                        <div key={i} className={cn(COMMAND_SURFACE, "p-4 flex items-start gap-4 group relative")}>
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-white/80 italic leading-relaxed">"{item.query_text}"</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#7c6aef]/60">{item.intent_family}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/10">·</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">{PROMPT_MODE_LABELS[item.prompt_mode] || item.prompt_mode}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleAddItem(item)}
                                disabled={addedIds.has(item.id) || addingIds.has(item.id)}
                                className={cn(
                                    "p-2 rounded-xl transition-all",
                                    addedIds.has(item.id) ? "text-emerald-400 bg-emerald-400/10" : "text-white/10 hover:text-white hover:bg-white/5"
                                )}
                            >
                                {addedIds.has(item.id) ? <CheckCircle2Icon className="h-4 w-4" /> : <PlusCircleIcon className="h-4 w-4" />}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}



function TrackedPromptRow({
    prompt, categoryOptions, isEditing, editingForm, setEditingForm, setEditingId,
    submitting, isRunning, onSave, onToggle, onDelete, onRun, onImprove,
    isImproving, improvedText, onUseImproved, onClearImprovement
}) {
    const lifecycle = promptLifecycleLabel(prompt);
    const mode = resolvePromptMode(prompt);
    const execStatus = executionStatusMeta(prompt.last_run?.status);

    if (isEditing) {
        return (
            <div className="p-8 space-y-5 bg-[#7c6aef]/5 border-y border-[#7c6aef]/10">
                <textarea
                    className="w-full bg-black/40 border border-[#7c6aef]/30 rounded-2xl px-5 py-4 text-[13px] text-white focus:ring-0 min-h-[100px] italic"
                    value={editingForm.query_text}
                    onChange={(e) => setEditingForm((c) => ({ ...c, query_text: e.target.value }))}
                />
                <div className="flex gap-4">
                    <button onClick={() => onSave(prompt.id)} className={cn(COMMAND_BUTTONS.primary, "px-6")}>Appliquer</button>
                    <button onClick={() => setEditingId(null)} className={cn(COMMAND_BUTTONS.secondary, "px-6")}>Annuler</button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "group relative px-8 py-7 transition-all border border-transparent hover:border-white/10 hover:bg-white/[0.03] hover:shadow-[0_0_40px_rgba(255,255,255,0.02)] rounded-2xl mb-2",
            !prompt.is_active && "opacity-30 grayscale"
        )}>
            <div className="flex items-start gap-6">
                <div className={cn("mt-2.5 h-1.5 w-1.5 rounded-full shrink-0", promptStatusDotClass(prompt))} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest", lifecycle.cls)}>{lifecycle.text}</span>
                        {prompt.last_run?.target_found && <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">Target Found</span>}
                    </div>
                    <p className="text-[15px] font-bold text-white/90 leading-relaxed group-hover:text-white transition-colors italic">"{prompt.query_text}"</p>
                    {(prompt.context_injected || prompt.last_run?.context_injected) && (
                        <div className="mt-3 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-300/80">
                            Contexte injecte - hors visibilite naturelle
                        </div>
                    )}

                    <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                            <ListIcon className="h-3.5 w-3.5" /> {prompt.category_label}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                            <ZapIcon className="h-3.5 w-3.5" /> {PROMPT_MODE_LABELS[mode]}
                        </div>
                        <div className={cn("flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest", discoveryModeTone(prompt))}>
                            <Radar className="h-3.5 w-3.5" /> {discoveryModeLabel(prompt)}
                        </div>
                        {prompt.last_run && (
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                                <ActivityIcon className="h-3.5 w-3.5 text-white/10" />
                                <span className={execStatus.cls}>{execStatus.label}</span>
                                <span className="text-white/10">· {new Date(prompt.last_run.created_at).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button onClick={() => onRun(prompt)} disabled={isRunning} className="p-2.5 text-[#7c6aef] hover:bg-[#7c6aef]/10 rounded-xl transition-colors" title="Lancer audit"><PlayIcon className="h-4 w-4" /></button>
                    <button onClick={() => onImprove(prompt)} disabled={isImproving} className={cn("p-2.5 rounded-xl transition-colors", isImproving ? "text-[#7c6aef] animate-pulse bg-[#7c6aef]/10" : "text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-400/10")} title="Améliorer avec IA"><SparklesIcon className="h-4 w-4" /></button>
                    <button onClick={() => { setEditingId(prompt.id); setEditingForm({ ...prompt, prompt_mode: mode }); }} className="p-2.5 text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-colors"><Edit3Icon className="h-4 w-4" /></button>
                    <button onClick={() => onToggle(prompt.id, !prompt.is_active)} className="p-2.5 text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-colors"><PauseIcon className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(prompt.id)} className="p-2.5 text-rose-400/30 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-colors"><Trash2Icon className="h-4 w-4" /></button>
                </div>
            </div>

            {improvedText && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 ml-8 p-4 rounded-xl border border-[#7c6aef]/20 bg-[#7c6aef]/5 space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#7c6aef]">
                        <SparklesIcon className="h-3 w-3" />
                        Suggestion IA
                    </div>
                    <p className="text-[13px] text-white/90 italic leading-relaxed">"{improvedText}"</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onUseImproved(prompt.id, improvedText)}
                            className="text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 bg-[#7c6aef] text-white rounded-lg hover:bg-[#7c6aef]/80 transition-all"
                        >
                            Utiliser
                        </button>
                        <button
                            onClick={() => onClearImprovement(prompt.id)}
                            className="text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 text-white/40 hover:text-white transition-all"
                        >
                            Ignorer
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

export default function GeoPromptsView() {
    const { clientId, invalidateWorkspace, client } = useGeoClient();
    const { data, loading, error } = useGeoWorkspaceSlice('prompts');
    const [form, setForm] = useState(DEFAULT_FORM);
    const [editingId, setEditingId] = useState(null);
    const [editingForm, setEditingForm] = useState(DEFAULT_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [runningPromptId, setRunningPromptId] = useState(null);
    const [runningBatch, setRunningBatch] = useState(false);
    const [improvingId, setImprovingId] = useState(null);
    const [improvements, setImprovements] = useState({});

    const prompts = data?.prompts || [];
    const hasActivePrompt = prompts.some(p => p.is_active);

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Registre de Prompts"
            subtitle="Pilotage de la sémantique d'audit et centre de contrôle des requêtes suivies."
            actions={(
                <div className="flex gap-2">
                    <Link href={`/admin/clients/${clientId}/geo/runs`} className={COMMAND_BUTTONS.secondary}><History className="h-4 w-4" /> Historique</Link>
                    <button
                        onClick={async () => {
                            setRunningBatch(true);
                            try {
                                await fetch('/api/admin/queries/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) });
                                invalidateWorkspace();
                            } catch {} finally { setRunningBatch(false); }
                        }}
                        disabled={!hasActivePrompt || runningBatch}
                        className={COMMAND_BUTTONS.primary}
                    >
                        <Play className={cn("h-4 w-4", runningBatch && "animate-pulse")} />
                        {runningBatch ? 'Batch...' : 'Exécuter les actifs'}
                    </button>
                </div>
            )}
        />
    );

    if (loading) return <CommandPageShell header={header}><div className="p-8 animate-pulse text-white/50">Lecture du registre sémantique...</div></CommandPageShell>;
    if (error) return <CommandPageShell header={header}><CommandEmptyState title="Indisponible" description={error} /></CommandPageShell>;

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CommandMetricCard label="Inventaire" value={data.summary?.total || 0} detail="Total prompts" tone="info" />
                <CommandMetricCard label="Performance" value={`${data.summary?.mentionRatePercent || 0}%`} detail="Taux cible" tone="ok" />
                <CommandMetricCard label="Critique" value={data.summary?.weakPromptCount || 0} detail="À renforcer" tone="critical" />
                <CommandMetricCard label="Inactifs" value={prompts.filter(p => !p.is_active).length} detail="En pause" tone="neutral" />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4 flex flex-col gap-4 pb-10">
                    <PromptCreationSurface
                        form={form} setForm={setForm}
                        categoryOptions={data.categoryOptions}
                        discoveryModeOptions={data.discoveryModeOptions}
                        submitting={submitting}
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setSubmitting(true);
                            try {
                                await fetch('/api/admin/queries/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, ...form }) });
                                setForm(DEFAULT_FORM);
                                invalidateWorkspace();
                            } catch {} finally { setSubmitting(false); }
                        }}
                        client={client}
                    />

                    <AiPromptListSurface
                        client={client}
                        clientId={clientId}
                        invalidateWorkspace={invalidateWorkspace}
                        categoryOptions={data.categoryOptions}
                        submitting={submitting}
                    />

                    {data.starterPack?.prompts?.length > 0 && (
                        <div className={cn(COMMAND_PANEL, "p-6 bg-[#06070a]")}>
                            <div className="flex items-center gap-2 mb-6 text-emerald-400">
                                <SparklesIcon className="h-4 w-4" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">Starter Pack</h3>
                            </div>
                            <div className="space-y-3">
                                {data.starterPack.prompts.map((p, i) => (
                                    <div key={i} className={cn(COMMAND_SURFACE, "p-4 group hover:bg-white/[0.04] transition-all cursor-pointer")} onClick={() => setForm(c => ({ ...c, query_text: p.query_text, category: p.category || c.category, discovery_mode: p.discovery_mode || c.discovery_mode }))}>
                                        <p className="text-[11px] text-white/50 group-hover:text-white transition-colors italic">"{p.query_text}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={cn(COMMAND_PANEL, "lg:col-span-8 p-0 bg-[#06070a]")}>
                    <div className="px-8 py-4 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ListIcon className="h-4 w-4 text-[#7c6aef]" />
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">Registre Sémantique</h3>
                        </div>
                        <div className="text-[10px] font-bold text-white/10 uppercase tracking-widest">{prompts.length} PROMPTS ACTIFS</div>
                    </div>

                    <div className="divide-y divide-white/[0.03]">
                        {prompts.length === 0 ? (
                            <CommandEmptyState title="Registre vide" description="Ajoutez votre premier prompt d'audit pour démarrer le suivi." />
                        ) : prompts.map((p) => (
                             <TrackedPromptRow
                                key={p.id} prompt={p}
                                categoryOptions={data.categoryOptions}
                                isEditing={editingId === p.id}
                                editingForm={editingForm}
                                setEditingForm={setEditingForm}
                                setEditingId={setEditingId}
                                submitting={submitting}
                                isRunning={runningPromptId === p.id}
                                onSave={async (id) => {
                                    setSubmitting(true);
                                    try {
                                        await fetch('/api/admin/queries/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...editingForm }) });
                                        setEditingId(null);
                                        invalidateWorkspace();
                                    } catch {} finally { setSubmitting(false); }
                                }}
                                onToggle={async (id, s) => {
                                    setSubmitting(true);
                                    try {
                                        await fetch('/api/admin/queries/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: s }) });
                                        invalidateWorkspace();
                                    } catch {} finally { setSubmitting(false); }
                                }}
                                onDelete={async (id) => {
                                    if (!confirm('Supprimer ce prompt ?')) return;
                                    setSubmitting(true);
                                    try {
                                        await fetch('/api/admin/queries/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
                                        invalidateWorkspace();
                                    } catch {} finally { setSubmitting(false); }
                                }}
                                onRun={async (p) => {
                                    setRunningPromptId(p.id);
                                    try {
                                        await fetch('/api/admin/queries/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, trackedQueryId: p.id }) });
                                        invalidateWorkspace();
                                    } catch {} finally { setRunningPromptId(null); }
                                }}
                                onImprove={async (p) => {
                                    setImprovingId(p.id);
                                    try {
                                        const response = await fetch('/api/admin/clients/onboarding/suggest-prompt', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                current_query: p.query_text,
                                                business_name: client?.client_name || '',
                                                business_type: client?.business_type || '',
                                                intent_family: p.category || '',
                                                prompt_mode: p.prompt_mode || 'user_like',
                                            }),
                                        });
                                        const json = await parseJsonResponse(response);
                                        if (json.suggestion) {
                                            setImprovements(prev => ({ ...prev, [p.id]: json.suggestion }));
                                        }
                                    } catch {} finally { setImprovingId(null); }
                                }}
                                isImproving={improvingId === p.id}
                                improvedText={improvements[p.id]}
                                onUseImproved={async (id, text) => {
                                    setSubmitting(true);
                                    try {
                                        await fetch('/api/admin/queries/update', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id, query_text: text })
                                        });
                                        setImprovements(prev => {
                                            const next = { ...prev };
                                            delete next[id];
                                            return next;
                                        });
                                        invalidateWorkspace();
                                    } catch {} finally { setSubmitting(false); }
                                }}
                                onClearImprovement={(id) => {
                                    setImprovements(prev => {
                                        const next = { ...prev };
                                        delete next[id];
                                        return next;
                                    });
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </CommandPageShell>
    );
}
