'use client';

import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function ScoreRing({
    value,
    max = 100,
    size = 72,
    strokeWidth = 5,
    color = '#34d399',
    trackColor = 'rgba(255,255,255,0.04)',
    label,
    className = '',
}) {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const pct = value != null ? Math.min(100, Math.max(0, (value / max) * 100)) : null;
    const offset = pct != null ? c - (pct / 100) * c : c;

    return (
        <div
            className={`relative inline-flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                />
                {pct != null && (
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={c}
                        initial={{ strokeDashoffset: c }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
                        style={{ filter: `drop-shadow(0 0 6px ${color}44)` }}
                    />
                )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                    className="text-[15px] font-black tabular-nums tracking-[-0.03em]"
                    style={{ color: value != null ? color : 'rgba(255,255,255,0.2)' }}
                >
                    {value ?? 'n.d.'}
                </span>
                {label && (
                    <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/22">
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}
