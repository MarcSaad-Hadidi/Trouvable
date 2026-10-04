'use client';

import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance-meta';
import MetricPill, { METRIC_PILL_TONES } from './MetricPill';

const TONE_CLASSES = {
    emerald: METRIC_PILL_TONES.emerald,
    violet: METRIC_PILL_TONES.violet,
    amber: METRIC_PILL_TONES.amber,
    slate: METRIC_PILL_TONES.slate,
};

export function ProvenancePill({ meta, value, className = '' }) {
    const resolved = meta || (value ? getProvenanceMeta(value) : null);
    return <MetricPill meta={resolved} toneClass={TONE_CLASSES[resolved?.tone]} className={className} />;
}
