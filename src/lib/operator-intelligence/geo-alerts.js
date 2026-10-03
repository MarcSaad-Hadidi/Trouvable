import 'server-only';


import { getConnectorOverviewForClient } from '@/lib/connectors';
import { getTrendSlice } from '@/lib/continuous/jobs';
import { getCrawlerSlice } from '@/lib/operator-intelligence/geo-crawlers';
import { getConsistencySlice } from '@/lib/operator-intelligence/geo-consistency';
import { getReadinessSlice } from '@/lib/operator-intelligence/geo-readiness';
import { getSchemaSlice } from '@/lib/operator-intelligence/geo-schema';

// ---------------------------------------------------------------------------
// Alert families — each maps to a section group in the UI
// ---------------------------------------------------------------------------
const FAMILY_META = {
    crawl: { label: 'Accès crawl', icon: 'crawler', order: 0 },
    schema: { label: 'Données structurées / entité', icon: 'schema', order: 1 },
    readiness: { label: 'Préparation GEO', icon: 'readiness', order: 2 },
    consistency: { label: 'Cohérence marque', icon: 'compare', order: 3 },
    freshness: { label: 'Fraîcheur runs / audit', icon: 'pulse', order: 4 },
    connectors: { label: 'Connecteurs', icon: 'connectors', order: 5 },
    signals: { label: 'Citation / signaux', icon: 'signal', order: 6 },
    competition: { label: 'Pression concurrentielle', icon: 'compare', order: 7 },
    jobs: { label: 'Jobs récurrents', icon: 'continuous', order: 8 },
};

const SEVERITY_ORDER = { critique: 0, avertissement: 1, info: 2 };

// ---------------------------------------------------------------------------
// Alert builders — each returns an array of alert objects (may be empty)
// ---------------------------------------------------------------------------

function buildCrawlerAlerts(crawlerSlice) {
    if (!crawlerSlice?.available) return [];
    const alerts = [];
    const { summary } = crawlerSlice;

    if ((summary?.criticalBlockedCount || 0) > 0) {
        alerts.push({
            id: 'crawler_critical_blocked',
            familyKey: 'crawl',
            title: 'Bots IA critiques bloqués',
            severity: 'critique',
            evidence: `${summary.criticalBlockedCount} bot(s) critique(s) bloqué(s) via robots.txt.`,
            reliability: 'measured',
            suggestedAction: 'Relire les directives robots.txt et lever les blocages des bots qui alimentent les réponses IA.',
        });
    } else if ((summary?.blockedCount || 0) > 0) {
        alerts.push({
            id: 'crawler_blocked',
            familyKey: 'crawl',
            title: 'Bots IA bloqués',
            severity: 'avertissement',
            evidence: `${summary.blockedCount} bot(s) suivi(s) bloqué(s) via robots.txt.`,
            reliability: 'measured',
            suggestedAction: 'Vérifier si ces blocages sont intentionnels ou un résidu de configuration.',
        });
    }

    if ((summary?.ambiguousCount || 0) > 0) {
        alerts.push({
            id: 'crawler_ambiguous',
            familyKey: 'crawl',
            title: 'Bots IA au statut ambigu',
            severity: 'info',
            evidence: `${summary.ambiguousCount} bot(s) avec règles partielles ou restrictives sans blocage clair.`,
            reliability: 'measured',
            suggestedAction: 'Confirmer manuellement la couverture réelle de ces bots sur le site.',
        });
    }

    return alerts;
}

