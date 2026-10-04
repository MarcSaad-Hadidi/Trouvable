export const METRIC_PILL_TONES = {
    emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    blue: 'bg-sky-400/10 text-sky-300 border-sky-400/20',
    violet: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
    amber: 'bg-amber-400/10 text-amber-200 border-amber-400/20',
    slate: 'bg-white/[0.05] text-white/45 border-white/10',
};

export default function MetricPill({ meta, toneClass = METRIC_PILL_TONES.slate, className = '' }) {
    if (!meta?.label) return null;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${toneClass} ${className}`}
            title={meta.description || meta.label}
        >
            {meta.shortLabel || meta.label}
        </span>
    );
}
