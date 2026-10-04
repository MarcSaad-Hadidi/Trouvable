'use client';

import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import { CommandPageShell } from '@/features/admin/shared/components/command';

const STATUS_META = {
    autorisé: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    bloqué: 'border-red-400/20 bg-red-400/10 text-red-200',
    ambigu: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    'à confirmer': 'border-white/10 bg-white/[0.05] text-white/60',
    couvert: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    partiel: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    absent: 'border-red-400/20 bg-red-400/10 text-red-200',
    présents: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    incohérent: 'border-red-400/20 bg-red-400/10 text-red-200',
    aligné: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    écart: 'border-red-400/20 bg-red-400/10 text-red-200',
    manquant: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
};

const ACCENT_META = {
    violet: 'text-violet-200',
    blue: 'text-sky-200',
    emerald: 'text-emerald-200',
    amber: 'text-amber-100',
};

const CHIP_TONES = {
    neutral: 'border-white/[0.08] bg-white/[0.04] text-white/72',
    danger: 'border-red-400/15 bg-red-400/10 text-red-100',
    success: 'border-emerald-400/15 bg-emerald-400/10 text-emerald-100',
    warning: 'border-amber-400/15 bg-amber-400/10 text-amber-100',
};

export function GeoStatusBadge({ status, className = '' }) {
    if (!status) return null;
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_META[status] || STATUS_META['à confirmer']} ${className}`}
        >
            {status}
        </span>
    );
}

export function GeoFoundationStatCard({
    label,
    value,
    detail,
    reliability = 'unavailable',
    status = null,
    accent = 'violet',
}) {
    return (
        <div className="geo-card border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/28">{label}</div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {status ? <GeoStatusBadge status={status} /> : null}
                    <ReliabilityPill value={reliability} />
                </div>
            </div>
            <div
                className={`mt-3 text-[28px] font-bold leading-none tracking-[-0.03em] ${ACCENT_META[accent] || ACCENT_META.violet}`}
            >
                {value ?? 'n.d.'}
            </div>
            {detail ? <p className="mt-2 text-[12px] leading-relaxed text-white/48">{detail}</p> : null}
        </div>
    );
}

export function GeoFoundationPanel({
    title,
    subtitle = null,
    reliability = null,
    status = null,
    action = null,
    className = '',
    children,
}) {
    return (
        <div className={`geo-premium-card border border-white/[0.08] bg-black/18 p-5 ${className}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white/92">{title}</div>
                        {status ? <GeoStatusBadge status={status} /> : null}
                        {reliability ? <ReliabilityPill value={reliability} /> : null}
                    </div>
                    {subtitle ? <p className="mt-2 text-[12px] leading-relaxed text-white/52">{subtitle}</p> : null}
                </div>
                {action}
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}

export function GeoReliabilityLegend({
    values = ['measured', 'calculated', 'ai_analysis', 'unavailable'],
    className = '',
}) {
    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {values.map((value) => (
                <ReliabilityPill key={value} value={value} />
            ))}
        </div>
    );
}

export function GeoFoundationPageShell({ children, className = '', subNav = null }) {
    return (
        <CommandPageShell className={`geo-lens ${className}`.trim()}>
            {subNav}
            {children}
        </CommandPageShell>
    );
}

export function GeoFoundationStickySubNav({ items = [] }) {
    if (!items.length) return null;

    return (
        <nav className="sticky top-0 z-20 -mx-2 flex gap-2 overflow-x-auto rounded-full border border-white/[0.08] bg-[#0b0d11]/85 p-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.28)] backdrop-blur-md sm:mx-0">
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="inline-flex shrink-0 items-center rounded-full border border-transparent px-3.5 py-2 text-[11px] font-semibold text-white/60 transition-colors hover:border-white/[0.10] hover:bg-white/[0.05] hover:text-white"
                >
                    {item.label}
                </a>
            ))}
        </nav>
    );
}

export function GeoChipList({ items = [], tone = 'neutral' }) {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => (
                <span
                    key={`${tone}-${item}`}
                    className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] leading-none ${CHIP_TONES[tone] || CHIP_TONES.neutral}`}
                >
                    <span className="truncate">{item}</span>
                </span>
            ))}
        </div>
    );
}
