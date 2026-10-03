'use client';

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/**
 * DeltaBadge — badge réutilisable pour afficher une variation chiffrée.
 *
 * Usage :
 *   <DeltaBadge current={76} previous={68} unit="pts" />
 *   <DeltaBadge value={+12} unit="%" inverted />
 *
 * Props :
 *   - current, previous : nombres (le delta est `current - previous`)
 *   - value : delta direct (si déjà calculé)
 *   - unit : 'pts' | '%' | 'positions' (par défaut : 'pts')
 *   - inverted : true si « baisse = bien » (ex. temps de chargement, rang moyen)
 *   - size : 'xs' | 'sm' (par défaut 'sm')
 *   - showArrow : true par défaut
 */

function resolveTone(delta, inverted) {
    if (delta === 0) return 'neutral';
    const positive = delta > 0;
    const good = inverted ? !positive : positive;
    return good ? 'positive' : 'negative';
}

const TONE_CLASSES = {
    positive: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    negative: 'border-red-400/25 bg-red-400/10 text-red-200',
    neutral: 'border-white/[0.1] bg-white/[0.04] text-white/60',
};

const SIZE_CLASSES = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-1 text-[11px]',
};

function formatDelta(delta, unit) {
    const rounded = Math.round(delta * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    const normalizedUnit = unit === '%' ? '%' : ` ${unit || 'pts'}`;
    return `${sign}${rounded}${normalizedUnit}`;
}

export default function DeltaBadge({
    current = null,
    previous = null,
    value = null,
    unit = 'pts',
    inverted = false,
    size = 'sm',
    showArrow = true,
    label = null,
    className = '',
}) {
    let delta = value;
    if (delta === null || delta === undefined) {
        if (current === null || current === undefined || previous === null || previous === undefined) {
            return null;
        }
        const currentNum = Number(current);
        const previousNum = Number(previous);
        if (!Number.isFinite(currentNum) || !Number.isFinite(previousNum)) return null;
        delta = currentNum - previousNum;
    }

    const tone = resolveTone(delta, inverted);
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
    const toneClass = TONE_CLASSES[tone];

    const Icon = delta === 0
        ? Minus
        : (delta > 0 ? ArrowUpRight : ArrowDownRight);

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border font-semibold tabular-nums ${sizeClass} ${toneClass} ${className}`}
            title={label || undefined}
        >
            {showArrow ? <Icon className="h-3 w-3" /> : null}
            <span>{formatDelta(delta, unit)}</span>
        </span>
    );
}
