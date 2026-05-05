import 'server-only';

import * as db from '@/lib/db';
import { getProfileCompletenessSummary, getPublicationStatus } from '@/lib/client-profile';
import { getConnectorOverviewForClient } from '@/lib/connectors/index';
import { getOperatorWorkspaceShell } from '@/lib/operator-intelligence/base';
import { getRecentSafeActivity } from '@/lib/operator-intelligence/activity';
import { getRecurringJobHealthSlice } from '@/lib/continuous/jobs';
import { LIFECYCLE_META } from '@/lib/lifecycle';
import {
    mapOpportunitySourceToReliability,
    mapProvenanceToReliability,
} from '@/lib/operator-intelligence/reliability';
import { getSocialSlice } from '@/lib/operator-intelligence/social';
import { getVisibilitySlice } from '@/lib/operator-intelligence/visibility';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const PUBLICATION_LABELS = {
    draft: 'Brouillon',
    published: 'Publié',
};

const PRIORITY_LABELS = {
    high: 'Priorité haute',
    medium: 'Priorité moyenne',
    low: 'Priorité basse',
};

const JOB_LABELS = {
    audit_refresh: 'Audit quotidien',
    prompt_rerun: 'Cycle visibilité IA',
    gsc_sync_daily: 'Synchronisation Search Console',
    ga4_sync_daily: 'Synchronisation GA4',
    community_sync: 'Collecte communautaire',
};

const JOB_STATUS_LABELS = {
    pending: 'En attente',
    running: 'En cours',
    completed: 'Terminé',
    failed: 'Échec',
    cancelled: 'Annulé',
};

const COMMUNITY_RUN_STATUS_LABELS = {
    pending: 'En attente',
    running: 'En cours',
    completed: 'Terminée',
    failed: 'Échec',
    partial: 'Partielle',
};

const CONNECTOR_LABELS = {
    ga4: 'Google Analytics 4',
    gsc: 'Search Console',
    agent_reach: 'Intelligence communautaire',
};

const CONNECTOR_ROUTE_SEGMENTS = {
    ga4: '/seo/visibility',
    gsc: '/seo/visibility',
    agent_reach: '/geo/social',
};

const JOB_TYPE_BY_PROVIDER = {
    ga4: 'ga4_sync_daily',
    gsc: 'gsc_sync_daily',
    agent_reach: 'community_sync',
};

const DEFAULT_CONNECTOR_MESSAGES = {
    not_connected: 'Connecteur non connecté pour ce mandat.',
    configured: 'Connecteur configuré.',
    disabled: 'Connecteur désactivé pour ce mandat.',
    sample_mode: 'Mode échantillon actif.',
    error: 'Une erreur technique a été remontée par le connecteur.',
    healthy: 'Connecteur opérationnel.',
    syncing: 'Synchronisation en cours.',
};

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
    return [...new Set(toArray(values).map((value) => compactString(value)).filter(Boolean))];
}

function timeSince(value) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return null;

    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
}

function buildMetric({ id, label, value, detail = null, reliability = 'unavailable', href = null, accent = 'default' }) {
    return {
        id,
        label,
        value,
        detail,
        reliability,
        href,
        accent,
    };
}

function buildQuickLink({ id, label, description, href, section }) {
    return { id, label, description, href, section };
}

function getLocalizedConnectorMessage(status, rawMessage) {
    const message = compactString(rawMessage);
    if (!message) {
        return DEFAULT_CONNECTOR_MESSAGES[status] || 'Aucun signal technique remonté.';
    }

    const lower = message.toLowerCase();

    if (lower.includes('is not connected') || lower.includes('not connected')) {
        return DEFAULT_CONNECTOR_MESSAGES.not_connected;
    }

    if (lower.includes('connector is configured') && lower.includes('no data synced yet')) {
        return 'Connecteur configuré. Aucune donnée synchronisée pour le moment.';
    }

    if (lower.includes('no data synced yet')) {
        return 'Aucune donnée synchronisée pour le moment.';
    }

    if (lower.includes('disabled')) {
        return DEFAULT_CONNECTOR_MESSAGES.disabled;
    }

    if (lower.includes('sync') && lower.includes('progress')) {
        return DEFAULT_CONNECTOR_MESSAGES.syncing;
    }

    if (status === 'error' && lower.startsWith('error')) {
        return DEFAULT_CONNECTOR_MESSAGES.error;
    }

    return message;
}

