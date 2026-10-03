import 'server-only';

const PROVENANCE_META = {
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

export function getProvenanceMeta(value) {
    return PROVENANCE_META[value] || PROVENANCE_META.derived;
}

export function mapOpportunitySourceToProvenance(source) {
    if (source === 'observed') return PROVENANCE_META.observed;
    if (source === 'inferred') return PROVENANCE_META.inferred;
    if (source === 'recommended') return PROVENANCE_META.derived;
    return PROVENANCE_META.derived;
}

export function getNotConnectedMeta() {
    return PROVENANCE_META.not_connected;
}