function buildSchemaAlerts(schemaSlice) {
    if (!schemaSlice?.available) return [];
    const alerts = [];

    if ((schemaSlice.summary?.criticalGapCount || 0) > 0) {
        alerts.push({
            id: 'schema_critical_gaps',
            familyKey: 'schema',
            title: 'Lacunes schema critiques',
            severity: 'avertissement',
            evidence: `${schemaSlice.summary.criticalGapCount} lacune(s) de type/propriété critique(s) observée(s) dans le dernier audit.`,
            reliability: 'measured',
            suggestedAction: 'Compléter le schema sur les familles prioritaires (Organization, LocalBusiness, FAQ).',
        });
    }

    if ((schemaSlice.summary?.coveragePercent || 0) < 50) {
        alerts.push({
            id: 'schema_low_coverage',
            familyKey: 'schema',
            title: 'Couverture schema faible',
            severity: 'avertissement',
            evidence: `Couverture schema observée : ${schemaSlice.summary?.coveragePercent || 0}% sur les familles suivies.`,
            reliability: 'calculated',
            suggestedAction: 'Renforcer la présence des entités structurées dans le JSON-LD du site.',
        });
    }

    return alerts;
}

function buildConsistencyAlerts(consistencySlice) {
    if (!consistencySlice?.available) return [];
    const alerts = [];
    const { dimensions = [], criticalContradictions = [] } = consistencySlice;

    const incoherentDimensions = dimensions.filter(
        (d) => ['incohérent', 'écart', 'écart notable'].includes(d.status),
    );

    if (incoherentDimensions.length > 0) {
        const labels = incoherentDimensions.map((d) => d.label).join(', ');
        alerts.push({
            id: 'consistency_drift',
            familyKey: 'consistency',
            title: 'Dérive de cohérence détectée',
            severity: criticalContradictions.length > 0 ? 'critique' : 'avertissement',
            evidence: `Écarts observés sur : ${labels}. ${criticalContradictions.length} contradiction(s) critique(s).`,
            reliability: 'calculated',
            suggestedAction: 'Réconcilier les coordonnées et l\'identité entre le dossier partagé et le schema du site.',
        });
    }

    return alerts;
}

function buildReadinessAlerts(readinessSlice) {
    if (!readinessSlice?.available) return [];
    const alerts = [];
    const dimensions = readinessSlice.dimensions || [];

    const weakDimensions = dimensions.filter(
        (d) => d.score !== null && d.score !== undefined && d.score < 45 && d.status !== 'couvert',
    );

    if (weakDimensions.length > 0) {
        const labels = weakDimensions.map((d) => `${d.label} (${d.score}/100)`).join(', ');
        alerts.push({
            id: 'readiness_degraded',
            familyKey: 'readiness',
            title: 'Préparation GEO dégradée',
            severity: 'avertissement',
            evidence: `Dimensions faibles : ${labels}.`,
            reliability: 'calculated',
            suggestedAction: 'Corriger les lacunes structurelles sur les pages les plus faibles identifiées dans la surface de préparation.',
        });
    }

    const topBlockers = readinessSlice.topBlockers || [];
    const blockerCount = topBlockers.filter((b) => b.status !== 'couvert').length;
    if (blockerCount > 0 && weakDimensions.length === 0) {
        alerts.push({
            id: 'readiness_blockers',
            familyKey: 'readiness',
            title: 'Blocages de préparation GEO',
            severity: 'info',
            evidence: `${blockerCount} blocage(s) identifié(s) dans la synthèse de préparation.`,
            reliability: 'calculated',
            suggestedAction: 'Consulter la page Préparation GEO pour le détail des blocages par dimension.',
        });
    }

    return alerts;
}

