import 'server-only';

export {
    buildMetricTrendSummary,
    classifyFreshness,
    computeDelta,
    splitImprovingDeclining,
} from '@/lib/continuous/metrics-core';