function getTerritorySummary(client) {
    const address = client?.address || {};
    const business = client?.business_details || {};
    const seoData = client?.seo_data || {};

    const primary = compactString(address.city)
        || compactString(client?.target_region)
        || compactString(address.region)
        || null;

    const secondary = uniqueStrings([
        ...toArray(business.areas_served),
        ...toArray(seoData.target_cities),
    ]).filter((value) => String(value).toLowerCase() !== String(primary || '').toLowerCase());

    return {
        primary,
        secondary,
    };
}

function getServiceSummary(client) {
    const business = client?.business_details || {};
    const services = uniqueStrings(business.services);
    if (services.length > 0) {
        return {
            value: services.slice(0, 3).join(' · '),
            detail: services.length > 3 ? `${services.length} services renseignés` : 'Services renseignés dans le mandat',
        };
    }

    const shortDescription = compactString(business.short_desc || business.short_description);
    if (shortDescription) {
        return {
            value: shortDescription,
            detail: 'Description opérateur disponible',
        };
    }

    return {
        value: 'Indisponible',
        detail: 'Aucun service formellement renseigné dans le dossier',
    };
}

function getHeader(client, workspace) {
    const territory = getTerritorySummary(client);
    const subtitleParts = [compactString(client?.business_type), territory.primary].filter(Boolean);

    return {
        title: client?.client_name || 'Dossier partagé',
        subtitle: subtitleParts.join(' · ') || 'Lecture partagée du mandat',
        website: compactString(client?.website_url),
        territory: territory.primary,
        lifecycleLabel: LIFECYCLE_META[client?.lifecycle_status]?.label || client?.lifecycle_status || 'Non défini',
        publicationLabel: PUBLICATION_LABELS[getPublicationStatus(client)] || 'Brouillon',
        lastUpdatedAt: client?.updated_at || workspace?.refreshMarker || null,
    };
}

function mapActivityHref(type, baseHref) {
    if (type === 'audit') return `${baseHref}/seo/health`;
    if (String(type || '').startsWith('tracked_query')) return `${baseHref}/prompts`;
    if (type === 'publication_state_changed' || String(type || '').startsWith('client_onboarding')) return `${baseHref}/settings`;
    if (String(type || '').startsWith('geo_')) return `${baseHref}/runs`;
    return `${baseHref}/dossier/activity`;
}

function mapActivityCategory(type) {
    if (type === 'audit') return 'Audit';
    if (String(type || '').startsWith('tracked_query')) return 'Prompts';
    if (type === 'publication_state_changed') return 'Publication';
    if (String(type || '').startsWith('client_onboarding')) return 'Mandat';
    if (String(type || '').startsWith('geo_')) return 'Exécution IA';
    return 'Activité';
}

function mapSafeActivityItem(item, baseHref) {
    return {
        id: item.id,
        title: item.title,
        description: item.description || null,
        timestamp: item.created_at || null,
        href: mapActivityHref(item.type, baseHref),
        category: mapActivityCategory(item.type),
        reliability: mapProvenanceToReliability(item.provenance),
    };
}

function summarizeJobRun(run) {
    if (run.status === 'failed' && compactString(run.error_message)) {
        return compactString(run.error_message);
    }

    if (run.result_summary && typeof run.result_summary === 'object') {
        if (run.result_summary.skipped && compactString(run.result_summary.reason)) {
            return compactString(run.result_summary.reason);
        }

        if (compactString(run.result_summary.message)) {
            return compactString(run.result_summary.message);
        }
    }

    return `${JOB_LABELS[run.job_type] || run.job_type} · ${JOB_STATUS_LABELS[run.status] || run.status}`;
}

