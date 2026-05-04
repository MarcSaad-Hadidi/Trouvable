'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, Copy, ExternalLink, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { TASK_TYPE_LABELS, VARIANTS } from '@/lib/correction-prompts/problem-ref';
import { renderCorrectionPromptVariant } from '@/lib/correction-prompts/render';

import { buildCorrectionPromptsHref, useIssueHandoff } from '@/features/admin/dashboard/shared/context/IssueHandoffContext';

/**
 * L'API renvoie souvent des variantes structurées { mission, contexte, …, text }.
 * React ne peut pas afficher l'objet brut dans un <pre> — on extrait `text` ou
 * on recompose le texte à partir de la structure.
 */
function normalizePromptForDisplay(raw) {
    if (raw == null) return '';
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw === 'object' && typeof raw.text === 'string' && raw.text.trim()) {
        return raw.text.trim();
    }
    if (typeof raw === 'object') {
        try {
            return renderCorrectionPromptVariant(raw);
        } catch {
            try {
                return JSON.stringify(raw, null, 2);
            } catch {
                return '';
            }
        }
    }
    return String(raw);
}

/**
 * IssueActionsDrawer — drawer universel monté au niveau layout admin.
 * Se déclenche via `useIssueHandoff().openHandoff(ref)`.
 *
 * Phase 1 : drawer simple, génère un prompt via l'API correction-prompt
 * (en mode `ref: ProblemRef`). Laisse la page `seo/correction-prompts`
 * en place pour la fouille approfondie / historique.
 */

function TaskTypeBadge({ value }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-violet-200">
            {TASK_TYPE_LABELS[value] || value}
        </span>
    );
}

function SourceBadge({ source }) {
    const labels = {
        seo_health_issue: 'SEO Health',
        lab_layer1_check: 'Lab Layer 1',
        lab_layer2_finding: 'Lab Layer 2',
        seo_opportunity: 'Opportunité SEO',
        seo_cannibalization: 'Cannibalisation SEO',
        seo_on_page: 'On-page SEO',
        geo_opportunity: 'Opportunité GEO',
        geo_readiness_blocker: 'GEO readiness',
        geo_consistency_gap: 'Cohérence GEO',
        geo_alert: 'Alerte GEO',
        agent_fix: 'Agent fix',
        audit_priority_problem: 'Problème prioritaire',
    };
    return (
        <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/70">
            {labels[source] || source}
        </span>
    );
}

