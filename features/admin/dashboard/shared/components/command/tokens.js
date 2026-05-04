export function cn(...values) {
    return values.filter(Boolean).join(' ');
}

export const COMMAND_COLORS = {
    ok: '#4ade80',
    warning: '#f59e0b',
    critical: '#fb7185',
    info: '#60a5fa',
    neutral: '#cbd5e1',
    unavailable: '#64748b',
    violet: '#a78bfa',
};

export const COMMAND_SURFACE = 'rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,18,24,0.98)_0%,rgba(10,12,18,0.96)_100%)] shadow-[0_28px_72px_rgba(0,0,0,0.34)]';
export const COMMAND_SURFACE_SOFT = 'rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(13,15,21,0.96)_0%,rgba(9,11,16,0.94)_100%)] shadow-[0_20px_52px_rgba(0,0,0,0.28)]';
export const COMMAND_PANEL = 'rounded-[22px] border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
export const COMMAND_MUTED_PANEL = 'rounded-[20px] border border-white/[0.06] bg-white/[0.02]';

const TONE_CLASSES = {
    ok: {
        pill: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
        panel: 'border-emerald-300/20 bg-[linear-gradient(180deg,rgba(20,35,27,0.95)_0%,rgba(11,17,14,0.94)_100%)]',
        text: 'text-emerald-100',
        softText: 'text-emerald-200/75',
        dot: 'bg-emerald-300',
        ring: COMMAND_COLORS.ok,
    },
    warning: {
        pill: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
        panel: 'border-amber-300/20 bg-[linear-gradient(180deg,rgba(35,27,15,0.95)_0%,rgba(17,14,11,0.94)_100%)]',
        text: 'text-amber-100',
        softText: 'text-amber-200/75',
        dot: 'bg-amber-300',
        ring: COMMAND_COLORS.warning,
    },
    critical: {
        pill: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
        panel: 'border-rose-300/20 bg-[linear-gradient(180deg,rgba(36,18,22,0.96)_0%,rgba(19,11,14,0.94)_100%)]',
        text: 'text-rose-100',
        softText: 'text-rose-200/75',
        dot: 'bg-rose-300',
        ring: COMMAND_COLORS.critical,
    },
    info: {
        pill: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
        panel: 'border-sky-300/20 bg-[linear-gradient(180deg,rgba(14,24,37,0.95)_0%,rgba(10,14,20,0.94)_100%)]',
        text: 'text-sky-100',
        softText: 'text-sky-200/75',
        dot: 'bg-sky-300',
        ring: COMMAND_COLORS.info,
    },
    neutral: {
        pill: 'border-white/[0.10] bg-white/[0.04] text-white/[0.75]',
        panel: 'border-white/[0.08] bg-white/[0.03]',
        text: 'text-white/[0.9]',
        softText: 'text-white/[0.55]',
        dot: 'bg-white/[0.45]',
        ring: COMMAND_COLORS.neutral,
    },
    unavailable: {
        pill: 'border-slate-300/[0.15] bg-slate-500/10 text-slate-300/[0.75]',
        panel: 'border-slate-300/[0.12] bg-[linear-gradient(180deg,rgba(15,18,22,0.96)_0%,rgba(10,12,16,0.94)_100%)]',
        text: 'text-slate-200/[0.8]',
        softText: 'text-slate-300/[0.55]',
        dot: 'bg-slate-400/[0.65]',
        ring: COMMAND_COLORS.unavailable,
    },
};

export function getToneMeta(tone = 'neutral') {
    return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

export function getToneAccent(tone = 'neutral') {
    return getToneMeta(tone).ring;
}

export function getToneLabel(status = 'neutral') {
    if (status === 'ok') return 'Sain';
    if (status === 'warning') return 'Attention';
    if (status === 'critical') return 'Critique';
    if (status === 'info') return 'Info';
    if (status === 'unavailable') return 'Indisponible';
    return 'Stable';
}

export const COMMAND_TEXT = {
    eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-white/[0.4]',
    title: 'text-[clamp(1.75rem,4vw,3.25rem)] font-semibold tracking-[-0.05em] text-white',
    subtitle: 'text-[14px] leading-relaxed text-white/[0.62] sm:text-[15px]',
    section: 'text-[18px] font-semibold tracking-[-0.02em] text-white/[0.95]',
    body: 'text-[13px] leading-relaxed text-white/[0.58]',
    meta: 'text-[11px] font-medium text-white/[0.45]',
};

export const COMMAND_BUTTONS = {
    primary: 'inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.15] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#090b10] transition-colors hover:bg-white/90 hover:text-[#090b10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a]',
    secondary: 'inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-[12px] font-semibold text-white/[0.82] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a]',
    subtle: 'inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-transparent px-3 py-2 text-[12px] font-semibold text-white/[0.62] transition-colors hover:border-white/[0.10] hover:bg-white/[0.04] hover:text-white/[0.9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a]',
};
