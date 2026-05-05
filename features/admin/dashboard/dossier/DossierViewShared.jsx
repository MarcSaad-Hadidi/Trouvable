'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import { GeoEmptyPanel, GeoPremiumCard } from '@/features/admin/dashboard/geo/components/GeoPremium';

export const EASE = [0.16, 1, 0.3, 1];
export const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
export const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

const ACCENT_CLASSES = {
    default: 'text-white/90',
    emerald: 'text-emerald-300',
    violet: 'text-violet-300',
    amber: 'text-amber-300',
    blue: 'text-sky-300',
};

const CONNECTOR_STATUS_LABELS = {
    not_connected: 'Non connecté',
    configured: 'Configuré',
    disabled: 'Désactivé',
    sample_mode: 'Mode échantillon',
    error: 'Erreur',
    healthy: 'Sain',
    syncing: 'Synchronisation',
};

const CONNECTOR_STATUS_CLASSES = {
    not_connected: 'border-white/10 bg-white/[0.04] text-white/45',
    configured: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    disabled: 'border-white/10 bg-white/[0.04] text-white/40',
    sample_mode: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    error: 'border-red-400/20 bg-red-400/10 text-red-200',
    healthy: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    syncing: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
};

export function formatDateTime(value) {
    if (!value) return 'n.d.';

    try {
        return new Date(value).toLocaleString('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
        });
    } catch {
        return 'n.d.';
    }
}

export function timeSince(value) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return null;

    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
}

export function connectorStatusLabel(status) {
    return CONNECTOR_STATUS_LABELS[status] || status || 'Indisponible';
}

export function connectorStatusTone(status) {
    return CONNECTOR_STATUS_CLASSES[status] || CONNECTOR_STATUS_CLASSES.not_connected;
}

export function DossierLoadingState({ label = 'Chargement du dossier partagé…' }) {
    return (
        <div className="p-5 md:p-7 max-w-[1600px] mx-auto">
            <GeoPremiumCard className="min-h-[220px] px-6 py-8 flex flex-col items-center justify-center text-center">
                <div className="w-5 h-5 border-2 border-white/10 border-t-[#5b73ff] rounded-full geo-spin" />
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25 mt-4">État du dossier</div>
                <div className="text-[12px] text-white/45 mt-2">{label}</div>
            </GeoPremiumCard>
        </div>
    );
}

export function DossierErrorState({ message }) {
    return (
        <div className="p-5 md:p-7 max-w-[1600px] mx-auto">
            <GeoPremiumCard className="border border-red-400/15 bg-red-400/[0.05] px-6 py-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-red-100/70">État du dossier</div>
                <div className="text-[18px] font-semibold text-red-50 mt-2">Chargement impossible</div>
                <div className="text-[12px] text-red-100/75 mt-2 leading-relaxed">
                    Le dossier partagé n'a pas pu être chargé proprement.
                </div>
                {message ? <div className="text-[11px] text-red-100/60 mt-3 break-words">Dernier signal : {message}</div> : null}
            </GeoPremiumCard>
        </div>
    );
}

export function DossierPageShell({ children }) {
    return (
        <motion.div initial="hidden" animate="visible" variants={stagger} className="p-5 md:p-7 space-y-4 max-w-[1600px] mx-auto">
            {children}
        </motion.div>
    );
}