function mapJobRunItem(run, baseHref) {
    return {
        id: `job-${run.id}`,
        title: JOB_LABELS[run.job_type] || run.job_type,
        description: summarizeJobRun(run),
        timestamp: run.finished_at || run.started_at || run.created_at || null,
        href: `${baseHref}/continuous`,
        category: 'Automatisations',
        statusLabel: JOB_STATUS_LABELS[run.status] || run.status,
        reliability: 'measured',
    };
}

function summarizeCommunityRun(run) {
    const collected = Number(run?.documents_collected || 0);
    const persisted = Number(run?.documents_persisted || 0);

    if (run?.status === 'failed') {
        return 'La dernière collecte communautaire a échoué.';
    }

    if (run?.status === 'partial') {
        return `${persisted}/${Math.max(collected, persisted)} document(s) persistés.`;
    }

    if (run?.status === 'completed') {
        return `${persisted} document(s) persistés.`;
    }

    if (run?.status === 'running') {
        return 'Collecte communautaire en cours.';
    }

    return 'Collecte communautaire en attente.';
}

function shouldExposeCommunityRun(communityRun, recentRuns) {
    if (!communityRun) return false;
    if (communityRun.status === 'partial') return true;

    const latestCommunityJob = toArray(recentRuns).find((run) => run.job_type === 'community_sync');
    if (!latestCommunityJob) return true;

    const runStamp = new Date(latestCommunityJob.finished_at || latestCommunityJob.started_at || latestCommunityJob.created_at || 0).getTime();
    const collectionStamp = new Date(communityRun.finished_at || communityRun.started_at || 0).getTime();

    if (!Number.isFinite(runStamp) || !Number.isFinite(collectionStamp)) return true;
    return Math.abs(runStamp - collectionStamp) > 10 * 60 * 1000;
}

function mapCommunityRunItem(run, baseHref) {
    return {
        id: `community-${run.id}`,
        title: 'Collecte communautaire',
        description: summarizeCommunityRun(run),
        timestamp: run.finished_at || run.started_at || null,
        href: `${baseHref}/social`,
        category: 'Communauté',
        statusLabel: COMMUNITY_RUN_STATUS_LABELS[run.status] || run.status,
        reliability: 'measured',
    };
}

function getConnectorMetricRows(provider, visibility, social, snapshot, status) {
    const isUnavailable = status === 'not_connected';

    if (provider === 'ga4') {
        const hasData = Boolean(snapshot?.hasRealData && visibility?.kpis);
        return [
            buildMetric({
                id: 'sessions_28d',
                label: 'Sessions 28j',
                value: hasData ? visibility.kpis.sessions : 'n.d.',
                detail: hasData ? `${visibility.kpis.daysWithTraffic} jour(s) alimentés` : 'Aucune donnée GA4 synchronisée',
                reliability: hasData ? 'measured' : (isUnavailable ? 'unavailable' : 'unavailable'),
                accent: 'blue',
            }),
            buildMetric({
                id: 'pages_covered',
                label: 'Pages suivies',
                value: snapshot?.hasRealData ? toArray(snapshot.landingPages).length : 'n.d.',
                detail: snapshot?.hasRealData ? 'Top pages observées en base' : 'En attente de pages de destination',
                reliability: snapshot?.hasRealData ? 'measured' : (isUnavailable ? 'unavailable' : 'unavailable'),
                accent: 'blue',
            }),
        ];
    }

    if (provider === 'gsc') {
        const hasData = Boolean(snapshot?.hasRealData && visibility?.kpis);
        return [
            buildMetric({
                id: 'clicks_28d',
                label: 'Clics 28j',
                value: hasData ? visibility.kpis.totalClicks : 'n.d.',
                detail: hasData ? `${visibility.kpis.totalImpressions} impressions cumulées` : 'Aucune requête Search Console synchronisée',
                reliability: hasData ? 'measured' : (isUnavailable ? 'unavailable' : 'unavailable'),
                accent: 'emerald',
            }),
            buildMetric({
                id: 'query_count',
                label: 'Requêtes visibles',
                value: hasData ? visibility.kpis.gscQueryCount : 'n.d.',
                detail: hasData ? 'Fenêtre 28 jours consolidée' : 'En attente de première synchro',
                reliability: hasData ? 'measured' : (isUnavailable ? 'unavailable' : 'unavailable'),
                accent: 'emerald',
            }),
        ];
    }

    const hasCommunityState = status !== 'not_connected' || Boolean(social?.summary?.last_run);
    return [
        buildMetric({
            id: 'documents_count',
            label: 'Documents',
            value: hasCommunityState ? (social?.summary?.documents_count ?? snapshot?.documents_count ?? 0) : 'n.d.',
            detail: hasCommunityState
                ? `${social?.summary?.clusters_count ?? snapshot?.clusters_count ?? 0} cluster(s) observés`
                : 'Aucune collecte persistante visible',
            reliability: hasCommunityState ? 'measured' : 'unavailable',
            accent: 'violet',
        }),
        buildMetric({
            id: 'community_opportunities',
            label: 'Opportunités',
            value: hasCommunityState ? (social?.summary?.opportunities_count ?? snapshot?.opportunities_count ?? 0) : 'n.d.',
            detail: hasCommunityState
                ? `${social?.summary?.mentions_count ?? 0} mention(s) cumulée(s)`
                : 'En attente de première collecte',
            reliability: hasCommunityState ? 'measured' : 'unavailable',
            accent: 'amber',
        }),
    ];
}

