'use client';

import Link from 'next/link';

import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import { GeoEmptyPanel, GeoPremiumCard } from '@/features/admin/geo/components/GeoPremium';

const EASE = [0.16, 1, 0.3, 1];
export const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
export const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
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
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25 mt-4">
                    État du dossier
                </div>
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
                    Le dossier partagé n&#39;a pas pu être chargé proprement.
                </div>
                {message ? (
                    <div className="text-[11px] text-red-100/60 mt-3 break-words">Dernier signal : {message}</div>
                ) : null}
            </GeoPremiumCard>
        </div>
    );
}

function TimelineItemBody({ item }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] hover:border-[#5b73ff]/25 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {item?.category ? (
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/25">
                                {item.category}
                            </span>
                        ) : null}
                        {item?.statusLabel ? (
                            <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/55">
                                {item.statusLabel}
                            </span>
                        ) : null}
                    </div>
                    <div className="text-[14px] font-semibold text-white/90 mt-2">{item?.title}</div>
                    {item?.description ? (
                        <div className="text-[11px] text-white/40 mt-1 leading-relaxed">{item.description}</div>
                    ) : null}
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
