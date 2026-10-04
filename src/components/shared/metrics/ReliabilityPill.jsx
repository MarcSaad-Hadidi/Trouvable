'use client';

import { getReliabilityMeta } from '@/lib/operator-intelligence/reliability';
import MetricPill, { METRIC_PILL_TONES } from './MetricPill';

const TONE_CLASSES = {
    emerald: METRIC_PILL_TONES.emerald,
    blue: METRIC_PILL_TONES.blue,
    amber: METRIC_PILL_TONES.amber,
    slate: METRIC_PILL_TONES.slate,
};

export default function ReliabilityPill({ value, meta = null, className = '' }) {
    const resolved = meta || (value ? getReliabilityMeta(value) : null);
    return <MetricPill meta={resolved} toneClass={TONE_CLASSES[resolved?.tone]} className={className} />;
}
