export type Tone = 'ok' | 'warning' | 'critical' | 'info' | 'neutral' | 'unavailable';
export type Discipline = 'seo' | 'geo' | 'agent' | 'shared';

export function cn(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(' ');
}

export const COMMAND_COLORS = {
    ok: '#16a34a',
    warning: '#d97706',
    critical: '#dc2626',
    info: '#2563eb',
    neutral: '#64748b',
    unavailable: '#64748b',
    violet: '#7c3aed',
    cyan: '#0891b2',
    orange: '#f97316',
    indigo: '#4f46e5',
} as const;

export const COMMAND_SURFACE = 'rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]';
export const COMMAND_SURFACE_SOFT = 'rounded-[20px] border border-slate-200 bg-slate-50 shadow-[0_18px_46px_rgba(15,23,42,0.08)]';
export const COMMAND_PANEL = 'rounded-[18px] border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';
export const COMMAND_MUTED_PANEL = 'rounded-[16px] border border-slate-200 bg-slate-50';

export const DISCIPLINE_ACCENTS = {
    seo: 'border-blue-200 bg-blue-50 text-blue-700',
    geo: 'border-violet-200 bg-violet-50 text-violet-700',
    agent: 'border-orange-200 bg-orange-50 text-orange-700',
    shared: 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

export const DISCIPLINE_META = {
    seo: { label: 'Visibilite Google / SEO', accent: COMMAND_COLORS.info, dot: 'bg-blue-500' },
    geo: { label: 'Visibilite IA / GEO', accent: COMMAND_COLORS.violet, dot: 'bg-violet-500' },
    agent: { label: 'Agent', accent: COMMAND_COLORS.orange, dot: 'bg-orange-500' },
    shared: { label: 'Dossier', accent: COMMAND_COLORS.neutral, dot: 'bg-slate-400' },
} as const;

export const FIELD_SURFACE = 'rounded-xl border border-slate-200 bg-white text-slate-900';
export const ATMOSPHERE_SURFACE = 'rounded-[20px] border border-slate-200 bg-slate-50';
export const FORGE_SURFACE = 'rounded-[20px] border border-blue-200 bg-blue-50';

const TONE_CLASSES = {
    ok: {
        pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        panel: 'border-emerald-200 bg-emerald-50/70',
        text: 'text-emerald-700',
        softText: 'text-emerald-700/75',
        dot: 'bg-emerald-500',
        ring: COMMAND_COLORS.ok,
    },
    warning: {
        pill: 'border-amber-200 bg-amber-50 text-amber-700',
        panel: 'border-amber-200 bg-amber-50/70',
        text: 'text-amber-700',
        softText: 'text-amber-700/75',
        dot: 'bg-amber-500',
        ring: COMMAND_COLORS.warning,
    },
    critical: {
        pill: 'border-red-200 bg-red-50 text-red-700',
        panel: 'border-red-200 bg-red-50/70',
        text: 'text-red-700',
        softText: 'text-red-700/75',
        dot: 'bg-red-500',
        ring: COMMAND_COLORS.critical,
    },
    info: {
        pill: 'border-blue-200 bg-blue-50 text-blue-700',
        panel: 'border-blue-200 bg-blue-50/70',
        text: 'text-blue-700',
        softText: 'text-blue-700/75',
        dot: 'bg-blue-500',
        ring: COMMAND_COLORS.info,
    },
    neutral: {
        pill: 'border-slate-200 bg-slate-50 text-slate-600',
        panel: 'border-slate-200 bg-slate-50/70',
        text: 'text-slate-800',
        softText: 'text-slate-500',
        dot: 'bg-slate-400',
        ring: COMMAND_COLORS.neutral,
    },
    unavailable: {
        pill: 'border-slate-200 bg-slate-100 text-slate-500',
        panel: 'border-slate-200 bg-slate-100/70',
        text: 'text-slate-600',
        softText: 'text-slate-500',
        dot: 'bg-slate-400',
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

export const COMMAND_TEXT = {
    eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500',
    title: 'text-[clamp(1.75rem,4vw,3.25rem)] font-semibold text-slate-950',
    subtitle: 'text-[14px] leading-relaxed text-slate-600 sm:text-[15px]',
    section: 'text-[18px] font-semibold text-slate-900',
    body: 'text-[13px] leading-relaxed text-slate-600',
    meta: 'text-[11px] font-medium text-slate-500',
} as const;

export const COMMAND_BUTTONS = {
    primary: 'inline-flex items-center justify-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    secondary: 'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    subtle: 'inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-transparent px-3 py-2 text-[12px] font-semibold text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
} as const;
