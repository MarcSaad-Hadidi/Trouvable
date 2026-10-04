import 'server-only';

import { getRecentAudits as dbGetRecentAudits } from '@/lib/db/audits';
import { getActions as dbGetActions } from '@/lib/db/actions';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

const ACTION_COPY = {
    geo_queries_run: {
        title: 'Cycle de prompts terminé',
        description: (details) =>
            `${Number(details?.successful || 0)}/${Number(details?.total_queries || 0)} prompts suivis exécutés`,
    },
    geo_query_run_single: {
        title: 'Exécution unitaire terminée',
        description: (details) =>
            Number(details?.successful || 0) > 0 ? 'Prompt exécuté avec succès.' : 'Prompt exécuté avec erreurs.',
    },
    geo_query_run_rerun: {
        title: "Relance d'exécution",
        description: "Une exécution existante a été relancée depuis l'inspecteur.",
    },
    geo_query_reparse: {
        title: 'Reparse effectué',
        description: 'Le pipeline extraction/citations/concurrents a été réappliqué sur une exécution stockée.',
    },
    geo_queries_benchmark_run: {
        title: 'Benchmark sandbox exécuté',
        description: 'Comparaison multi-variantes terminée en mode sandbox gratuit.',
    },
    tracked_query_created: { title: 'Prompt suivi ajouté', description: 'Un nouveau prompt suivi a été ajouté.' },
    tracked_query_updated: {
        title: 'Prompt suivi mis à jour',
        description: 'Le texte ou la classification du prompt a été mis à jour.',
    },
    tracked_query_toggled: {
        title: 'Statut prompt modifié',
        description: (details) => (details?.is_active ? 'Prompt réactivé.' : 'Prompt mis en pause.'),
    },
    tracked_query_deleted: {
        title: 'Prompt suivi supprimé',
        description: 'Un prompt suivi a été retire de ce client.',
    },
    publication_state_changed: {
        title: 'Profil public mis à jour',
        description: (details) =>
            details?.is_published ? 'Le profil public est publié.' : 'Le profil public repasse en brouillon.',
    },
    client_onboarding_started: {
        title: 'Onboarding démarré',
        description: 'Intake capture puis enrichissement automatique lancé.',
    },
    client_onboarding_activated: {
        title: 'Onboarding activé',
        description: 'Le profil brouillon a été finalise avec revue opérateur.',
    },
};
const SAFE_ACTION_TYPES = Object.keys(ACTION_COPY);

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
    const copy = Object.hasOwn(ACTION_COPY, action.action_type) ? ACTION_COPY[action.action_type] : null;
    if (!copy) return null;
    return {
        id: `action-${action.id}`,
        type: action.action_type,
        title: copy.title,
        description: typeof copy.description === 'function' ? copy.description(action.details) : copy.description,
        created_at: action.created_at,
        provenance: getProvenanceMeta('observed'),
    };
}

export async function getRecentSafeActivity(clientId, limit = 8) {
    const results = await Promise.allSettled([
        dbGetRecentAudits(clientId, limit),
        dbGetActions(clientId, SAFE_ACTION_TYPES, limit),
    ]);
    const audits = results[0].status === 'fulfilled' ? results[0].value : [];
    const actions = results[1].status === 'fulfilled' ? results[1].value : [];
    const dataSources = {};
    const errors = [];
    ['audits', 'actions'].forEach((source, index) => {
        dataSources[source] =
            results[index].status === 'rejected' ? 'unavailable' : results[index].value?.length ? 'available' : 'empty';
        if (dataSources[source] === 'unavailable')
            errors.push({ source, message: 'Données temporairement indisponibles.' });
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
        status,
        dataSources,
        errors,
        provenance: getProvenanceMeta('observed'),
        items,
        emptyState: {
            title: errors.length ? 'Activité temporairement indisponible' : 'Aucune activité récente partageable',
            description: 'Les audits terminés, exécutions et changements de publication apparaitront ici.',
        },
    };
}
