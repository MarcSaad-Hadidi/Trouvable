'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Bot,
    CheckCheck,
    ClipboardCopy,
    Eye,
    EyeOff,
    FileSearch,
    Gauge,
    Loader2,
    RefreshCcw,
    Route,
    ShieldCheck,
    Sparkles,
    TriangleAlert,
} from 'lucide-react';

import { getSeoActionClasses, SeoStatusBadge } from './SeoOpsPrimitives';

const VARIANT_META = {
    standard: {
        label: 'Standard',
        title: 'Correction guidee',
        description: 'Bon equilibre: guidance claire, execution fluide, perimetre controle.',
        detail: 'A utiliser pour corriger vite avec des contraintes solides, sans rigidite maximale.',
        tone: 'border-sky-300/24 bg-sky-400/10 text-sky-100',
    },
    strict: {
        label: 'Strict',
        title: 'Correction verrouillee',
        description: 'Contrainte forte: inspect-first, fix minimal, zero extrapolation.',
        detail: 'A utiliser quand le risque de derive est eleve ou quand la preuve est sensible.',
        tone: 'border-violet-300/24 bg-violet-400/12 text-violet-100',
    },
};

const TRUTH_LABELS = {
    observed: 'Observe',
    derived: 'Calcule',
    inferred: 'Infere',
    recommended: 'Recommande',
    unavailable: 'Indisponible',
};

const TRUTH_TONES = {
    observed: 'border-emerald-300/24 bg-emerald-400/10 text-emerald-100',
    derived: 'border-sky-300/24 bg-sky-400/10 text-sky-100',
    inferred: 'border-amber-300/24 bg-amber-400/10 text-amber-100',
    recommended: 'border-amber-300/24 bg-amber-400/10 text-amber-100',
    unavailable: 'border-white/[0.10] bg-white/[0.04] text-white/60',
};

const CONFIDENCE_TONES = {
    high: 'border-emerald-300/24 bg-emerald-400/10 text-emerald-100',
    medium: 'border-amber-300/24 bg-amber-400/10 text-amber-100',
    low: 'border-red-300/24 bg-red-400/10 text-red-100',
    unavailable: 'border-white/[0.10] bg-white/[0.04] text-white/60',
};

function normalizeLabel(value, fallback = 'indisponible') {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    return normalized || fallback;
}

function priorityBadgeStatus(value) {
    const normalized = normalizeLabel(value).toLowerCase();
    if (normalized === 'critical' || normalized === 'high') return 'critical';
    if (normalized === 'medium') return 'warning';
    if (normalized === 'low') return 'ok';
    return 'warning';
}

function truthChip(value) {
    const normalized = normalizeLabel(value).toLowerCase();
    return {
        label: TRUTH_LABELS[normalized] || normalized,
        tone: TRUTH_TONES[normalized] || TRUTH_TONES.unavailable,
    };
}

function confidenceChip(value) {
    const normalized = normalizeLabel(value).toLowerCase();
    if (normalized === 'high') return { label: 'Elevee', tone: CONFIDENCE_TONES.high };
    if (normalized === 'medium') return { label: 'Moyenne', tone: CONFIDENCE_TONES.medium };
    if (normalized === 'low') return { label: 'Faible', tone: CONFIDENCE_TONES.low };
    return { label: 'Indisponible', tone: CONFIDENCE_TONES.unavailable };
}

