'use client';

/**
 * Client-safe provenance metadata and pill component.
 *
 * The canonical server-only source lives in lib/operator-intelligence/provenance.js.
 * This mirror is intentional — it provides the same shape for client rendering
 * without importing `server-only` modules.
 */

export const PROVENANCE_META = {
    observed: {
        key: 'observed',
        label: 'Observé',
        shortLabel: 'Observé',
        description: 'Observé directement dans les audits, exécutions, mentions, actions ou données client stockées.',
        tone: 'emerald',
    },
    derived: {
        key: 'derived',
        label: 'Dérivé',
        shortLabel: 'Dérivé',
        description: 'Calculé de manière déterministe à partir des données observées déjà stockées dans Trouvable.',
        tone: 'violet',
    },
    inferred: {
        key: 'inferred',
        label: 'Inféré',
        shortLabel: 'Inféré',
        description: 'Suggéré ou inféré via analyse structurée, pas observé directement comme événement brut.',
        tone: 'amber',
    },
    not_connected: {
        key: 'not_connected',
        label: 'Non connecté',
        shortLabel: 'Non connecté',
        description: "Cette capacité n'est pas encore connectée à une source de données active.",
        tone: 'slate',
    },
};

const TONE_CLASSES = {
    emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    violet: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
    amber: 'bg-amber-400/10 text-amber-200 border-amber-400/20',
    slate: 'bg-white/[0.05] text-white/45 border-white/10',
};

/**
 * Resolve provenance metadata from a raw value string.
 * Returns the same shape as GeoProvenancePill expects: { label, shortLabel, tone, description }.
 */
export function getClientProvenanceMeta(value) {
    return PROVENANCE_META[value] || PROVENANCE_META.derived;
}

/**
 * Generic provenance pill — drop-in replacement for GeoProvenancePill.
 * Accepts either a `meta` object ({ label, tone, shortLabel, description })
 * or a raw `value` string ('observed' | 'derived' | 'inferred' | 'not_connected').
 */
export function ProvenancePill({ meta, value, className = '' }) {
    const resolved = meta || (value ? getClientProvenanceMeta(value) : null);
    if (!resolved?.label) return null;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${TONE_CLASSES[resolved.tone] || TONE_CLASSES.slate} ${className}`}
            title={resolved.description || resolved.label}
        >
            {resolved.shortLabel || resolved.label}
        </span>
    );
}