export function DossierHero({ header, primaryAction, secondaryAction }) {
    return (
        <motion.div variants={fadeUp} className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div className="min-w-0">
                <div className="text-[22px] font-bold tracking-[-0.03em] text-white/95">
                    {header?.title || 'Dossier partagé'}
                </div>

                <div className="text-[11px] text-white/30 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {header?.subtitle ? <span>{header.subtitle}</span> : null}
                    {header?.website ? (
                        <>
                            <span className="text-white/10">·</span>
                            <a
                                href={header.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#7b8fff]/60 hover:text-[#7b8fff] hover:underline truncate max-w-[280px] transition-colors"
                            >
                                {String(header.website).replace(/^https?:\/\//, '')}
                            </a>
                        </>
                    ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    {header?.lifecycleLabel ? (
                        <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/60">
                            {header.lifecycleLabel}
                        </span>
                    ) : null}
                    {header?.publicationLabel ? (
                        <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/60">
                            {header.publicationLabel}
                        </span>
                    ) : null}
                    {header?.lastUpdatedAt ? (
                        <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                            Mis à jour {timeSince(header.lastUpdatedAt) || 'n/a'}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
                {primaryAction}
                {secondaryAction}
            </div>
        </motion.div>
    );
}

export function DossierSectionHeading({ eyebrow, title, subtitle, action }) {
    return (
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div>
                {eyebrow ? <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/25 mb-1">{eyebrow}</div> : null}
                <div className="text-[18px] font-bold tracking-[-0.02em] text-white/92">{title}</div>
                {subtitle ? <div className="text-[12px] text-white/40 mt-1 max-w-3xl">{subtitle}</div> : null}
            </div>
            {action}
        </div>
    );
}

export function DossierSummaryCard({ item }) {
    const accent = ACCENT_CLASSES[item?.accent] || ACCENT_CLASSES.default;
    const content = (
        <div className="cmd-surface px-4 py-4 h-full flex flex-col justify-between gap-4 hover:border-white/[0.12] transition-all">
            <div className="flex items-start justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">{item?.label}</div>
                <ReliabilityPill value={item?.reliability} />
            </div>
            <div>
                <div className={`text-[28px] font-bold tracking-[-0.03em] tabular-nums ${accent}`}>{item?.value ?? 'n.d.'}</div>
                {item?.detail ? <div className="text-[11px] text-white/35 mt-1 leading-relaxed">{item.detail}</div> : null}
            </div>
        </div>
    );

    if (!item?.href) return content;

    return (
        <Link href={item.href} className="block h-full">
            {content}
        </Link>
    );
}

export function DossierFieldCard({ item }) {
    const accent = ACCENT_CLASSES[item?.accent] || ACCENT_CLASSES.default;
    const content = (
        <div className="geo-card border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 h-full">
            <div className="flex items-start justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">{item?.label}</div>
                <ReliabilityPill value={item?.reliability} />
            </div>
            <div className={`text-[15px] font-semibold leading-snug mt-3 ${accent}`}>{item?.value ?? 'n.d.'}</div>
            {item?.detail ? <div className="text-[11px] text-white/35 mt-2 leading-relaxed">{item.detail}</div> : null}
        </div>
    );

    if (!item?.href) return content;

    return (
        <Link href={item.href} className="block h-full">
            {content}
        </Link>
    );
}

function TimelineItemBody({ item }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] hover:border-[#5b73ff]/25 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {item?.category ? <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">{item.category}</span> : null}
                        {item?.statusLabel ? (
                            <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/55">
                                {item.statusLabel}
                            </span>
                        ) : null}
                    </div>
                    <div className="text-[14px] font-semibold text-white/90 mt-2">{item?.title}</div>
                    {item?.description ? <div className="text-[11px] text-white/40 mt-1 leading-relaxed">{item.description}</div> : null}
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                    <ReliabilityPill value={item?.reliability} />
                    {item?.timestamp ? (
                        <div className="text-[10px] text-white/30 uppercase tracking-[0.08em]">
                            {formatDateTime(item.timestamp)}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function DossierTimelineItem({ item }) {
    const content = <TimelineItemBody item={item} />;

    if (!item?.href) return content;

    return (
        <Link href={item.href} className="block">
            {content}
        </Link>
    );
}

/** Chronologie avec rail vertical — lecture "journal de mission". */
export function DossierRailTimelineItem({ item, isLast = false }) {
    const body = <TimelineItemBody item={item} />;

    const wrapped = (
        <div className="relative flex gap-4">
            <div className="relative flex w-5 shrink-0 flex-col items-center pt-1">
                <span className="z-[1] h-2.5 w-2.5 rounded-full border-2 border-[#5b73ff] bg-[#000000] shadow-[0_0_14px_rgba(91,115,255,0.45)]" />
                {!isLast ? <span className="mt-1 w-px flex-1 min-h-[24px] bg-gradient-to-b from-[#5b73ff]/35 to-white/[0.06]" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-6">{body}</div>
        </div>
    );

    if (!item?.href) return wrapped;

    return (
        <Link href={item.href} className="block">
            {wrapped}
        </Link>
    );
}

/** Grille type "bento" pour résumés connecteurs (hiérarchie visuelle variable). */
export function DossierBentoSummaryGrid({ items = [], renderCard }) {
    if (!items.length) return null;

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
            {items.map((item, index) => {
                let colClass = 'xl:col-span-4';
                if (items.length === 1) colClass = 'xl:col-span-12';
                else if (items.length === 2) colClass = 'xl:col-span-6';
                else if (items.length >= 3 && index === 0) colClass = 'xl:col-span-7';
                else if (items.length >= 3 && index === 1) colClass = 'xl:col-span-5';
                else if (items.length >= 3) colClass = 'xl:col-span-4';

                return (
                    <div key={item.id || index} className={colClass}>
                        {renderCard(item)}
                    </div>
                );
            })}
        </div>
    );
}

export function DossierConnectorCard({ item }) {
    return (
        <GeoPremiumCard className="p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[15px] font-semibold text-white/92">{item?.label}</div>
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${connectorStatusTone(item?.status)}`}>
                            {connectorStatusLabel(item?.status)}
                        </span>
                    </div>
                    <div className="text-[12px] text-white/50 mt-2 leading-relaxed">{item?.description}</div>
                    {item?.detail ? <div className="text-[11px] text-white/35 mt-2">{item.detail}</div> : null}
                </div>

                <ReliabilityPill value={item?.reliability} />
            </div>

            {item?.metrics?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {item.metrics.map((metric) => (
                        <DossierFieldCard key={metric.id} item={metric} />
                    ))}
                </div>
            ) : null}

            {item?.latestRun ? (
                <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">
                        <span>Dernière observation</span>
                        <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/55">
                            {item.latestRun.statusLabel}
                        </span>
                    </div>
                    <div className="text-[12px] text-white/80 mt-2">{item.latestRun.detail}</div>
                    {item.latestRun.timestamp ? <div className="text-[10px] text-white/35 mt-1">{formatDateTime(item.latestRun.timestamp)}</div> : null}
                </div>
            ) : null}

            {item?.incidents?.length ? (
                <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">Incidents récents</div>
                    {item.incidents.slice(0, 3).map((incident) => (
                        <div key={incident.id} className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[12px] font-semibold text-red-100">{incident.label}</div>
                                <ReliabilityPill value={incident.reliability} />
                            </div>
                            <div className="text-[11px] text-red-100/80 mt-1 leading-relaxed">{incident.description}</div>
                            {incident.timestamp ? <div className="text-[10px] text-red-100/55 mt-1">{formatDateTime(incident.timestamp)}</div> : null}
                        </div>
                    ))}
                </div>
            ) : null}

            {item?.href ? (
                <div className="pt-1">
                    <Link href={item.href} className="text-[11px] font-semibold text-[#7b8fff]/70 hover:text-[#7b8fff] transition-colors">
                        Ouvrir la source
                    </Link>
                </div>
            ) : null}
        </GeoPremiumCard>
    );
}

export function DossierQuickLinkCard({ item }) {
    return (
        <Link href={item.href} className="group block">
            <div className="geo-card border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 h-full hover:border-white/[0.12] transition-all">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">{item.section}</div>
                <div className="text-[14px] font-semibold text-white/90 mt-2 group-hover:text-white">{item.label}</div>
                <div className="text-[11px] text-white/40 mt-2 leading-relaxed">{item.description}</div>
            </div>
        </Link>
    );
}

export function DossierEmptyState({ title, description }) {
    return <GeoEmptyPanel title={title} description={description} />;
}