function buildFreshnessAlerts(trendSlice) {
    const alerts = [];
    const { freshness } = trendSlice || {};

    if (freshness?.audit?.state === 'stale') {
        alerts.push({
            id: 'freshness_audit_stale',
            familyKey: 'freshness',
            title: 'Audit en retard',
            severity: 'critique',
            evidence: freshness.audit.hours !== null && freshness.audit.hours !== undefined
                ? `Le dernier audit date de ${freshness.audit.hours}h.`
                : 'La date du dernier audit n\'est pas disponible.',
            reliability: 'calculated',
            suggestedAction: 'Relancer un audit pour obtenir des signaux frais.',
        });
    } else if (freshness?.audit?.state === 'warning') {
        alerts.push({
            id: 'freshness_audit_warning',
            familyKey: 'freshness',
            title: 'Audit vieillissant',
            severity: 'avertissement',
            evidence: `Le dernier audit date de ${freshness.audit.hours || '?'}h.`,
            reliability: 'calculated',
            suggestedAction: 'Prévoir une actualisation de l\'audit prochainement.',
        });
    }

    if (freshness?.runs?.state === 'stale') {
        alerts.push({
            id: 'freshness_runs_stale',
            familyKey: 'freshness',
            title: 'Exécutions en retard',
            severity: 'critique',
            evidence: freshness.runs.hours !== null && freshness.runs.hours !== undefined
                ? `La dernière exécution date de ${freshness.runs.hours}h.`
                : 'La date de la dernière exécution n\'est pas disponible.',
            reliability: 'calculated',
            suggestedAction: 'Relancer le cycle quotidien des prompts.',
        });
    } else if (freshness?.runs?.state === 'warning') {
        alerts.push({
            id: 'freshness_runs_warning',
            familyKey: 'freshness',
            title: 'Exécutions vieillissantes',
            severity: 'avertissement',
            evidence: `La dernière exécution date de ${freshness.runs.hours || '?'}h.`,
            reliability: 'calculated',
            suggestedAction: 'Prévoir une relance des exécutions prochainement.',
        });
    }

    return alerts;
}

function buildConnectorAlerts(connectors) {
    const alerts = [];
    const errorConnectors = (connectors?.connections || []).filter((c) => c.status === 'error');
    const disabledConnectors = (connectors?.connections || []).filter((c) => c.status === 'disabled');

    if (errorConnectors.length > 0) {
        alerts.push({
            id: 'connector_error',
            familyKey: 'connectors',
            title: 'Connecteur en erreur',
            severity: 'critique',
            evidence: `${errorConnectors.length} connecteur(s) en état d'erreur : ${errorConnectors.map((c) => c.provider).join(', ')}.`,
            reliability: 'measured',
            suggestedAction: 'Vérifier la configuration et les identifiants du connecteur concerné dans les paramètres du dossier.',
        });
    }

    if (disabledConnectors.length > 0) {
        alerts.push({
            id: 'connector_disabled',
            familyKey: 'connectors',
            title: 'Connecteur désactivé',
            severity: 'info',
            evidence: `${disabledConnectors.length} connecteur(s) désactivé(s) : ${disabledConnectors.map((c) => c.provider).join(', ')}.`,
            reliability: 'measured',
            suggestedAction: 'Réactiver le connecteur si les données sont nécessaires au suivi GEO.',
        });
    }

    return alerts;
}

function buildSignalAlerts(trendSlice) {
    const alerts = [];
    const declining = trendSlice?.declining || [];

    const citationDrop = declining.find((m) => m.key === 'citation_coverage_percent');
    if (citationDrop && citationDrop.delta !== null && citationDrop.delta !== undefined && citationDrop.delta < 0) {
        alerts.push({
            id: 'citation_coverage_drop',
            familyKey: 'signals',
            title: 'Baisse de couverture des citations',
            severity: 'avertissement',
            evidence: `Couverture des citations en recul de ${Math.abs(citationDrop.delta)} points sur la fenêtre observée.`,
            reliability: 'calculated',
            suggestedAction: 'Renforcer les prompts qui génèrent des citations fiables et vérifier les sources observées.',
        });
    }

    const mentionDrop = declining.find((m) => m.key === 'mention_rate_percent');
    if (mentionDrop && mentionDrop.delta !== null && mentionDrop.delta !== undefined && mentionDrop.delta < 0) {
        alerts.push({
            id: 'mention_rate_drop',
            familyKey: 'signals',
            title: 'Taux de mention en recul',
            severity: 'avertissement',
            evidence: `Taux de mention des prompts en baisse de ${Math.abs(mentionDrop.delta)} points.`,
            reliability: 'calculated',
            suggestedAction: 'Revoir le pack de prompts suivis avant la prochaine actualisation.',
        });
    }

    return alerts;
}

