/**
 * Trouvable Operator Design System v2 — Canonical JS Tokens
 *
 * Single source of truth for all design tokens consumed by JS/TSX components.
 * CSS custom properties live in admin-shell.css (--t-* namespace).
 * This file mirrors those values for use in Tailwind classes and inline styles.
 */

export type Tone = 'ok' | 'warning' | 'critical' | 'info' | 'neutral' | 'unavailable';
export type Discipline = 'seo' | 'geo' | 'agent' | 'shared';

export function cn(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(' ');
}

/* ── Raw Palette ── */

export const COMMAND_COLORS = {
    ok: '#10b981',       // High-saturation emerald
    warning: '#f59e0b',  // Vibrant amber
    critical: '#f43f5e', // Strong rose
    info: '#7c6aef',     // Electric violet
    neutral: '#9ca3af',  // Brighter grey
    unavailable: '#4b5563', 
    violet: '#7c6aef',   
    indigo: '#6366f1',   
    steel: '#38bdf8',    // Brighter sky
    orange: '#fb923c',   // Brighter orange
    agentIndigo: '#818cf8', 
    cyan: '#22d3ee',     
} as const;

/* ── Surface Tokens ── */

export const COMMAND_SURFACE = 'rounded-[20px] border border-white/[0.12] bg-[#060708] shadow-[0_32px_120px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]';
export const COMMAND_SURFACE_SOFT = 'rounded-[18px] border border-white/[0.1] bg-[#080808] shadow-[0_28px_90px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]';
export const COMMAND_PANEL = 'rounded-[16px] border border-white/[0.08] bg-[#0d0e12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
export const COMMAND_MUTED_PANEL = 'rounded-[14px] border border-white/[0.07] bg-white/[0.04]';

/* ── Service World (Discipline) Accents ── */

export const DISCIPLINE_ACCENTS = {
    seo: 'border-[#6b9cc5]/25 bg-[#6b9cc5]/10 text-[#a8cde5]',
    geo: 'border-[#7c6aef]/30 bg-[#7c6aef]/12 text-[#b8adff]',
    agent: 'border-[#d4874a]/25 bg-[#d4874a]/10 text-[#e8b888]',
    shared: 'border-white/[0.1] bg-white/[0.035] text-white/72',
} as const;

export const DISCIPLINE_META = {
    seo: { label: 'SEO / Google', accent: COMMAND_COLORS.steel, dot: 'bg-[#6b9cc5]' },
    geo: { label: 'IA / GEO', accent: COMMAND_COLORS.violet, dot: 'bg-[#7c6aef]' },
    agent: { label: 'Agent', accent: COMMAND_COLORS.orange, dot: 'bg-[#d4874a]' },
    shared: { label: 'Dossier', accent: COMMAND_COLORS.neutral, dot: 'bg-white/45' },
} as const;

/* ── Specialty Surfaces ── */

export const FIELD_SURFACE = 'rounded-xl border border-white/[0.08] bg-[#080808] text-white/86';
export const ATMOSPHERE_SURFACE = 'rounded-[16px] border border-white/[0.08] bg-[#080808]';
export const FORGE_SURFACE = 'rounded-[16px] border border-[#6b9cc5]/20 bg-[#6b9cc5]/[0.045]';

/* ── Tone Classes ── */

const TONE_CLASSES = {
    ok: {
        pill: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
        panel: 'border-emerald-500/25 bg-emerald-500/[0.06] shadow-[0_0_30px_rgba(16,185,129,0.05)]',
        text: 'text-emerald-400 font-black',
        softText: 'text-emerald-500/90',
        dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
        ring: COMMAND_COLORS.ok,
    },
    warning: {
        pill: 'border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
        panel: 'border-amber-500/25 bg-amber-500/[0.06] shadow-[0_0_30px_rgba(245,158,11,0.05)]',
        text: 'text-amber-400 font-black',
        softText: 'text-amber-500/90',
        dot: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]',
        ring: COMMAND_COLORS.warning,
    },
    critical: {
        pill: 'border-rose-500/40 bg-rose-500/15 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
        panel: 'border-rose-500/30 bg-rose-500/[0.08] shadow-[0_0_40px_rgba(244,63,94,0.1)]',
        text: 'text-rose-400 font-black',
        softText: 'text-rose-500/95',
        dot: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]',
        ring: COMMAND_COLORS.critical,
    },
    info: {
        pill: 'border-[#7c6aef]/50 bg-[#7c6aef]/20 text-[#d4ccff] shadow-[0_0_15px_rgba(124,106,239,0.15)]',
        panel: 'border-[#7c6aef]/30 bg-[#7c6aef]/[0.08] shadow-[0_0_30px_rgba(124,106,239,0.1)]',
        text: 'text-[#b8adff] font-black',
        softText: 'text-[#7c6aef]/90',
        dot: 'bg-[#7c6aef] shadow-[0_0_12px_rgba(124,106,239,0.8)]',
        ring: COMMAND_COLORS.info,
    },
    neutral: {
        pill: 'border-white/20 bg-white/10 text-white shadow-sm',
        panel: 'border-white/10 bg-white/[0.04]',
        text: 'text-white font-bold',
        softText: 'text-white/60',
        dot: 'bg-white/60',
        ring: COMMAND_COLORS.neutral,
    },
    unavailable: {
        pill: 'border-white/10 bg-white/5 text-white/40',
        panel: 'border-white/5 bg-white/[0.02]',
        text: 'text-white/40',
        softText: 'text-white/30',
        dot: 'bg-white/20',
        ring: COMMAND_COLORS.unavailable,
    },
} as const;

export function getToneMeta(tone: Tone = 'neutral') {
    return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

export function getToneAccent(tone: Tone = 'neutral') {
    return getToneMeta(tone).ring;
}

export function getToneLabel(status: Tone = 'neutral') {
    if (status === 'ok') return 'Sain';
    if (status === 'warning') return 'Attention';
    if (status === 'critical') return 'Critique';
    if (status === 'info') return 'Info';
    if (status === 'unavailable') return 'Indisponible';
    return 'Stable';
}

/* ── Typography ── */

export const COMMAND_TEXT = {
    eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c6aef]',
    title: 'text-[clamp(1.75rem,3.5vw,2.25rem)] font-bold tracking-[-0.04em] text-white',
    subtitle: 'text-[13px] leading-relaxed text-white/52 sm:text-[14px]',
    section: 'text-[15px] font-semibold tracking-[-0.01em] text-white/88',
    body: 'text-[13px] leading-relaxed text-white/58',
    meta: 'text-[11px] font-medium text-white/40',
} as const;

/* ── Buttons ── */

export const COMMAND_BUTTONS = {
    primary: 'inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#7c6aef]/45 bg-[#7c6aef] px-4 py-2.5 text-[12px] font-semibold text-white no-underline transition-colors hover:bg-[#8d7bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6aef]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000]',
    secondary: 'inline-flex items-center justify-center gap-2 rounded-[8px] border border-white/[0.1] bg-white/[0.045] px-4 py-2.5 text-[12px] font-semibold text-white/75 no-underline transition-colors hover:border-white/[0.18] hover:bg-white/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6aef]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000]',
    subtle: 'inline-flex items-center justify-center gap-2 rounded-[8px] border border-transparent bg-transparent px-3 py-2 text-[12px] font-semibold text-white/50 no-underline transition-colors hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6aef]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#000000]',
} as const;