function buildConnectorItems({ connectors, visibility, social, jobHealth, baseHref }) {
    const connections = new Map(toArray(connectors?.connections).map((row) => [row.provider, row]));
    const providerSnapshots = connectors?.providers || {};

    return Object.keys(CONNECTOR_LABELS).map((provider) => {
        const connection = connections.get(provider) || null;
        const snapshot = providerSnapshots[provider] || null;
        const status = connection?.status || snapshot?.status || 'not_connected';
        const relatedRuns = toArray(jobHealth?.runs)
            .filter((run) => run.job_type === JOB_TYPE_BY_PROVIDER[provider])
            .slice(0, 4);

        const incidents = [];
        if (compactString(connection?.last_error)) {
            incidents.push({
                id: `${provider}-connector-error`,
                label: 'Erreur du connecteur',
                description: compactString(connection.last_error),
                timestamp: connection.updated_at || connection.last_synced_at || null,
                reliability: 'measured',
            });
        }

        relatedRuns
            .filter((run) => run.status === 'failed' || run.status === 'cancelled')
            .slice(0, 2)
            .forEach((run) => {
                incidents.push({
                    id: `${provider}-${run.id}`,
                    label: JOB_LABELS[run.job_type] || run.job_type,
                    description: summarizeJobRun(run),
                    timestamp: run.finished_at || run.started_at || run.created_at || null,
                    reliability: 'measured',
                });
            });

        if (provider === 'agent_reach' && social?.summary?.last_run?.status === 'partial') {
            incidents.push({
                id: 'agent-reach-partial',
                label: 'Collecte partielle',
                description: summarizeCommunityRun(social.summary.last_run),
                timestamp: social.summary.last_run.finished_at || social.summary.last_run.started_at || null,
                reliability: 'measured',
            });
        }

        const latestRun = provider === 'agent_reach'
            ? (social?.summary?.last_run || snapshot?.last_run || null)
            : (relatedRuns[0] || null);

        const lastSyncedAt = snapshot?.lastSyncedAt
            || connection?.last_synced_at
            || latestRun?.finished_at
            || latestRun?.started_at
            || null;

        const detail = status === 'not_connected'
            ? 'Aucune source active pour ce mandat.'
            : lastSyncedAt
                ? `Dernière synchro ${timeSince(lastSyncedAt)}`
                : 'En attente de première synchronisation.';

        return {
            id: provider,
            provider,
            label: CONNECTOR_LABELS[provider],
            status,
            description: getLocalizedConnectorMessage(status, snapshot?.message || connection?.last_error),
            detail,
            href: `${baseHref}${CONNECTOR_ROUTE_SEGMENTS[provider]}`,
            reliability: status === 'not_connected' ? 'unavailable' : 'measured',
            hasRealData: Boolean(snapshot?.hasRealData),
            lastSyncedAt,
            latestRun: latestRun
                ? {
                    statusLabel: provider === 'agent_reach'
                        ? (COMMUNITY_RUN_STATUS_LABELS[latestRun.status] || latestRun.status)
                        : (JOB_STATUS_LABELS[latestRun.status] || latestRun.status),
                    timestamp: latestRun.finished_at || latestRun.started_at || latestRun.created_at || null,
                    detail: provider === 'agent_reach' ? summarizeCommunityRun(latestRun) : summarizeJobRun(latestRun),
                }
                : null,
            metrics: getConnectorMetricRows(provider, visibility, social, snapshot, status),
            incidents,
        };
    });
}

