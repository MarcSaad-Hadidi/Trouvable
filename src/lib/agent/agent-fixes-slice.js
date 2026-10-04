import 'server-only';

import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import { loadAgentWorkspace } from './agent-workspace';
import { buildAgentFixesEmptyState } from './remediation-pipeline';

function normalizeStaleWarning(staleWarning) {
    if (!staleWarning) return null;
    if (typeof staleWarning === 'string') return { message: staleWarning };
    if (typeof staleWarning?.message === 'string') return staleWarning;
    return { message: String(staleWarning) };
}

function buildExecutionKanban(remediation) {
    const items = remediation?.items || [];
    const todo = [];
    const inProgress = [];
    const verification = [];
    const done = [];

    for (const item of items) {
        const status = item.status;
        if (status === 'dismissed') continue;
        if (status === 'done') {
            done.push(item);
            continue;
        }
        if (status === 'in_progress') {
            inProgress.push(item);
        } else if (status === 'needs_review') {
            verification.push(item);
        } else {
            todo.push(item);
        }
    }

    return {
        todo,
        inProgress,
        verification,
        done: done.slice(0, 30),
    };
}

function buildAuditEvidence(opportunitySlice) {
    const issues = (opportunitySlice?.auditIssues || []).slice(0, 5).map((issue) => ({
        id: issue.id,
        title: issue.title,
        priority: issue.priority,
        category: issue.category,
        evidence_summary: issue.evidence_summary,
        recommended_fix: issue.recommended_fix,
        truth_class: issue.truth_class,
    }));

    const reviewItems = (opportunitySlice?.reviewQueue || [])
        .filter((item) => item.item_type !== 'opportunity')
        .slice(0, 5)
        .map((item, index) => ({
            id: item.id || `review-${index}`,
            title: item.title || 'Élément à revoir',
            priority: item.severity || 'medium',
            category: item.family || item.category || 'revue',
            evidence_summary: item.evidence_summary || item.description || null,
            recommended_fix: item.recommended_fix || null,
            truth_class: item.truth_class || null,
        }));

    return [...issues, ...reviewItems].slice(0, 8);
}

export async function getAgentFixesSlice(clientId) {
    const { status, dataSources, errors, opportunitySlice, remediation } = await loadAgentWorkspace(clientId);

    return {
        status,
        dataSources,
        errors,
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        summary: {
            total: remediation?.summary?.total ?? null,
            open: remediation?.summary?.open ?? null,
            highPriorityOpen: remediation?.summary?.highPriorityOpen ?? null,
            inProgress: remediation?.summary?.inProgress ?? null,
            pendingMergeCount: opportunitySlice?.summary?.pendingMergeCount ?? null,
            reviewQueueCount:
                remediation?.summary?.reviewQueue === null || opportunitySlice?.summary?.reviewQueueCount === null
                    ? null
                    : Math.max(
                          remediation?.summary?.reviewQueue ?? 0,
                          opportunitySlice?.summary?.reviewQueueCount ?? 0,
                      ),
            remediationDraftCount: opportunitySlice?.summary?.remediationDraftCount ?? null,
            derivedOpen: remediation?.summary?.derivedOpen ?? null,
            opportunityOpen: opportunitySlice?.summary?.open ?? null,
            uncoveredSubscores:
                remediation.status === 'available' ? remediation.coverage.uncoveredSubscores.length : null,
        },
        byPriority: remediation?.byPriority || { high: 0, medium: 0, low: 0 },
        bySource: remediation?.bySource || {},
        topFixes: (remediation?.topFixes || []).slice(0, 8),
        kanban: buildExecutionKanban(remediation),
        auditEvidence: buildAuditEvidence(opportunitySlice),
        staleWarning: normalizeStaleWarning(opportunitySlice?.staleWarning),
        coherence: remediation?.coverage || {
            hasKnownGaps: false,
            subscoreGaps: [],
            uncoveredSubscores: [],
        },
        links: {
            geoOpportunities: `/admin/clients/${clientId}/geo/opportunities`,
            agentOverview: `/admin/clients/${clientId}/agent`,
            actionability: `/admin/clients/${clientId}/agent/actionability`,
            protocols: `/admin/clients/${clientId}/agent/protocols`,
            readiness: `/admin/clients/${clientId}/agent/readiness`,
        },
        emptyState: buildAgentFixesEmptyState({ opportunitySlice, remediation }),
    };
}
