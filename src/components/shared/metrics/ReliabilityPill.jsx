'use client';

import { getReliabilityMeta } from '@/lib/operator-intelligence/reliability';

const TONE_CLASSES = {
    emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    blue: 'bg-sky-400/10 text-sky-300 border-sky-400/20',
    amber: 'bg-amber-400/10 text-amber-200 border-amber-400/20',
    slate: 'bg-white/[0.05] text-white/45 border-white/10',
};

export default function ReliabilityPill({ value, meta = null, className = '' }) {
    const resolved = meta || (value ? getReliabilityMeta(value) : null);
    if (!resolved?.label) return null;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${TONE_CLASSES[resolved.tone] || TONE_CLASSES.slate} ${className}`}
            title={resolved.description || resolved.label}
        >
            {resolved.shortLabel || resolved.label}
        </span>
    );
}