function sortByMostRecent(items) {
    return toArray(items).sort((left, right) => String(right.timestamp || '').localeCompare(String(left.timestamp || '')));
}

async function getSharedDossierContract(clientId) {
    const [shell, latestOpportunities, safeActivity, connectors, jobHealth, visibility, social] = await Promise.all([
        getOperatorWorkspaceShell(clientId),
        db.getLatestOpportunities(clientId).catch(() => ({ active: [], stale: [] })),
        getRecentSafeActivity(clientId, 12).catch(() => ({ items: [], emptyState: null })),
        getConnectorOverviewForClient(clientId).catch(() => ({ connections: [], providers: {}, summary: {} })),
        getRecurringJobHealthSlice(clientId).catch(() => ({ jobs: [], runs: [], summary: { statusCounts: {} } })),
        getVisibilitySlice(clientId).catch(() => ({ connectors: {}, kpis: null, emptyState: null })),
        getSocialSlice(clientId).catch(() => ({ summary: {}, emptyState: null })),
    ]);

    if (!shell?.client) return null;

    const client = shell.client;
    const workspace = shell.workspace || {};
    const baseHref = `/admin/clients/${clientId}`;
    const completeness = getProfileCompletenessSummary(client);
    const territory = getTerritorySummary(client);
    const services = getServiceSummary(client);
    const openItems = toArray(latestOpportunities?.active)
        .filter((item) => item.status === 'open')
        .sort((left, right) => {
            const leftPriority = PRIORITY_ORDER[left.priority] ?? 99;
            const rightPriority = PRIORITY_ORDER[right.priority] ?? 99;
            if (leftPriority !== rightPriority) return leftPriority - rightPriority;
            return String(right.created_at || '').localeCompare(String(left.created_at || ''));
        });

    const connectorItems = buildConnectorItems({
        connectors,
        visibility,
        social,
        jobHealth,
        baseHref,
    });

    const activityFeed = sortByMostRecent([
        ...toArray(safeActivity?.items).map((item) => mapSafeActivityItem(item, baseHref)),
        ...toArray(jobHealth?.runs).slice(0, 10).map((run) => mapJobRunItem(run, baseHref)),
        ...(shouldExposeCommunityRun(social?.summary?.last_run, jobHealth?.runs)
            ? [mapCommunityRunItem(social.summary.last_run, baseHref)]
            : []),
    ]).slice(0, 18);

    const connectorPreview = connectorItems.map((item) => ({
        id: item.id,
        label: item.label,
        status: item.status,
        detail: item.detail,
        reliability: item.reliability,
        href: `${baseHref}/dossier/connectors`,
    }));

    const connectorSummary = {
        configuredCount: connectorItems.filter((item) => item.status !== 'not_connected' && item.status !== 'disabled').length,
        withDataCount: connectorItems.filter((item) => item.hasRealData).length,
        alertCount: connectorItems.filter((item) => item.status === 'error' || item.incidents.length > 0).length,
    };

    const technicalIncidentCount = connectorItems.filter((item) => item.status === 'error' || item.incidents.length > 0).length
        + Number(jobHealth?.summary?.statusCounts?.failed || 0);

    return {
        generatedAt: new Date().toISOString(),
        header: getHeader(client, workspace),
        identityCards: [
            buildMetric({
                id: 'business_type',
                label: 'Marché',
                value: compactString(client.business_type) || 'Indisponible',
                detail: compactString(client.business_details?.short_desc || client.business_details?.short_description) || 'Type d’activité principal du mandat',
                reliability: compactString(client.business_type) ? 'measured' : 'unavailable',
                accent: 'violet',
            }),
            buildMetric({
                id: 'territory',
                label: 'Territoire',
                value: territory.primary || 'Indisponible',
                detail: territory.secondary.length > 0 ? `${territory.secondary.length} zone(s) secondaire(s)` : 'Aucune zone secondaire renseignée',
                reliability: territory.primary ? 'measured' : 'unavailable',
                accent: 'blue',
            }),
            buildMetric({
                id: 'services',
                label: 'Services',
                value: services.value,
                detail: services.detail,
                reliability: services.value === 'Indisponible' ? 'unavailable' : 'measured',
                accent: 'emerald',
            }),
            buildMetric({
                id: 'publication_status',
                label: 'Publication',
                value: PUBLICATION_LABELS[getPublicationStatus(client)] || 'Brouillon',
                detail: LIFECYCLE_META[client?.lifecycle_status]?.label || 'Cycle de vie non défini',
                reliability: 'measured',
                accent: 'amber',
            }),
        ],
        summaryCards: [
            buildMetric({
                id: 'shared_completeness',
                label: 'Dossier partagé',
                value: `${completeness.percentage}%`,
                detail: `${completeness.completedCount}/${completeness.totalCount} briques mandatées renseignées`,
                reliability: 'calculated',
                href: `${baseHref}/settings`,
                accent: 'blue',
            }),
            buildMetric({
                id: 'seo_summary',
                label: 'Visibilité Google',
                value: workspace.seoScore ?? 'n.d.',
                detail: visibility?.kpis
                    ? `${visibility.kpis.totalClicks} clic(s) GSC · ${visibility.kpis.sessions} session(s) GA4`
                    : (workspace.latestAuditAt ? `Dernier audit ${timeSince(workspace.latestAuditAt)}` : 'Aucun audit finalisé'),
                reliability: workspace.seoScore !== null && workspace.seoScore !== undefined ? 'measured' : 'unavailable',
                href: `${baseHref}/seo/health`,
                accent: 'emerald',
            }),
            buildMetric({
                id: 'geo_summary',
                label: 'Visibilité IA',
                value: workspace.geoScore ?? 'n.d.',
                detail: workspace.completedRunCount > 0
                    ? `${workspace.completedRunCount} exécution(s) terminée(s) · ${timeSince(workspace.latestRunAt) || 'Indisponible'}`
                    : 'Aucune exécution IA finalisée',
                reliability: workspace.geoScore !== null && workspace.geoScore !== undefined ? 'measured' : 'unavailable',
                href: `${baseHref}/geo`,
                accent: 'violet',
            }),
        ],
        freshnessCards: [
            buildMetric({
                id: 'latest_audit',
                label: 'Dernier audit',
                value: timeSince(workspace.latestAuditAt) || 'Indisponible',
                detail: workspace.latestAuditAt ? 'Audit site observé' : 'Aucun audit exploitable disponible',
                reliability: workspace.latestAuditAt ? 'measured' : 'unavailable',
                href: `${baseHref}/seo/health`,
                accent: 'emerald',
            }),
            buildMetric({
                id: 'latest_geo_run',
                label: 'Dernière exécution IA',
                value: timeSince(workspace.latestRunAt) || 'Indisponible',
                detail: workspace.latestRunAt ? `${workspace.completedRunCount} exécution(s) terminée(s) au total` : 'Aucune exécution terminée à date',
                reliability: workspace.latestRunAt ? 'measured' : 'unavailable',
                href: `${baseHref}/geo/runs`,
                accent: 'violet',
            }),
            buildMetric({
                id: 'latest_workspace_activity',
                label: 'Dernière activité opérateur',
                value: timeSince(workspace.latestActivityAt) || 'Indisponible',
                detail: workspace.latestActivityAt ? 'Dernière action tracée dans le mandat' : 'Aucune activité partageable récente',
                reliability: workspace.latestActivityAt ? 'measured' : 'unavailable',
                href: `${baseHref}/dossier/activity`,
                accent: 'amber',
            }),
        ],
        actions: {
            totalOpen: openItems.length,
            staleCount: Number(latestOpportunities?.stale?.length || 0),
            items: openItems.slice(0, 4).map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description || null,
                timestamp: item.created_at || null,
                href: `${baseHref}/geo/opportunities`,
                category: 'Action ouverte',
                statusLabel: PRIORITY_LABELS[item.priority] || 'Priorité à qualifier',
                reliability: mapOpportunitySourceToReliability(item.source),
            })),
            emptyState: {
                title: 'Aucune action ouverte visible',
                description: "La file d'actions se remplira à partir des audits, des opportunités détectées et des priorisations manuelles.",
            },
        },
        activity: {
            summaryCards: [
                buildMetric({
                    id: 'visible_events',
                    label: 'Événements visibles',
                    value: activityFeed.length,
                    detail: 'Audits, automations et actions partageables sur la fenêtre récente',
                    reliability: 'calculated',
                    accent: 'blue',
                }),
                buildMetric({
                    id: 'technical_incidents',
                    label: 'Incidents techniques',
                    value: technicalIncidentCount,
                    detail: technicalIncidentCount > 0 ? 'Échecs d’automatisations ou de connecteurs à revoir' : 'Aucun incident récent remonté',
                    reliability: 'calculated',
                    accent: technicalIncidentCount > 0 ? 'amber' : 'emerald',
                }),
                buildMetric({
                    id: 'open_actions',
                    label: 'Actions ouvertes',
                    value: openItems.length,
                    detail: Number(latestOpportunities?.stale?.length || 0) > 0
                        ? `${Number(latestOpportunities.stale.length)} action(s) héritée(s) d’un audit précédent`
                        : "File d'actions courante",
                    reliability: 'calculated',
                    accent: 'amber',
                }),
            ],
            items: activityFeed,
            emptyState: safeActivity?.emptyState || {
                title: 'Aucune activité récente partageable',
                description: 'Les audits, synchronisations et actions opérateur apparaîtront ici dès qu’ils sont tracés proprement.',
            },
        },
        connectors: {
            summaryCards: [
                buildMetric({
                    id: 'configured_connectors',
                    label: 'Connecteurs configurés',
                    value: `${connectorSummary.configuredCount}/3`,
                    detail: 'Sources rattachées au mandat',
                    reliability: 'calculated',
                    accent: 'blue',
                }),
                buildMetric({
                    id: 'connectors_with_data',
                    label: 'Sources alimentées',
                    value: connectorSummary.withDataCount,
                    detail: 'Connecteurs avec données observables en base',
                    reliability: 'calculated',
                    accent: 'emerald',
                }),
                buildMetric({
                    id: 'connector_alerts',
                    label: 'Sources à surveiller',
                    value: connectorSummary.alertCount,
                    detail: connectorSummary.alertCount > 0 ? 'Erreur ou incident récent détecté' : 'Aucun signal critique actif',
                    reliability: 'calculated',
                    accent: connectorSummary.alertCount > 0 ? 'amber' : 'emerald',
                }),
            ],
            items: connectorItems,
            preview: connectorPreview,
            emptyState: {
                title: 'Aucun connecteur actif',
                description: 'GA4, Search Console et Intelligence communautaire apparaîtront ici dès qu’une source est configurée.',
            },
        },
        quickLinks: {
            shared: [
                buildQuickLink({
                    id: 'shared-activity',
                    label: 'Activité dossier',
                    description: 'Audits, exécutions planifiées et actions récentes au même endroit.',
                    href: `${baseHref}/dossier/activity`,
                    section: 'Dossier partagé',
                }),
                buildQuickLink({
                    id: 'shared-connectors',
                    label: 'Connecteurs',
                    description: 'État GA4, Search Console et intelligence communautaire.',
                    href: `${baseHref}/dossier/connectors`,
                    section: 'Dossier partagé',
                }),
                buildQuickLink({
                    id: 'shared-settings',
                    label: 'Paramètres mandat',
                    description: 'Compléter le socle client, la publication et les informations opérateur.',
                    href: `${baseHref}/settings`,
                    section: 'Dossier partagé',
                }),
            ],
            seo: [
                buildQuickLink({
                    id: 'seo-visibility',
                    label: 'Visibilité SEO',
                    description: 'Lire les clics, impressions, requêtes et pages organiques (couche recherche).',
                    href: `${baseHref}/seo/visibility`,
                    section: 'Visibilité Google',
                }),
                buildQuickLink({
                    id: 'seo-health',
                    label: 'Santé SEO',
                    description: 'Relire les preuves d’audit, l’indexation, canonical, robots et les problèmes prioritaires.',
                    href: `${baseHref}/seo/health`,
                    section: 'Visibilité Google',
                }),
                buildQuickLink({
                    id: 'seo-on-page',
                    label: 'Optimisation on-page',
                    description: 'Prioriser titles, metas, H1, réponses directes, clarté locale et signaux E-E-A-T.',
                    href: `${baseHref}/seo/on-page`,
                    section: 'Visibilité Google',
                }),
            ],
            geo: [
                buildQuickLink({
                    id: 'geo-overview',
                    label: 'Vue d’ensemble IA',
                    description: 'Tableau de pilotage visibilité IA pour ce mandat.',
                    href: `${baseHref}/geo`,
                    section: 'Visibilité IA',
                }),
                buildQuickLink({
                    id: 'geo-runs',
                    label: 'Exécutions',
                    description: 'Inspecter les exécutions, les analyses et la fraîcheur du moteur.',
                    href: `${baseHref}/geo/runs`,
                    section: 'Visibilité IA',
                }),
                buildQuickLink({
                    id: 'geo-prompts',
                    label: 'Prompts suivis',
                    description: 'Activer, corriger ou prioriser le pack de prompts.',
                    href: `${baseHref}/geo/prompts`,
                    section: 'Visibilité IA',
                }),
                buildQuickLink({
                    id: 'geo-actions',
                    label: "File d'actions",
                    description: 'Traiter les opportunités ouvertes sans dupliquer le détail visibilité IA ici.',
                    href: `${baseHref}/geo/opportunities`,
                    section: 'Visibilité IA',
                }),
            ],
        },
    };
}