function buildCompetitorAlerts(trendSlice) {
    const alerts = [];
    const actionCenter = trendSlice?.actionCenter || [];

    const pressure = actionCenter.find((a) => a.id === 'competitor_pressure');
    if (pressure) {
        alerts.push({
            id: 'competitor_pressure',
            familyKey: 'competition',
            title: 'Pression concurrentielle élevée',
            severity: 'avertissement',
            evidence: 'Les mentions concurrentes sont élevées par rapport aux recommandations de marque.',
            reliability: 'calculated',
            suggestedAction: 'Analyser les concurrents les plus visibles et ajuster la stratégie de contenu.',
        });
    }

    return alerts;
}

function buildJobAlerts(trendSlice) {
    const alerts = [];
    const jobSummary = trendSlice?.jobs?.summary;

    if (jobSummary && (jobSummary.failedJobs || 0) > 0) {
        alerts.push({
            id: 'jobs_failed',
            familyKey: 'jobs',
            title: 'Jobs récurrents en échec',
            severity: 'critique',
            evidence: `${jobSummary.failedJobs} tâche(s) récurrente(s) en état d'échec.`,
            reliability: 'measured',
            suggestedAction: 'Consulter la page Suivi continu pour diagnostiquer et relancer les tâches en échec.',
        });
    }

    return alerts;
}

// ---------------------------------------------------------------------------
// Unsupported alert categories — shown for operator transparency
// ---------------------------------------------------------------------------
const UNSUPPORTED_ALERTS = [
    {
        id: 'unsupported_ai_presence',
        title: 'Perte de présence IA',
        reason: 'Aucun suivi continu de présence IA en temps réel n\'est disponible. Seul le taux de mention par snapshots est mesuré.',
    },
    {
        id: 'unsupported_competitor_dominant',
        title: 'Nouveau concurrent dominant',
        reason: 'Aucune détection de dominance concurrentielle n\'est implémentée. Seules les mentions brutes sont stockées.',
    },
    {
        id: 'unsupported_negative_citation',
        title: 'Citation négative',
        reason: 'Aucune analyse de sentiment sur les citations n\'est disponible dans le repo.',
    },
    {
        id: 'unsupported_llms_txt_stale',
        title: 'llms.txt obsolète',
        reason: 'Aucun suivi automatique de la fraîcheur du fichier llms.txt n\'est implémenté.',
    },
    {
        id: 'unsupported_external_brand',
        title: 'Contradiction de marque externe',
        reason: 'Seule la cohérence schema/dossier est vérifiée. Aucune réconciliation avec les annuaires ou profils tiers n\'est en place.',
    },
];

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function sortAlerts(alerts) {
    return [...alerts].sort((a, b) => {
        const severityDelta = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        if (severityDelta !== 0) return severityDelta;
        const familyA = FAMILY_META[a.familyKey]?.order ?? 99;
        const familyB = FAMILY_META[b.familyKey]?.order ?? 99;
        return familyA - familyB;
    });
}

function groupByFamily(alerts) {
    const groups = {};
    for (const alert of alerts) {
        const key = alert.familyKey;
        if (!groups[key]) {
            groups[key] = {
                familyKey: key,
                label: FAMILY_META[key]?.label || key,
                order: FAMILY_META[key]?.order ?? 99,
                alerts: [],
            };
        }
        groups[key].alerts.push(alert);
    }
    return Object.values(groups).sort((a, b) => a.order - b.order);
}

function buildOperatorSummary(alerts) {
    const total = alerts.length;
    const criticalCount = alerts.filter((a) => a.severity === 'critique').length;
    const warningCount = alerts.filter((a) => a.severity === 'avertissement').length;
    const infoCount = alerts.filter((a) => a.severity === 'info').length;
    const measuredCount = alerts.filter((a) => a.reliability === 'measured').length;
    const calculatedCount = alerts.filter((a) => a.reliability === 'calculated').length;

    let globalSeverity = 'ok';
    if (criticalCount > 0) globalSeverity = 'critique';
    else if (warningCount > 0) globalSeverity = 'avertissement';
    else if (infoCount > 0) globalSeverity = 'info';

    return {
        total,
        criticalCount,
        warningCount,
        infoCount,
        measuredCount,
        calculatedCount,
        globalSeverity,
        reliability: 'calculated',
        description: total === 0
            ? 'Aucune alerte GEO active détectée dans les signaux actuellement disponibles.'
            : criticalCount > 0
                ? `${criticalCount} alerte(s) critique(s) nécessitent une intervention prioritaire.`
                : `${total} alerte(s) active(s) identifiée(s) dans la veille GEO.`,
    };
}

