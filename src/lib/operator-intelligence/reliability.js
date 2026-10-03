export const RELIABILITY_META = {
    measured: {
        key: 'measured',
        label: 'Mesurée',
        shortLabel: 'Mesurée',
        description: 'Observation directe issue d’une source réelle, d’un audit, d’une exécution, d’un connecteur ou d’une donnée mandatée stockée.',
        tone: 'emerald',
    },
    calculated: {
        key: 'calculated',
        label: 'Calculée',
        shortLabel: 'Calculée',
        description: 'Résultat calculé de manière déterministe à partir de données observées déjà présentes dans Trouvable.',
        tone: 'blue',
    },
    ai_analysis: {
        key: 'ai_analysis',
        label: 'Analyse IA',
        shortLabel: 'Analyse IA',
        description: 'Interprétation ou priorisation formulée par IA à partir de données réelles, sans faire autorité seule sur la vérité.',
        tone: 'amber',
    },
    unavailable: {
        key: 'unavailable',
        label: 'Indisponible',
        shortLabel: 'Indisponible',
        description: 'Signal absent, non connecté, trop fragile ou non vérifiable proprement à cet instant.',
        tone: 'slate',
    },
};

export function getReliabilityMeta(value) {
    return RELIABILITY_META[value] || RELIABILITY_META.unavailable;
}

export function mapProvenanceToReliability(value) {
    const key = typeof value === 'string' ? value : value?.key;

    if (key === 'observed') return 'measured';
    if (key === 'derived') return 'calculated';
    if (key === 'inferred') return 'ai_analysis';
    if (key === 'not_connected') return 'unavailable';
    return 'unavailable';
}

export function mapOpportunitySourceToReliability(source) {
    if (source === 'observed') return 'measured';
    if (source === 'inferred') return 'ai_analysis';
    return 'calculated';
}