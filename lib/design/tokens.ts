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
    ok: '#4ade80',       // Semantic green — stable, validated
    warning: '#d4a34a',  // Muted amber — attention states
    critical: '#e06060', // Coral — errors, critical mandates
    info: '#6b9cc5',     // Steel blue — SEO world, informational
    neutral: '#8e8f96',  // Text-2 level grey
    unavailable: '#4e4f55', // Text-3 level muted
    violet: '#7c6aef',   // Trouvable brand — GEO world
    indigo: '#6366f1',   // Brand secondary
    steel: '#6b9cc5',    // SEO world
    orange: '#d4874a',   // Agent world
    agentIndigo: '#818cf8', // Agent secondary
    cyan: '#06b6d4',     // Accent supplemental
} as const;

/* ── Surface Tokens ── */

export const COMMAND_SURFACE = 'rounded-[16px] border border-white/[0.085] bg-[#080808] shadow-[0_24px_78px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.04)]';
export const COMMAND_SURFACE_SOFT = 'rounded-[16px] border border-white/[0.08] bg-[#080808] shadow-[0_22px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]';
export const COMMAND_PANEL = 'rounded-[14px] border border-white/[0.07] bg-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
export const COMMAND_MUTED_PANEL = 'rounded-[12px] border border-white/[0.06] bg-white/[0.03]';

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
        pill: 'border-[#4ade80]/25 bg-[#4ade80]/10 text-[#a3f0bf]',
        panel: 'border-[#4ade80]/16 bg-[#4ade80]/[0.045]',
        text: 'text-[#a3f0bf]',
        softText: 'text-[#4ade80]/80',
        dot: 'bg-[#4ade80]',
        ring: COMMAND_COLORS.ok,
    },
    warning: {
        pill: 'border-[#d4a34a]/25 bg-[#d4a34a]/10 text-[#ecd29b]',
        panel: 'border-[#d4a34a]/16 bg-[#d4a34a]/[0.045]',
        text: 'text-[#ecd29b]',
        softText: 'text-[#d4a34a]/80',
        dot: 'bg-[#d4a34a]',
        ring: COMMAND_COLORS.warning,
    },
    critical: {
        pill: 'border-[#e06060]/25 bg-[#e06060]/10 text-[#f0a8a8]',
        panel: 'border-[#e06060]/18 bg-[#e06060]/[0.05]',
        text: 'text-[#f0a8a8]',
        softText: 'text-[#e06060]/82',
        dot: 'bg-[#e06060]',
        ring: COMMAND_COLORS.critical,
    },
    info: {
        pill: 'border-[#6b9cc5]/25 bg-[#6b9cc5]/10 text-[#a8cde5]',
        panel: 'border-[#6b9cc5]/16 bg-[#6b9cc5]/[0.045]',
        text: 'text-[#a8cde5]',
        softText: 'text-[#6b9cc5]/82',
        dot: 'bg-[#6b9cc5]',
        ring: COMMAND_COLORS.info,
    },
    neutral: {
        pill: 'border-white/[0.1] bg-white/[0.04] text-white/62',
        panel: 'border-white/[0.07] bg-white/[0.025]',
        text: 'text-white/84',
        softText: 'text-white/48',
        dot: 'bg-white/38',
        ring: COMMAND_COLORS.neutral,
    },
    unavailable: {
        pill: 'border-white/[0.07] bg-white/[0.025] text-white/38',
        panel: 'border-white/[0.055] bg-white/[0.018]',
        text: 'text-white/45',
        softText: 'text-white/34',
        dot: 'bg-white/24',
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
