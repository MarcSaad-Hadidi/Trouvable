import Link from 'next/link';

import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import {
    CommandEmptyState,
    CommandHeader,
    CommandPageShell,
} from '@/features/admin/dashboard/shared/components/command';

const ACCENT_LINE_CLASSES = {
    emerald: 'from-emerald-300/70 via-emerald-300/18 to-transparent',
    sky: 'from-sky-300/70 via-sky-300/18 to-transparent',
    amber: 'from-amber-300/70 via-amber-300/18 to-transparent',
    slate: 'from-white/40 via-white/10 to-transparent',
};

const PANEL_TONE_CLASSES = {
    default: 'border-white/[0.08] bg-[#0b0d11]/92 shadow-[0_20px_60px_rgba(0,0,0,0.26)]',
    success: 'border-emerald-400/14 bg-[linear-gradient(180deg,rgba(10,20,16,0.98)_0%,rgba(9,12,13,0.94)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]',
    info: 'border-sky-400/14 bg-[linear-gradient(180deg,rgba(8,16,22,0.98)_0%,rgba(9,12,15,0.94)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]',
    warning: 'border-amber-400/16 bg-[linear-gradient(180deg,rgba(22,17,8,0.98)_0%,rgba(13,11,9,0.94)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]',
    critical: 'border-red-400/16 bg-[linear-gradient(180deg,rgba(23,11,11,0.98)_0%,rgba(15,10,10,0.94)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.28)]',
};

const ACTION_VARIANTS = {
    primary: 'border-sky-300/22 bg-sky-400/14 text-sky-100 hover:bg-sky-400/22 hover:border-sky-300/32',
    secondary: 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:border-white/[0.16]',
    subtle: 'border-white/[0.08] bg-transparent text-white/60 hover:bg-white/[0.03] hover:border-white/[0.14] hover:text-white/80',
    geo: 'border-violet-400/20 bg-violet-400/12 text-violet-100 hover:bg-violet-400/18 hover:border-violet-400/30',
};

const STATUS_META = {
    ok: {
        label: 'Sain',
        className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    },
    warning: {
        label: 'À surveiller',
        className: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    },
    critical: {
        label: 'Action requise',
        className: 'border-red-400/20 bg-red-400/10 text-red-200',
    },
    unavailable: {
        label: 'Indisponible',
        className: 'border-white/10 bg-white/[0.04] text-white/55',
    },
};

const SPARKLINE_COLORS = {
    emerald: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.16)' },
    sky: { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.16)' },
    amber: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.16)' },
    slate: { stroke: '#cbd5e1', fill: 'rgba(203, 213, 225, 0.12)' },
};

export function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n.d.';
    return Number(value).toLocaleString('fr-FR');
}

export function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n.d.';
    return `${(Number(value) * 100).toFixed(decimals)}%`;
}

export function formatPosition(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n.d.';
    return Number(value).toFixed(1);
}

export function formatDateLabel(value) {
    if (!value) return 'Indisponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Indisponible';
    return parsed.toLocaleDateString('fr-CA', { dateStyle: 'medium' });
}

