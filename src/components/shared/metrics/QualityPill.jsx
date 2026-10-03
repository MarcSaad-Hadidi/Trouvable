'use client';

import { QUALITY_META, QUALITY_TONE_CLASSES } from '@/lib/quality-status';

/**
 * Shared quality-status pill for prompt review surfaces.
 *
 * Usage:
 *   <QualityPill status="strong" />
 *   <QualityPill status="review" />
 *   <QualityPill status="weak" />
 */
export default function QualityPill({ status, className = '' }) {
    const meta = QUALITY_META[status] || QUALITY_META.review;
    const tone = QUALITY_TONE_CLASSES[meta.tone] || QUALITY_TONE_CLASSES.amber;

    return (
        <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${tone} ${className}`}
            title={meta.description}
        >
            {meta.label}
        </span>
    );
}
