'use client';

import { useState } from 'react';

/**
 * Shared primitives for the operator Audit Lab. Kept local to the lab so the
 * page can evolve a cohesive visual language without spilling experimental
 * styles into the broader admin component library.
 */

export function LabSectionHeader({ eyebrow, title, subtitle, variant = 'stable', right }) {
    const eyebrowTone = variant === 'diagnostic'
        ? 'text-amber-300/70'
        : variant === 'canonical'
        ? 'text-violet-300/70'
        : variant === 'debug'
        ? 'text-white/35'
        : 'text-emerald-300/70';

    return (
        <div className="mb-3 flex items-start justify-between gap-4">
            <div>
                {eyebrow && (
                    <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${eyebrowTone}`}>{eyebrow}</div>
                )}
                <div className="mt-0.5 text-[15px] font-bold text-white/90">{title}</div>
                {subtitle && (
                    <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/45">{subtitle}</p>
                )}
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    );
}

/**
 * Visual shell for a **stable product truth** section. Uses elevated admin
 * surface with a subtle violet accent so the operator eye lands here first.
 */
export function LabStableSection({ children, className = '' }) {
    return (
        <section className={`relative rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-5 shadow-[0_16px_48px_rgba(0,0,0,0.45)] before:absolute before:top-0 before:left-6 before:right-6 before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-400/30 before:to-transparent ${className}`}>
            {children}
        </section>
    );
}

/**
 * Visual shell for a **diagnostic** section. Dashed border + muted chrome so
 * it cannot be mistaken for the main product truth.
 *
 * @param {React.ReactNode} children
 * @param {string | false | null} [ribbon] — Court libellé au-dessus du cadre
 *   (ex. « Couche 1 »). Passez `false` ou `null` pour ne pas afficher de ruban
 *   quand `LabSectionHeader` porte déjà la référence de section (évite la
 *   duplication « Section B » deux fois).
 * @param {string} [className]
 */
export function LabDiagnosticSection({ children, ribbon = false, className = '' }) {
    const showRibbon = ribbon !== false && ribbon != null && String(ribbon).length > 0;
    return (
        <section className={`relative rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-5 ${className}`}>
            {showRibbon && (
                <div className="absolute -top-2.5 left-5 rounded-full border border-amber-400/20 bg-[#09090c] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300/75">
                    {ribbon}
                </div>
            )}
            {children}
        </section>
    );
}

export function LabCanonicalSection({ children, className = '' }) {
    return (
        <section className={`relative rounded-2xl border border-violet-400/[0.14] bg-gradient-to-br from-violet-500/[0.025] via-transparent to-transparent p-5 ${className}`}>
            <div className="absolute -top-2.5 left-5 rounded-full border border-violet-400/25 bg-[#09090c] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-violet-300/80">
                Objet canonique · couches 3–4
            </div>
            {children}
        </section>
    );
}

export function LabDebugSection({ children, className = '' }) {
    return (
        <section className={`rounded-2xl border border-white/[0.05] bg-[#0a0a0c] p-5 ${className}`}>
            {children}
        </section>
    );
}

export function LabCollapsible({ label, defaultOpen = false, children, hint }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
            >
                <div>
                    <div className="text-[12px] font-semibold text-white/75">{label}</div>
                    {hint && <div className="text-[10px] text-white/35">{hint}</div>}
                </div>
                <span className={`text-sm text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {open && <div className="border-t border-white/[0.06] p-4">{children}</div>}
        </div>
    );
}

export function LabPill({ label, tone = 'neutral' }) {
    const toneClass = tone === 'good' ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
        : tone === 'warn' ? 'bg-amber-400/10 text-amber-200 border-amber-400/20'
        : tone === 'bad' ? 'bg-red-400/10 text-red-300 border-red-400/20'
        : tone === 'info' ? 'bg-violet-400/10 text-violet-300 border-violet-400/20'
        : 'bg-white/[0.05] text-white/60 border-white/10';
    return (
        <span className={`inline-flex items-center leading-none rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.06em] ${toneClass}`}>
            {label}
        </span>
    );
}

export function LabMetric({ label, value, suffix, tone }) {
    const toneClass = tone || 'text-white/85';
    const displayValue = value === null || value === undefined || value === '' ? '—' : value;
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
                <span className={`font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold tabular-nums ${toneClass}`}>
                    {displayValue}
                </span>
                {suffix && <span className="text-[10px] text-white/30">{suffix}</span>}
            </div>
        </div>
    );
}

export function LabEmptyState({ title, description }) {
    return (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-4">
            <div className="text-[12px] font-semibold text-white/65">{title}</div>
            {description && <p className="mt-1 text-[11px] leading-relaxed text-white/40">{description}</p>}
        </div>
    );
}

export function JsonInspect({ value, maxHeight = 400 }) {
    const [expanded, setExpanded] = useState(false);
    let text;
    try {
        text = JSON.stringify(value, null, 2);
    } catch {
        text = String(value);
    }

    const maxStyle = expanded ? undefined : { maxHeight };

    return (
        <div className="rounded-lg border border-white/[0.06] bg-[#070708]">
            <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-white/35">JSON brut</span>
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-white/50 hover:text-white/80"
                >
                    {expanded ? 'Réduire' : 'Étendre'}
                </button>
            </div>
            <pre
                className="overflow-auto p-3 text-[11px] leading-relaxed text-white/70"
                style={maxStyle}
            >
                {text}
            </pre>
        </div>
    );
}