export function formatDateTimeLabel(value) {
    if (!value) return 'Indisponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Indisponible';
    return parsed.toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function getPanelToneFromStatus(status) {
    if (status === 'ok') return 'success';
    if (status === 'warning') return 'warning';
    if (status === 'critical') return 'critical';
    if (status === 'unavailable') return 'default';
    return 'default';
}

export function SeoStatusBadge({ status, label = null, className = '' }) {
    const resolved = STATUS_META[status] || STATUS_META.unavailable;

    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${resolved.className} ${className}`}>
            {label || resolved.label}
        </span>
    );
}

export function getSeoActionClasses(variant = 'secondary') {
    return `inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] ${ACTION_VARIANTS[variant] || ACTION_VARIANTS.secondary}`;
}

export function SeoActionLink({ href, variant = 'secondary', children, className = '' }) {
    return (
        <Link href={href} className={`${getSeoActionClasses(variant)} ${className}`}>
            {children}
        </Link>
    );
}

function buildSparklinePoints(values) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    return values.map((value, index) => {
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = 40 - (((value - min) / range) * 32);
        return { x, y };
    });
}

export function SeoSparkline({ points, valueKey, color = 'emerald' }) {
    const values = (points || [])
        .map((point) => Number(point?.[valueKey]))
        .filter((value) => Number.isFinite(value));

    if (values.length < 2) return null;

    const coords = buildSparklinePoints(values);
    const linePath = coords.map((coord) => `${coord.x},${coord.y}`).join(' ');
    const areaPath = ['0,40', ...coords.map((coord) => `${coord.x},${coord.y}`), '100,40'].join(' ');
    const palette = SPARKLINE_COLORS[color] || SPARKLINE_COLORS.emerald;

    return (
        <svg viewBox="0 0 100 42" className="h-12 w-full" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={areaPath} fill={palette.fill} />
            <polyline
                points={linePath}
                fill="none"
                stroke={palette.stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function SeoPageShell({ children }) {
    return (
        <CommandPageShell className="seo-lens">
            {children}
        </CommandPageShell>
    );
}

export function SeoSectionNav({ items = [] }) {
    if (!items.length) return null;

    return (
        <nav className="rounded-full border border-white/[0.08] bg-black/20 p-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
            <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((item) => (
                    <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="inline-flex shrink-0 items-center rounded-full border border-transparent px-3.5 py-2 text-[11px] font-semibold text-white/60 transition-colors hover:border-white/[0.10] hover:bg-white/[0.05] hover:text-white"
                    >
                        {item.label}
                    </a>
                ))}
            </div>
        </nav>
    );
}

export function SeoLoadingState({ title, description }) {
    return (
        <SeoPageShell>
            <CommandHeader eyebrow="SEO Ops" title={title} subtitle={description} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-[26px] border border-white/[0.08] bg-[#0b0d11]/80 p-5">
                        <div className="h-3 w-24 rounded-full bg-white/[0.08]" />
                        <div className="mt-5 h-8 w-20 rounded-full bg-white/[0.10]" />
                        <div className="mt-4 h-20 rounded-[20px] bg-white/[0.04]" />
                    </div>
                ))}
            </div>
        </SeoPageShell>
    );
}

export function SeoPageHeader({ eyebrow = 'SEO Ops', title, subtitle, actions = null, meta = null }) {
    return (
        <section className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,17,22,0.98)_0%,rgba(10,12,16,0.94)_100%)] px-6 py-7 shadow-[0_28px_64px_rgba(0,0,0,0.32)] sm:px-7 lg:px-8 lg:py-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
            <div className="pointer-events-none absolute -right-20 top-0 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="relative">
                <CommandHeader
                    eyebrow={eyebrow}
                    title={title}
                    subtitle={subtitle}
                    actions={actions}
                    meta={meta}
                />
            </div>
        </section>
    );
}

export function SeoStatCard({ label, value, detail, reliability = 'unavailable', accent = 'emerald', href = null, trend = null }) {
    const content = (
        <div className={`group relative flex h-full min-h-[188px] flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#0b0d10]/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.24)] ${href ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[#0d1014]' : ''}`}>
            <div className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r ${ACCENT_LINE_CLASSES[accent] || ACCENT_LINE_CLASSES.emerald}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                    {label}
                </div>
                <ReliabilityPill value={reliability} />
            </div>

            <div className="mt-5 text-[2rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.15rem]">
                {value}
            </div>

            {detail ? (
                <p className="mt-3 text-[13px] leading-relaxed text-white/55">
                    {detail}
                </p>
            ) : null}

            {trend ? (
                <div className="mt-auto pt-5 -mx-1">
                    <SeoSparkline points={trend.points} valueKey={trend.valueKey} color={trend.color || accent} />
                </div>
            ) : <div className="mt-auto pt-5" />}
        </div>
    );

    if (!href) return content;

    return (
        <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] rounded-[26px]">
            {content}
        </Link>
    );
}

export function SeoPanel({ id, title, subtitle = null, action = null, reliability = null, tone = 'default', children }) {
    return (
        <section id={id} className={`scroll-mt-24 rounded-[30px] border p-5 sm:p-6 lg:p-7 ${PANEL_TONE_CLASSES[tone] || PANEL_TONE_CLASSES.default}`}>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-white/95">
                            {title}
                        </h2>
                        {reliability && <ReliabilityPill value={reliability} />}
                    </div>
                    {subtitle ? (
                        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-white/55 sm:text-[14px]">
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                {action ? <div className="shrink-0">{action}</div> : null}
            </div>

            <div className="space-y-4">
                {children}
            </div>
        </section>
    );
}

export function SeoEmptyState({ title, description, action = null }) {
    return (
        <CommandEmptyState title={title} description={description} action={action} />
    );
}
