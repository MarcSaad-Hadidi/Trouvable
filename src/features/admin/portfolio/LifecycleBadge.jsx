'use client';

import { LIFECYCLE_META } from '@/lib/lifecycle';

const BADGE_STYLES = {
    prospect: 'bg-indigo-500/10 text-indigo-300/80 border-indigo-500/20',
    onboarding: 'bg-amber-500/10 text-amber-300/80 border-amber-500/20',
    active: 'bg-emerald-500/10 text-emerald-300/80 border-emerald-500/20',
    paused: 'bg-white/[0.05] text-white/50 border-white/[0.08]',
    archived: 'bg-red-500/10 text-red-300/60 border-red-500/15',
};

const DOT_STYLES = {
    prospect: 'bg-indigo-400',
    onboarding: 'bg-amber-400',
    active: 'bg-emerald-400',
    paused: 'bg-white/30',
    archived: 'bg-red-400',
};

export default function LifecycleBadge({ status, size = 'sm' }) {
    const state = status || 'prospect';
    const meta = LIFECYCLE_META[state];
    const label = meta?.label || state;
    const cls = BADGE_STYLES[state] || BADGE_STYLES.prospect;
    const dot = DOT_STYLES[state] || DOT_STYLES.prospect;

    const sizeClasses = size === 'sm'
        ? 'text-[9px] px-2 py-[3px]'
        : 'text-[10px] px-2.5 py-[4px]';

    return (
        <span
            className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-[0.06em] rounded-md border ${cls} ${sizeClasses}`}
            title={meta?.description}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
            {label}
        </span>
    );
}
