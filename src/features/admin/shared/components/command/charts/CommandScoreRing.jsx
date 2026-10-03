'use client';

import { motion } from 'framer-motion';

import { COMMAND_COLORS, cn } from '../tokens';

export default function CommandScoreRing({
    value,
    label = 'Score',
    caption = null,
    size = 168,
    strokeWidth = 12,
    tone = 'info',
}) {
    const numericValue = typeof value === 'number' && Number.isFinite(value)
        ? Math.min(100, Math.max(0, value))
        : null;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * Math.PI * 2;
    const progress = numericValue == null ? 0 : circumference - (numericValue / 100) * circumference;
    const accent = COMMAND_COLORS[tone] || COMMAND_COLORS.info;

    return (
        <div className="relative inline-flex flex-col items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <defs>
                    <linearGradient id={`command-score-${tone}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={accent} stopOpacity="1" />
                        <stop offset="100%" stopColor={COMMAND_COLORS.violet} stopOpacity="0.9" />
                    </linearGradient>
                </defs>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={strokeWidth}
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#command-score-${tone})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: progress }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    strokeDasharray={circumference}
                />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/[0.38]">{label}</div>
                <div className={cn('mt-1 text-[clamp(2.25rem,5vw,3.6rem)] font-semibold tracking-[-0.07em] text-white', numericValue == null && 'text-white/[0.28]')}>
                    {numericValue == null ? 'n.d.' : numericValue}
                </div>
                {caption ? <div className="mt-1 max-w-[110px] text-center text-[11px] leading-snug text-white/[0.48]">{caption}</div> : null}
            </div>
        </div>
    );
}