function buildSystemStatus({ connectors, trendSlice }) {
    const connectorSummary = connectors?.summary || {};
    const freshness = trendSlice?.freshness || {};
    const jobSummary = trendSlice?.jobs?.summary || {};

    return {
        connectors: {
            configured: connectorSummary.configured || 0,
            healthy: connectorSummary.healthy || 0,
            error: connectorSummary.error || 0,
            notConnected: connectorSummary.not_connected || 0,
            disabled: connectorSummary.disabled || 0,
            reliability: (connectorSummary.configured || 0) > 0 ? 'measured' : 'unavailable',
        },
        jobs: {
            total: jobSummary.totalJobs || 0,
            active: jobSummary.activeJobs || 0,
            failed: jobSummary.failedJobs || 0,
            reliability: (jobSummary.totalJobs || 0) > 0 ? 'measured' : 'unavailable',
        },
        freshness: {
            audit: freshness.audit || { state: 'missing', hours: null },
            runs: freshness.runs || { state: 'missing', hours: null },
            mode: freshness.mode || null,
            reliability: 'calculated',
        },
    };
}

function buildRecommendations(alerts) {
    const recommendations = [];
    const seen = new Set();

    // Build from active alerts, prioritizing critiques
    const sorted = sortAlerts(alerts);
    for (const alert of sorted) {
        if (seen.has(alert.familyKey)) continue;
        seen.add(alert.familyKey);
        recommendations.push({
            title: alert.title,
            action: alert.suggestedAction,
            severity: alert.severity,
            reliability: 'calculated',
        });
        if (recommendations.length >= 5) break;
    }

    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Aucune correction prioritaire',
            action: 'Les signaux actuels ne remontent pas d\'alerte nécessitant une intervention immédiate. Poursuivre le suivi régulier.',
            severity: 'info',
            reliability: 'calculated',
        });
    }

    return recommendations;
}

export async function getAlertsSlice(clientId) {
    const [crawlerSlice, schemaSlice, consistencySlice, readinessSlice, trendSlice, connectors] =
        await Promise.all([
            getCrawlerSlice(clientId).catch(() => null),
            getSchemaSlice(clientId).catch(() => null),
            getConsistencySlice(clientId).catch(() => null),
            getReadinessSlice(clientId).catch(() => null),
            getTrendSlice(clientId).catch(() => null),
            getConnectorOverviewForClient(clientId).catch(() => null),
        ]);

    const allAlerts = [
        ...buildCrawlerAlerts(crawlerSlice),
        ...buildSchemaAlerts(schemaSlice),
        ...buildConsistencyAlerts(consistencySlice),
        ...buildReadinessAlerts(readinessSlice),
        ...buildFreshnessAlerts(trendSlice),
        ...buildConnectorAlerts(connectors),
        ...buildSignalAlerts(trendSlice),
        ...buildCompetitorAlerts(trendSlice),
        ...buildJobAlerts(trendSlice),
    ];

    const sorted = sortAlerts(allAlerts);
    const families = groupByFamily(sorted);
    const summary = buildOperatorSummary(sorted);
    const systemStatus = buildSystemStatus({ connectors, trendSlice });
    const recommendations = buildRecommendations(sorted);

    return {
        available: true,
        summary,
        alerts: sorted,
        families,
        systemStatus,
        recommendations,
        unsupportedAlerts: UNSUPPORTED_ALERTS,
        emptyState: null,
    };
}
