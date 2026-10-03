'use client';

import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function CoverageMeter({
    label,
    value,
    max = 100,
    color = '#5b73ff',
    suffix = '%',
    className = '',
}) {
    const pct = value != null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

    return (
        <div className={className}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">
                    {label}
                </span>
                <span
                    className="text-[14px] font-bold tabular-nums tracking-[-0.02em]"
                    style={{ color: value != null ? color : 'rgba(255,255,255,0.2)' }}
                >
                    {value != null ? `${value}${suffix}` : 'n.d.'}
                </span>
            </div>
            <div className="relative h-[5px] overflow-hidden rounded-full bg-white/[0.035]">
                {value != null && (
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: EASE, delay: 0.15 }}
                        className="h-full rounded-full"
                        style={{
                            background: `linear-gradient(90deg, ${color}cc, ${color}55)`,
                            boxShadow: `0 0 10px ${color}30`,
                        }}
                    />
                )}
            </div>
        </div>
    );
}
