import 'server-only';

import { getRecentAudits as dbGetRecentAudits } from '@/lib/db/audits';
import { getActions as dbGetActions } from '@/lib/db/actions';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

const SAFE_ACTION_TYPES = [
    'geo_queries_run',
    'geo_query_run_single',
    'geo_query_run_rerun',
    'geo_query_reparse',
    'geo_queries_benchmark_run',
    'tracked_query_created',
    'tracked_query_updated',
    'tracked_query_toggled',
    'tracked_query_deleted',
    'publication_state_changed',
    'client_onboarding_started',
    'client_onboarding_activated',
];

function mapAuditActivity(audit) {
    return {
        id: `audit-${audit.id}`,
        type: 'audit',
        title: 'Audit du site terminé',
        description: `SEO ${audit.seo_score ?? '-'} · GEO ${audit.geo_score ?? '-'}`,
        created_at: audit.created_at,
        provenance: getProvenanceMeta('observed'),
    };
}

function mapActionActivity(action) {
    if (action.action_type === 'geo_queries_run') {
        const total = Number(action.details?.total_queries || 0);
        const successful = Number(action.details?.successful || 0);
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Cycle de prompts terminé',
            description: `${successful}/${total} prompts suivis exécutés`,
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'geo_query_run_single') {
        const successful = Number(action.details?.successful || 0);
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Exécution unitaire terminée',
            description: successful > 0 ? 'Prompt exécuté avec succès.' : 'Prompt exécuté avec erreurs.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'geo_query_run_rerun') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: "Relance d'exécution",
            description: "Une exécution existante a été relancée depuis l'inspecteur.",
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'geo_query_reparse') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Reparse effectué',
            description: 'Le pipeline extraction/citations/concurrents a été réappliqué sur une exécution stockée.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'geo_queries_benchmark_run') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Benchmark sandbox exécuté',
            description: 'Comparaison multi-variantes terminée en mode sandbox gratuit.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'tracked_query_created') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Prompt suivi ajouté',
            description: 'Un nouveau prompt suivi a été ajouté.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'tracked_query_updated') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Prompt suivi mis à jour',
            description: 'Le texte ou la classification du prompt a été mis à jour.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'tracked_query_toggled') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Statut prompt modifié',
            description: action.details?.is_active ? 'Prompt réactivé.' : 'Prompt mis en pause.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'tracked_query_deleted') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Prompt suivi supprimé',
            description: 'Un prompt suivi a été retire de ce client.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'publication_state_changed') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Profil public mis à jour',
            description: action.details?.is_published ? 'Le profil public est publié.' : 'Le profil public repasse en brouillon.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'client_onboarding_started') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Onboarding démarré',
            description: 'Intake capture puis enrichissement automatique lancé.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    if (action.action_type === 'client_onboarding_activated') {
        return {
            id: `action-${action.id}`,
            type: action.action_type,
            title: 'Onboarding activé',
            description: 'Le profil brouillon a été finalise avec revue opérateur.',
            created_at: action.created_at,
            provenance: getProvenanceMeta('observed'),
        };
    }

    return null;
}

export async function getRecentSafeActivity(clientId, limit = 8) {
    const results = await Promise.allSettled([
        dbGetRecentAudits(clientId, limit), dbGetActions(clientId, SAFE_ACTION_TYPES, limit),
    ]);
    const audits = results[0].status === 'fulfilled' ? results[0].value : [];
    const actions = results[1].status === 'fulfilled' ? results[1].value : [];
    const dataSources = {};
    const errors = [];
    ['audits', 'actions'].forEach((source, index) => {
        dataSources[source] = results[index].status === 'rejected' ? 'unavailable' : results[index].value?.length ? 'available' : 'empty';
        if (dataSources[source] === 'unavailable') errors.push({ source, message: 'Données temporairement indisponibles.' });
    });
    const status = errors.length === 2 ? 'unavailable' : errors.length ? 'partial' : 'available';
    const auditItems = (audits || [])
        .filter((audit) => audit.scan_status === 'success' || audit.scan_status === 'partial_error')
        .map(mapAuditActivity);

    const actionItems = (actions || []).map(mapActionActivity).filter(Boolean);

    const items = [...auditItems, ...actionItems]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, limit);

    return {
        status, dataSources, errors,
        provenance: getProvenanceMeta('observed'),
        items,
        emptyState: {
            title: errors.length ? 'Activité temporairement indisponible' : 'Aucune activité récente partageable',
            description: 'Les audits terminés, exécutions et changements de publication apparaitront ici.',
        },
    };
}
