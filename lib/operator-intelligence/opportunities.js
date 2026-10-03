import 'server-only';

import { getLatestOpportunities as dbGetLatestOpportunities } from '@/lib/db/opportunities';
import { getMergeSuggestions as dbGetMergeSuggestions } from '@/lib/db/merge-suggestions';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { getProvenanceMeta, mapOpportunitySourceToProvenance } from '@/lib/operator-intelligence/provenance';
import { listRemediationSuggestionsForClient } from '@/lib/remediation/remediation-store';
import {
    normalizeMergeSuggestionReviewItem,
    normalizeOpportunityReviewItem,
    normalizeRemediationSuggestionReviewItem,
} from '@/lib/truth/operator-review';

const STATUS_ORDER = ['open', 'in_progress', 'done', 'dismissed'];
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function normalizeIssue(issue, index) {
    if (typeof issue === 'string') {
        return {
            id: `issue-${index}`,
            title: issue,
            description: issue,
            evidence_summary: '',
            recommended_fix: '',
            priority: 'medium',
            category: 'seo',
            truth_class: 'uncertain',
            confidence: 'low',
            review_status: 'blocked',
        };
    }

    return {
        id: issue?.id || `issue-${index}`,
        title: issue?.title || issue?.description || 'Point a corriger',
        description: issue?.description || issue?.title || 'Point a corriger',
        evidence_summary: issue?.evidence_summary || '',
        recommended_fix: issue?.recommended_fix || '',
        priority: issue?.priority || issue?.severity || 'medium',
        category: issue?.category || 'seo',
        truth_class: issue?.truth_class || issue?.provenance || 'uncertain',
        confidence: issue?.confidence || null,
        review_status: issue?.review_status || null,
        family: issue?.family || null,
        impact: issue?.impact || null,
        surface: issue?.surface || null,
    };
}

function sortOpportunities(a, b) {
    const priorityA = PRIORITY_ORDER[a.priority] ?? 99;
    const priorityB = PRIORITY_ORDER[b.priority] ?? 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

export async function getOpportunitySlice(clientId) {
    const results = await Promise.allSettled([
        dbGetLatestOpportunities(clientId), dbGetMergeSuggestions(clientId, 'pending'),
        dbGetLatestAudit(clientId), listRemediationSuggestionsForClient(clientId),
    ]);
    const loaded = results.map(result => result.status === 'fulfilled' ? result.value : null);
    const [latestOpportunities, mergeSuggestions, latestAudit, remediationSuggestions] = loaded;
    const activeRaw = latestOpportunities?.active || [];
    const staleRaw = latestOpportunities?.stale || [];
    const dataSources = {};
    const errors = [];
    ['opportunities', 'merges', 'audit', 'remediation'].forEach((source, index) => {
        const empty = source === 'opportunities' ? !activeRaw.length && !staleRaw.length
            : source === 'audit' ? !latestAudit : !loaded[index]?.length;
        dataSources[source] = results[index].status === 'rejected' ? 'unavailable' : empty ? 'empty' : 'available';
        if (dataSources[source] === 'unavailable') errors.push({ source, message: 'Données temporairement indisponibles.' });
    });
    const status = errors.length === 4 ? 'unavailable' : errors.length ? 'partial' : 'available';
    const activeOpportunities = (activeRaw || []).map((o) => ({
        ...o,
        provenance: mapOpportunitySourceToProvenance(o.source),
        isLatestAudit: true,
        ...normalizeOpportunityReviewItem(o),
    }));
    const staleOpportunities = (staleRaw || []).map((o) => ({
        ...o,
        provenance: mapOpportunitySourceToProvenance(o.source),
        isLatestAudit: false,
        ...normalizeOpportunityReviewItem(o),
    }));
    const normalizedMergeSuggestions = (mergeSuggestions || []).map((item) => ({
        ...item,
        review_item: normalizeMergeSuggestionReviewItem(item),
    }));
    const normalizedRemediationSuggestions = (remediationSuggestions || []).map((item) => ({
        ...item,
        review_item: normalizeRemediationSuggestionReviewItem(item),
    }));

    const byStatus = Object.fromEntries(STATUS_ORDER.map((status) => [
        status,
        activeOpportunities.filter((item) => item.status === status).sort(sortOpportunities),
    ]));

    const byCategory = [...new Set(activeOpportunities.map((item) => item.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'fr-CA'))
        .map((category) => ({
            category,
            count: activeOpportunities.filter((item) => item.category === category).length,
        }));

    const bySource = ['observed', 'inferred', 'recommended'].map((source) => ({
        source,
        count: activeOpportunities.filter((item) => item.source === source).length,
        provenance: mapOpportunitySourceToProvenance(source),
    }));

    const auditIssues = Array.isArray(latestAudit?.issues) ? latestAudit.issues.map(normalizeIssue) : [];
    const reviewQueue = [
        ...auditIssues,
        ...normalizedMergeSuggestions.map((item) => item.review_item),
        ...normalizedRemediationSuggestions.map((item) => item.review_item),
    ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return {
        status, dataSources, errors,
        provenance: {
            observation: getProvenanceMeta('observed'),
            summary: getProvenanceMeta('derived'),
        },
        summary: {
            total: dataSources.opportunities === 'unavailable' ? null : activeOpportunities.length,
            open: dataSources.opportunities === 'unavailable' ? null : byStatus.open.length,
            in_progress: dataSources.opportunities === 'unavailable' ? null : byStatus.in_progress.length,
            done: dataSources.opportunities === 'unavailable' ? null : byStatus.done.length,
            dismissed: dataSources.opportunities === 'unavailable' ? null : byStatus.dismissed.length,
            highPriorityOpen: dataSources.opportunities === 'unavailable' ? null : byStatus.open.filter((item) => item.priority === 'high').length,
            pendingMergeCount: dataSources.merges === 'unavailable' ? null : normalizedMergeSuggestions.length,
            staleOpportunitiesCount: dataSources.opportunities === 'unavailable' ? null : staleOpportunities.length,
            remediationDraftCount: dataSources.remediation === 'unavailable' ? null : normalizedRemediationSuggestions.filter((item) => item.status === 'draft').length,
            reviewQueueCount: ['audit', 'merges', 'remediation'].some(source => dataSources[source] === 'unavailable') ? null : reviewQueue.length,
        },
        byStatus,
        byCategory,
        bySource,
        mergeSuggestions: normalizedMergeSuggestions.slice(0, 12),
        remediationSuggestions: normalizedRemediationSuggestions.slice(0, 12),
        auditIssues: auditIssues.slice(0, 8),
        reviewQueue: reviewQueue.slice(0, 20),
        staleWarning: staleOpportunities.length > 0
            ? `${staleOpportunities.length} opportunité(s) liée(s) à un audit précédent, relancer un audit pour actualiser.`
            : null,
        emptyState: {
            noOpen: {
                title: dataSources.opportunities === 'unavailable' ? 'Opportunités temporairement indisponibles' : 'Aucune opportunite ouverte',
                description: 'Les opportunites apparaissent ici apres audit ou analyse des exécutions.',
            },
        },
    };
}
