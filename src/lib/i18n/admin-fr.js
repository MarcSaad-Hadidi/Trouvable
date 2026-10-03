export const ADMIN_GEO_LABELS = {
    nav: {
        overview: "Vue d'ensemble",
        prompts: 'Prompts suivis',
        runs: 'Exécutions',
        runHistory: 'Historique des exécutions',
        citations: 'Citations',
        competitors: 'Concurrents',
        models: 'Fiabilité IA',
        opportunities: "Centre d'opportunités",
        continuous: 'Suivi quotidien',
        social: 'Veille Reddit',
        audit: 'Audit SEO/GEO',
        settings: 'Paramètres',
        connectors: 'Connecteurs',
        optimization: 'Optimisation',
        monitoring: 'Monitoring',
        secondary: 'Secondaire',
    },
    actions: {
        runNow: 'Lancer maintenant',
        edit: 'Modifier',
        delete: 'Supprimer',
        save: 'Enregistrer',
        cancel: 'Annuler',
        captureSnapshot: 'Capturer un instantané',
        schedulerTick: 'Lancer le cycle du planificateur',
        runActivePrompts: 'Lancer les prompts actifs',
        runBenchmark: 'Lancer le test de variantes',
        rerun: 'Relancer',
        reparse: 'Réanalyser',
        openPromptWorkspace: 'Ouvrir les prompts suivis',
    },
    status: {
        activeJobs: 'Jobs actifs',
        failedJobs: 'Jobs en échec',
        configured: 'Configuré',
        notConnected: 'Non connecté',
        disabled: 'Désactivé',
        sampleMode: 'Mode échantillon',
        healthy: 'Actif',
        syncing: 'Synchronisation',
        dailyRefresh: 'Actualisation quotidienne',
        latestExecution: 'Dernière exécution',
        nextRefresh: 'Prochaine actualisation',
        noData: 'Aucune donnée',
        running: 'En cours',
        pending: 'En attente',
        completed: 'Terminée',
        failed: 'Échouée',
        cancelled: 'Annulée',
    },
    sections: {
        benchmarkTitle: 'Test interne de variantes',
        benchmarkDisclaimer:
            'Compare des variantes internes de prompts et de modèles. Pour comparer un même prompt entre providers, utilisez GEO Compare.',
        dailyModeTitle: 'Mode quotidien strict',
        dailyModeHint:
            'En mode Hobby, toute cadence inférieure à 24h est automatiquement alignée sur une actualisation quotidienne.',
    },
    benchmark: {
        title: 'Test interne de variantes',
        disclaimer: 'Compare des variantes internes de prompts et de modèles. Pour comparer un même prompt entre providers, utilisez GEO Compare.',
    },
};

export function runStatusLabelFr(status) {
    const map = {
        pending: 'En attente',
        running: 'En cours',
        completed: 'Terminée',
        partial: 'Partielle',
        partial_error: 'Erreur partielle',
        failed: 'Échouée',
        cancelled: 'Annulée',
        no_run: 'Aucune exécution',
    };
    return map[status] || status || '-';
}

export function parseStatusLabelFr(status) {
    const map = {
        parsed_success: 'Analyse réussie',
        parsed_partial: 'Analyse partielle',
        parsed_failed: 'Analyse en échec',
    };
    return map[status] || status || '-';
}

export function connectorStatusLabelFr(status) {
    const map = {
        configured: 'Configuré',
        healthy: 'Actif',
        syncing: 'Synchronisation',
        sample_mode: 'Mode échantillon',
        not_connected: 'Non connecté',
        disabled: 'Désactivé',
        error: 'Erreur',
    };
    return map[status] || status || '-';
}

export function provenanceLabelFr(key) {
    const map = {
        observed: 'Observé',
        derived: 'Dérivé',
        inferred: 'Inféré',
        not_connected: 'Non connecté',
    };
    return map[key] || key;
}