function VariantCard({ variantKey, activeVariant, onChange }) {
    const meta = VARIANT_META[variantKey];
    const active = activeVariant === variantKey;

    return (
        <button
            type="button"
            onClick={() => onChange(variantKey)}
            className={`group relative rounded-[22px] border p-4 text-left transition-all duration-200 ${
                active
                    ? 'border-white/[0.20] bg-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.28)]'
                    : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06]'
            }`}
            aria-pressed={active}
        >
            <div className="flex items-start justify-between gap-3">
                <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${meta.tone}`}
                >
                    {meta.label}
                </span>
                {active ? <CheckCheck className="h-4 w-4 text-sky-200" aria-hidden="true" /> : null}
            </div>
            <div className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-white/94">{meta.title}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-white/66">{meta.description}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-white/52">{meta.detail}</div>
        </button>
    );
}

function MetaRow({ payload }) {
    const validationStatus = payload?.validation?.status || 'invalid';
    const validationLabel =
        validationStatus === 'valid'
            ? 'Validation OK'
            : validationStatus === 'partial'
              ? 'Validation partielle'
              : 'Validation invalide';

    return (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/52">
            <SeoStatusBadge status={validationStatus === 'valid' ? 'ok' : 'warning'} label={validationLabel} />
            {payload?.meta?.provider ? (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                    {payload.meta.provider}
                </span>
            ) : null}
            {payload?.meta?.model ? (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                    {payload.meta.model}
                </span>
            ) : null}
            {payload?.meta?.latencyMs ? (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                    {payload.meta.latencyMs} ms
                </span>
            ) : null}
        </div>
    );
}

function ContextMetaItem({ label, value, valueClassName = 'text-white/88' }) {
    return (
        <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">{label}</div>
            <div className={`mt-1.5 text-[12px] font-medium ${valueClassName}`}>{value}</div>
        </div>
    );
}

function SurfaceList({ title, icon = null, items = [], emptyLabel }) {
    return (
        <article className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/46">
                {icon}
                {title}
            </div>
            {items.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-white/78">
                    {items.map((item) => (
                        <li key={item} className="rounded-[12px] border border-white/[0.08] bg-black/24 px-2.5 py-1.5">
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="mt-3 text-[12px] leading-relaxed text-white/52">{emptyLabel}</div>
            )}
        </article>
    );
}

export default function CorrectionPromptGenerator({ clientId, issue, autoGenerate = false }) {
    const [state, setState] = useState('idle');
    const [error, setError] = useState(null);
    const autoGenerateTriggeredRef = useRef(false);
    const [errorDetails, setErrorDetails] = useState([]);
    const [payload, setPayload] = useState(null);
    const [activeVariant, setActiveVariant] = useState('standard');
    const [isExpanded, setIsExpanded] = useState(true);
    const [copyState, setCopyState] = useState('idle');

    const copyTimeoutRef = useRef(null);

    useEffect(
        () => () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        },
        [],
    );

    // Auto-lancement quand autoGenerate passe à true (par ex. via query param
    // ?auto=1 dans l'URL). Ne re-tire pas tant que l'issue n'a pas changé.
    useEffect(() => {
        if (!autoGenerate) {
            autoGenerateTriggeredRef.current = false;
            return;
        }
        if (!clientId || !issue?.id) return;
        if (autoGenerateTriggeredRef.current) return;
        if (state !== 'idle') return;
        autoGenerateTriggeredRef.current = true;
        handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoGenerate, clientId, issue?.id]);

    useEffect(() => {
        autoGenerateTriggeredRef.current = false;
    }, [issue?.id]);

    const selectedPrompt = useMemo(() => payload?.prompts?.[activeVariant]?.text || '', [activeVariant, payload]);
    const selectedVariantMeta = VARIANT_META[activeVariant] || VARIANT_META.standard;

    const resolvedIssue = useMemo(
        () => ({
            title: payload?.issue?.title || issue?.title || issue?.label || 'Probleme technique',
            category: normalizeLabel(payload?.issue?.category || issue?.category || 'seo'),
            priority: normalizeLabel(payload?.issue?.priority || issue?.priority || 'medium'),
            truthClass: normalizeLabel(
                payload?.issue?.truth_class ||
                    issue?.truth_class ||
                    payload?.contextSummary?.truthState ||
                    'unavailable',
            ),
            confidence: normalizeLabel(
                payload?.issue?.confidence || issue?.confidence || payload?.contextSummary?.confidence || 'unavailable',
            ),
        }),
        [issue, payload],
    );

    const contextSummary = payload?.contextSummary || null;
    const evidenceSummary = normalizeLabel(
        contextSummary?.evidenceSummary || issue?.evidence || 'Preuve indisponible dans ce contexte.',
        'Preuve indisponible dans ce contexte.',
    );
    const recommendedFix = normalizeLabel(
        contextSummary?.recommendedFix || issue?.recommendedFix || 'Correction a confirmer manuellement.',
        'Correction a confirmer manuellement.',
    );
    const truthMeta = truthChip(resolvedIssue.truthClass);
    const confidenceMeta = confidenceChip(resolvedIssue.confidence);
    const verifiedPaths = Array.isArray(contextSummary?.verifiedPaths) ? contextSummary.verifiedPaths : [];
    const repoFacts = Array.isArray(contextSummary?.repoFacts) ? contextSummary.repoFacts : [];
    const inspectionTargets = Array.isArray(contextSummary?.inspectionTargets) ? contextSummary.inspectionTargets : [];
    const validationTargets = Array.isArray(contextSummary?.validationTargets) ? contextSummary.validationTargets : [];
    const missingFields = Array.isArray(contextSummary?.missingFields) ? contextSummary.missingFields : [];

    async function handleGenerate() {
        if (!clientId || !issue?.id) return;

        setState('loading');
        setError(null);
        setErrorDetails([]);
        setCopyState('idle');

        try {
            const response = await fetch(`/api/admin/seo/client/${clientId}/correction-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issueId: issue.id }),
            });

            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                const requestError = new Error(json.error || `Erreur ${response.status}`);
                requestError.details = Array.isArray(json?.details) ? json.details : [];
                throw requestError;
            }

            setPayload(json);
            setState('done');
            setIsExpanded(true);
        } catch (requestError) {
            setPayload(null);
            setError(requestError.message || 'Generation impossible');
            setErrorDetails(Array.isArray(requestError.details) ? requestError.details : []);
            setState('error');
        }
    }

    async function handleCopy() {
        if (!selectedPrompt) return;

        try {
            await navigator.clipboard.writeText(selectedPrompt);
            setCopyState('copied');
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => setCopyState('idle'), 2200);
        } catch {
            setCopyState('error');
        }
    }

    return (
        <section className="mt-4 overflow-hidden rounded-[28px] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(11,14,18,0.98)_0%,rgba(8,10,14,0.96)_100%)] shadow-[0_28px_64px_rgba(0,0,0,0.32)]">
            <div className="relative border-b border-white/[0.08] px-4 py-5 sm:px-5 sm:py-6">
                <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-20 top-0 h-44 w-44 rounded-full bg-violet-400/10 blur-3xl" />
                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100/90">
                            <Sparkles className="h-3.5 w-3.5" />
                            Prompt de correction IA
                        </div>
                        <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-white/95">
                            Assistant premium de correction SEO Health
                        </h3>
                        <p className="text-[13px] leading-relaxed text-white/64">
                            Trouvable assemble le contexte reel du probleme, puis genere via Mistral un prompt pret a
                            donner a une IA de code.
                        </p>
                        <p className="text-[12px] leading-relaxed text-white/52">
                            Objectif operateur: comprendre vite, choisir la bonne variante, copier sans friction, agir
                            sans extrapolation.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {payload ? (
                            <button
                                type="button"
                                onClick={() => setIsExpanded((value) => !value)}
                                className={`${getSeoActionClasses('subtle')} px-3.5 py-2 text-[11px]`}
                            >
                                {isExpanded ? (
                                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                                ) : (
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {isExpanded ? 'Masquer le prompt' : 'Afficher le prompt'}
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={state === 'loading' || !clientId || !issue?.id}
                            className={`${getSeoActionClasses('primary')} px-4 py-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {state === 'loading' ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Generation...
                                </>
                            ) : (
                                <>
                                    <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                                    {payload ? 'Regenerer le prompt' : 'Generer le prompt'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
                <section className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <SeoStatusBadge
                            status={priorityBadgeStatus(resolvedIssue.priority)}
                            label={`Priorite ${resolvedIssue.priority}`}
                        />
                        <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${truthMeta.tone}`}
                        >
                            Verite {truthMeta.label}
                        </span>
                        <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${confidenceMeta.tone}`}
                        >
                            Confiance {confidenceMeta.label}
                        </span>
                    </div>

                    <div className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-white/94">
                        {resolvedIssue.title}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <ContextMetaItem label="Categorie" value={resolvedIssue.category} />
                        <ContextMetaItem label="Priorite" value={resolvedIssue.priority} />
                        <ContextMetaItem label="Truth class" value={resolvedIssue.truthClass} />
                        <ContextMetaItem label="Confiance" value={resolvedIssue.confidence} />
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-[18px] border border-white/[0.08] bg-black/24 p-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/44">
                                <FileSearch className="h-3.5 w-3.5" />
                                Preuve qui alimente le prompt
                            </div>
                            <div className="mt-2 text-[12px] leading-relaxed text-white/82">{evidenceSummary}</div>
                        </div>
                        <div className="rounded-[18px] border border-white/[0.08] bg-black/24 p-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/44">
                                <Bot className="h-3.5 w-3.5" />
                                Correction visee
                            </div>
                            <div className="mt-2 text-[12px] leading-relaxed text-white/82">{recommendedFix}</div>
                        </div>
                    </div>

                    {missingFields.length > 0 ? (
                        <div className="mt-3 rounded-[18px] border border-amber-300/18 bg-amber-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
                            Certaines donnees restent manquantes dans le contexte reel. Elles sont listees plus bas dans
                            la section Limites.
                        </div>
                    ) : null}
                </section>

                <section className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/44">
                        <Gauge className="h-3.5 w-3.5" />
                        Variantes du prompt
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-white/62">
                        Choix operateur: Standard pour une correction guidee et efficace, Strict pour une execution
                        fortement contrainte sans extrapolation.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <VariantCard variantKey="standard" activeVariant={activeVariant} onChange={setActiveVariant} />
                        <VariantCard variantKey="strict" activeVariant={activeVariant} onChange={setActiveVariant} />
                    </div>
                </section>

                {state === 'loading' ? (
                    <div className="rounded-[20px] border border-sky-300/18 bg-sky-400/10 px-3 py-3 text-[12px] leading-relaxed text-sky-100">
                        <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.1em] text-sky-100/92">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generation en cours
                        </div>
                        <div className="mt-2 text-sky-100/90">
                            Appel Mistral, normalisation structuree et verification du contrat de sortie avant
                            affichage.
                        </div>
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-[20px] border border-red-300/20 bg-red-400/10 px-3 py-3 text-[12px] leading-relaxed text-red-100">
                        <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.1em] text-red-50/92">
                            <TriangleAlert className="h-3.5 w-3.5" />
                            Generation rejetee
                        </div>
                        <div className="mt-1">{error}</div>
                        {errorDetails.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-red-50/92">
                                {errorDetails.map((item) => (
                                    <li key={item}>- {item}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}

                <section className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(5,6,8,0.96)_0%,rgba(6,8,11,0.94)_100%)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/42">
                                Prompt genere
                            </div>
                            <div className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-white/92">
                                {selectedVariantMeta.label}
                            </div>
                            <div className="mt-1 text-[12px] leading-relaxed text-white/62">
                                {selectedVariantMeta.description}
                            </div>
                        </div>

                        {payload && isExpanded ? (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className={`${getSeoActionClasses('secondary')} px-3.5 py-2 text-[11px]`}
                            >
                                <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                                {copyState === 'copied' ? 'Copie' : copyState === 'error' ? 'Echec copie' : 'Copier'}
                            </button>
                        ) : null}
                    </div>

                    {payload ? (
                        <div className="mt-3 space-y-3">
                            <MetaRow payload={payload} />

                            {payload?.validation?.status === 'partial' ? (
                                <div className="rounded-[18px] border border-amber-300/20 bg-amber-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
                                    <div className="font-semibold uppercase tracking-[0.1em] text-amber-50/92">
                                        Sortie IA normalisee
                                    </div>
                                    <div className="mt-1">
                                        La sortie brute etait partiellement hors contrat. Le prompt affiche a ete
                                        recentre sur le contexte deterministe SEO Health.
                                    </div>
                                    {payload?.validation?.warnings?.length ? (
                                        <ul className="mt-2 space-y-1 text-amber-50/92">
                                            {payload.validation.warnings.map((item) => (
                                                <li key={item}>- {item}</li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            ) : null}

                            {isExpanded ? (
                                selectedPrompt ? (
                                    <div className="max-h-[420px] overflow-auto rounded-[18px] border border-white/[0.10] bg-[#050608] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                        <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-white/82">
                                            {selectedPrompt}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[12px] leading-relaxed text-white/62">
                                        Aucune sortie exploitable pour cette variante.
                                    </div>
                                )
                            ) : (
                                <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-white/58">
                                    Prompt masque. Utilise &quot;Afficher le prompt&quot; pour lecture et copie.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-3 rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[12px] leading-relaxed text-white/58">
                            Aucun prompt genere pour l instant. Lance la generation pour obtenir la version{' '}
                            {selectedVariantMeta.label.toLowerCase()} prete a copier.
                        </div>
                    )}
                </section>

                <section className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/44">
                        <Route className="h-3.5 w-3.5" />
                        Chemins verifies et reperes repo
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-white/62">
                        Cette section montre ce qui ancre le prompt dans le repo reel: surfaces inspectees, preuves
                        structurees et validations minimales attendues.
                    </p>

                    {payload ? (
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <SurfaceList
                                title="Chemins verifies"
                                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                                items={verifiedPaths}
                                emptyLabel="Aucun chemin verifie n a ete confirme."
                            />
                            <SurfaceList
                                title="Reperes repo"
                                icon={<FileSearch className="h-3.5 w-3.5" />}
                                items={repoFacts}
                                emptyLabel="Aucun repere repo supplementaire disponible."
                            />
                            <SurfaceList
                                title="Surfaces connues a inspecter"
                                icon={<Bot className="h-3.5 w-3.5" />}
                                items={inspectionTargets}
                                emptyLabel="Aucune surface supplementaire listee."
                            />
                            <SurfaceList
                                title="Validation minimale attendue"
                                icon={<CheckCheck className="h-3.5 w-3.5" />}
                                items={validationTargets}
                                emptyLabel="Aucune validation explicite fournie."
                            />
                        </div>
                    ) : (
                        <div className="mt-3 rounded-[18px] border border-white/[0.08] bg-black/22 px-3 py-3 text-[12px] leading-relaxed text-white/56">
                            Les chemins verifies, reperes repo et validations apparaissent apres generation du prompt.
                        </div>
                    )}
                </section>

                <section className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/44">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        Limites et honnetete des donnees
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <article className="rounded-[18px] border border-emerald-300/16 bg-emerald-400/10 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-100/92">
                                Verifie
                            </div>
                            <div className="mt-2 text-[12px] leading-relaxed text-emerald-100/85">
                                {payload
                                    ? `${verifiedPaths.length} chemin(s) verifies, ${repoFacts.length} repere(s) repo, ${validationTargets.length} validation(s) minimale(s).`
                                    : 'Le statut verifie sera affiche apres generation, a partir du contexte reel SEO Health.'}
                            </div>
                        </article>
                        <article className="rounded-[18px] border border-amber-300/16 bg-amber-400/10 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-100/92">
                                Manquant ou non verifiable
                            </div>
                            {missingFields.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-amber-50/92">
                                    {missingFields.map((item) => (
                                        <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="mt-2 text-[12px] leading-relaxed text-amber-50/88">
                                    {payload
                                        ? 'Aucune donnee manquante explicite remontee par le contexte.'
                                        : 'Aucune liste de donnees manquantes disponible avant generation.'}
                                </div>
                            )}
                        </article>
                    </div>
                </section>
            </div>
        </section>
    );
}