function PromptVariantCard({ label, content, accent, onCopy, copied }) {
    return (
        <div className={`rounded-xl border ${accent} p-3`}>
            <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{label}</div>
                <button
                    type="button"
                    onClick={onCopy}
                    className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/72 hover:border-white/[0.2] hover:bg-white/[0.08]"
                >
                    {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copié' : 'Copier'}
                </button>
            </div>
            <pre className="geo-scrollbar mt-2 max-h-80 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 pr-2 text-[11px] leading-relaxed text-white/88">
                {content}
            </pre>
        </div>
    );
}

export default function IssueActionsDrawer() {
    const { open, ref, closeHandoff } = useIssueHandoff();
    const [variant, setVariant] = useState('standard');
    const [state, setState] = useState('idle'); // idle | loading | done | error
    const [payload, setPayload] = useState(null);
    const [error, setError] = useState(null);
    const [copiedVariant, setCopiedVariant] = useState(null);

    useEffect(() => {
        if (!open) return;
        setState('idle');
        setPayload(null);
        setError(null);
        setCopiedVariant(null);
        setVariant(ref?.presetVariant || 'standard');
    }, [open, ref?.presetVariant]);

    useEffect(() => {
        if (!open || !ref) return;
        if (!ref.autoGenerate) return;
        if (state !== 'idle') return;
        handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, ref?.autoGenerate]);

    async function handleGenerate() {
        if (!ref?.clientId) return;
        setState('loading');
        setError(null);
        setPayload(null);

        try {
            const response = await fetch(`/api/admin/seo/client/${ref.clientId}/correction-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ref: { ...ref, presetVariant: variant },
                    triggerSource: 'drawer',
                }),
            });

            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(json.error || `Erreur ${response.status}`);
            }

            setPayload(json);
            setState('done');
        } catch (requestError) {
            setError(requestError.message || 'Génération impossible');
            setState('error');
        }
    }

    function copyVariant(key, content) {
        if (!content) return;
        try {
            navigator.clipboard.writeText(content);
            setCopiedVariant(key);
            setTimeout(() => setCopiedVariant(null), 1600);
        } catch {
            // ignore
        }
    }

    if (!open) return null;

    const standardRaw = payload?.prompts?.standard ?? payload?.prompts?.user ?? null;
    const strictRaw = payload?.prompts?.strict ?? null;
    const standardPromptText = normalizePromptForDisplay(standardRaw);
    const strictPromptText = normalizePromptForDisplay(strictRaw);
    const contextSummary = payload?.contextSummary || null;
    const fullHref = ref ? buildCorrectionPromptsHref(ref.clientId, ref, { handoffUi: 'page' }) : '#';

    return (
        <div className="fixed inset-0 z-[120] flex">
            <button
                type="button"
                aria-label="Fermer"
                onClick={closeHandoff}
                className="flex-1 bg-black/55 backdrop-blur-sm transition-opacity"
            />
            <aside className="flex h-full min-h-0 w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-[#0b0b0d] text-white shadow-[0_0_80px_rgba(0,0,0,0.6)]">
                <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <SourceBadge source={ref?.source} />
                            {ref?.taskType ? <TaskTypeBadge value={ref.taskType} /> : null}
                        </div>
                        <h2 className="mt-2 text-[15px] font-semibold leading-snug text-white/92">
                            {ref?.label || 'Générer un prompt correctif'}
                        </h2>
                        <p className="mt-1 text-[11px] text-white/52">
                            Contexte pré-rempli. L&apos;opérateur n&apos;a qu&apos;à générer puis copier.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={closeHandoff}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-white/60 hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white"
                        aria-label="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="geo-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 pr-4 space-y-4 [scrollbar-gutter:stable]">
                    {ref && (
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Référence</div>
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                {ref.pageUrl && (
                                    <>
                                        <dt className="text-white/50">Page</dt>
                                        <dd className="truncate text-white/85" title={ref.pageUrl}>{ref.pageUrl}</dd>
                                    </>
                                )}
                                {ref.dimension && (
                                    <>
                                        <dt className="text-white/50">Dimension</dt>
                                        <dd className="text-white/85">{ref.dimension}</dd>
                                    </>
                                )}
                                {ref.category && (
                                    <>
                                        <dt className="text-white/50">Catégorie</dt>
                                        <dd className="text-white/85">{ref.category}</dd>
                                    </>
                                )}
                                {ref.checkId && (
                                    <>
                                        <dt className="text-white/50">Check L1</dt>
                                        <dd className="text-white/85">{ref.checkId}</dd>
                                    </>
                                )}
                                {ref.findingId && (
                                    <>
                                        <dt className="text-white/50">Finding L2</dt>
                                        <dd className="text-white/85">{ref.findingId}</dd>
                                    </>
                                )}
                                {ref.issueId && (
                                    <>
                                        <dt className="text-white/50">Issue</dt>
                                        <dd className="truncate text-white/85" title={ref.issueId}>{ref.issueId}</dd>
                                    </>
                                )}
                            </dl>
                        </section>
                    )}

                    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Variante</div>
                            <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
                                {VARIANTS.map((v) => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setVariant(v)}
                                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                                            variant === v
                                                ? 'bg-violet-500/20 text-violet-100'
                                                : 'text-white/60 hover:text-white/90'
                                        }`}
                                    >
                                        {v === 'standard' ? 'Standard' : 'Strict'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="mt-2 text-[11px] text-white/55">
                            {variant === 'strict'
                                ? 'Contraintes renforcées : aucune extrapolation, exige inspect-first strict.'
                                : 'Équilibrée : contraintes repo + validation + fix minimal.'}
                        </p>
                    </section>

                    {state === 'error' && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] p-3 text-[12px] text-red-200">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="font-semibold">Erreur</span>
                            </div>
                            <div className="mt-1 leading-relaxed">{error}</div>
                        </div>
                    )}

                    {state === 'done' && payload && (
                        <section className="space-y-3">
                            {standardPromptText ? (
                                <PromptVariantCard
                                    label="Variante standard"
                                    content={standardPromptText}
                                    accent="border-white/[0.08] bg-white/[0.02]"
                                    onCopy={() => copyVariant('standard', standardPromptText)}
                                    copied={copiedVariant === 'standard'}
                                />
                            ) : null}
                            {strictPromptText ? (
                                <PromptVariantCard
                                    label="Variante strict"
                                    content={strictPromptText}
                                    accent="border-amber-400/20 bg-amber-400/[0.03]"
                                    onCopy={() => copyVariant('strict', strictPromptText)}
                                    copied={copiedVariant === 'strict'}
                                />
                            ) : null}

                            {contextSummary && (
                                <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50 hover:text-white/80">
                                        Contexte injecté
                                    </summary>
                                    <pre className="geo-scrollbar mt-2 max-h-60 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 pr-2 text-[10.5px] leading-relaxed text-white/72">
                                        {JSON.stringify(contextSummary, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </section>
                    )}
                </div>

                <footer className="flex items-center gap-2 border-t border-white/[0.06] bg-black/30 px-5 py-3">
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={state === 'loading'}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-gradient-to-r from-violet-500/30 to-violet-500/20 px-3 py-2 text-[12px] font-semibold text-violet-100 hover:from-violet-500/40 hover:to-violet-500/30 disabled:opacity-60"
                    >
                        {state === 'loading' ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Génération…
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-3.5 w-3.5" />
                                {state === 'done' ? 'Régénérer' : 'Générer'}
                            </>
                        )}
                    </button>
                    <Link
                        href={fullHref}
                        onClick={closeHandoff}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/80 hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Page complète
                    </Link>
                </footer>
            </aside>
        </div>
    );
}
