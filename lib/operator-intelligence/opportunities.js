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
    const [{ active: activeRaw, stale: staleRaw, latestAuditId: _latestAuditId }, mergeSuggestions, latestAudit, remediationSuggestions] = await Promise.all([
        dbGetLatestOpportunities(clientId),
        dbGetMergeSuggestions(clientId, 'pending').catch(() => []),
        dbGetLatestAudit(clientId).catch(() => null),
        listRemediationSuggestionsForClient(clientId).catch(() => []),
    ]);

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
        provenance: {
            observation: getProvenanceMeta('observed'),
            summary: getProvenanceMeta('derived'),
        },
        summary: {
            total: activeOpportunities.length,
            open: byStatus.open.length,
            in_progress: byStatus.in_progress.length,
            done: byStatus.done.length,
            dismissed: byStatus.dismissed.length,
            highPriorityOpen: byStatus.open.filter((item) => item.priority === 'high').length,
            pendingMergeCount: normalizedMergeSuggestions.length,
            staleOpportunitiesCount: staleOpportunities.length,
            remediationDraftCount: normalizedRemediationSuggestions.filter((item) => item.status === 'draft').length,
            reviewQueueCount: reviewQueue.length,
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
                title: 'Aucune opportunite ouverte',
                description: 'Les opportunites apparaissent ici apres audit ou analyse des exécutions.',
            },
        },
    };
}