export async function getDossierOverviewSlice(clientId) {
    const contract = await getSharedDossierContract(clientId);
    if (!contract) return null;

    return {
        generatedAt: contract.generatedAt,
        header: contract.header,
        identityCards: contract.identityCards,
        summaryCards: contract.summaryCards,
        freshnessCards: contract.freshnessCards,
        actions: contract.actions,
        activity: {
            items: contract.activity.items.slice(0, 6),
            emptyState: contract.activity.emptyState,
        },
        connectors: {
            preview: contract.connectors.preview,
            items: contract.connectors.items,
            emptyState: contract.connectors.emptyState,
        },
        quickLinks: contract.quickLinks,
    };
}

export async function getDossierActivitySlice(clientId) {
    const contract = await getSharedDossierContract(clientId);
    if (!contract) return null;

    return {
        generatedAt: contract.generatedAt,
        header: contract.header,
        summaryCards: contract.activity.summaryCards,
        items: contract.activity.items,
        emptyState: contract.activity.emptyState,
        quickLinks: {
            shared: contract.quickLinks.shared,
            geo: contract.quickLinks.geo,
        },
    };
}

export async function getDossierConnectorsSlice(clientId) {
    const contract = await getSharedDossierContract(clientId);
    if (!contract) return null;

    return {
        generatedAt: contract.generatedAt,
        header: contract.header,
        summaryCards: contract.connectors.summaryCards,
        items: contract.connectors.items,
        emptyState: contract.connectors.emptyState,
        quickLinks: {
            shared: contract.quickLinks.shared,
            seo: contract.quickLinks.seo,
            geo: contract.quickLinks.geo,
        },
    };
}
