'use client';

import { ProvenancePill } from '@/components/shared/metrics/ProvenancePill';

/**
 * Primitives visuelles premium pour le dashboard GEO (aucune donnée fictive — valeurs passées en props).
 */

export function GeoSectionTitle({ title, subtitle, action = null }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
                <div className="text-xl font-bold tracking-[-0.02em] text-white/95">{title}</div>
                {subtitle && <div className="text-[13px] text-white/40 mt-0.5 max-w-2xl">{subtitle}</div>}
            </div>
            {action}
        </div>
    );
}

export function GeoKpiCard({ label, value, hint, accent = 'default' }) {
    const accents = {
        default: 'text-white/90',
        violet: 'text-[#a78bfa]',
        emerald: 'text-emerald-400/95',
        amber: 'text-amber-400/95',
        blue: 'text-sky-400/95',
    };
    const vClass = accents[accent] || accents.default;
    const missing = value === null || value === undefined;
    return (
        <div className="geo-card p-4 min-h-[100px] flex flex-col justify-between border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent">
            <div className="text-[10px] text-white/25 font-bold uppercase tracking-[0.06em] mb-1">{label}</div>
            <div className={`text-[26px] md:text-[28px] font-bold tabular-nums leading-none ${missing ? 'text-white/40' : vClass}`}>
                {missing ? 'n.d.' : value}
            </div>
            {hint && <div className="text-[10px] text-white/35 mt-2 leading-snug">{hint}</div>}
        </div>
    );
}

export function GeoProvenancePill({ meta, className = '' }) {
    return <ProvenancePill meta={meta} className={className} />;
}

export function GeoMetaNote({ meta, children = null }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-semibold text-white/85">Provenance</div>
                <GeoProvenancePill meta={meta} />
            </div>
            <div className="text-[11px] text-white/45 leading-relaxed">{children || meta?.description}</div>
        </div>
    );
}

/** Barre horizontale proportionnelle (max = valeur max de la série ou 100 pour %). */
export function GeoBarRow({ label, sub = null, value, max, color = 'bg-violet-500/80' }) {
    const m = max > 0 ? max : 1;
    const pct = Math.min(100, Math.round((value / m) * 100));
    return (
        <div className="space-y-1.5">
            {(label || sub) && (
                <div className="flex justify-between gap-2 text-xs">
                    {label ? <span className="text-white/80 truncate">{label}</span> : <span />}
                    <span className="text-white/50 font-mono tabular-nums shrink-0">{value}</span>
                </div>
            )}
            {sub && <div className="text-[10px] text-white/35 -mt-0.5">{sub}</div>}
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export function GeoEmptyPanel({ title, description, children = null }) {
    return (
        <div className="geo-card p-8 border border-dashed border-white/15 bg-white/[0.02]">
            <div className="text-sm font-semibold text-white/90 mb-1">{title}</div>
            {description && <p className="text-xs text-white/40 mb-4 max-w-lg">{description}</p>}
            {children}
        </div>
    );
}

export function GeoSidePanel({ title, children = null }) {
    return (
        <div className="geo-card p-4 border border-white/[0.06]">
            <div className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-3">{title}</div>
            {children}
        </div>
    );
}

/** Carte surface premium (néon léger) */
export function GeoPremiumCard({ className = '', children = null }) {
    return <div className={`geo-premium-card overflow-hidden ${className}`}>{children}</div>;
}

/** Pastille delta réelle (valeur déjà calculée côté parent) */
export function GeoDeltaPill({ value, unit = '%' }) {
    if (value == null || Number.isNaN(value)) return <span className="geo-delta-neutre">n.d.</span>;
    const up = value > 0;
    const down = value < 0;
    const cls = up ? 'geo-delta-up' : down ? 'geo-delta-down' : 'geo-delta-neutre';
    const sym = up ? '↑' : down ? '↓' : '~';
    return (
        <span className={cls}>
            {sym} {value}
            {unit}
        </span>
    );
}

export function GeoModelAvatar({ label, color = 'bg-violet-500/30' }) {
    const ch = (label || '-').trim().slice(0, 1).toUpperCase();
    return (
        <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white/90 border border-white/10 ${color}`}
        >
            {ch}
        </div>
    );
}

export function GeoStatusDot({ status = 'idle' }) {
    const colors = {
        ok: 'bg-emerald-400',
        warning: 'bg-amber-400',
        critical: 'bg-red-400',
        idle: 'bg-white/20',
    };
    return <span className={`w-1.5 h-1.5 rounded-full ${colors[status] || colors.idle}`} />;
}

export function GeoInlineMetric({ label, value, accent }) {
    const accents = {
        emerald: 'text-emerald-400',
        violet: 'text-[#a78bfa]',
        amber: 'text-amber-400',
        red: 'text-red-400',
    };
    return (
        <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-white/[0.04] last:border-0">
            <span className="text-[10px] text-white/40">{label}</span>
            <span className={`text-[12px] font-bold tabular-nums ${accent ? accents[accent] || 'text-white/80' : 'text-white/80'}`}>{value ?? 'n.d.'}</span>
        </div>
    );
}
