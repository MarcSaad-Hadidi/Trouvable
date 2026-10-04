'use client';

import MetricPill, { METRIC_PILL_TONES } from './MetricPill';

const TONE_CLASSES = {
    emerald: METRIC_PILL_TONES.emerald,
    violet: METRIC_PILL_TONES.violet,
    amber: METRIC_PILL_TONES.amber,
    slate: METRIC_PILL_TONES.slate,
};

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
    return <MetricPill meta={resolved} toneClass={TONE_CLASSES[resolved?.tone]} className={className} />;
}
