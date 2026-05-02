import 'server-only';

import { normalizeClientProfileShape } from '@/lib/client-profile';
import * as db from '@/lib/db';
import { getReadinessSlice } from '@/lib/operator-intelligence/geo-readiness';
import { getOpportunitySlice } from '@/lib/operator-intelligence/opportunities';
import { getOverviewSlice } from '@/lib/operator-intelligence/overview';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';

import { buildActionabilityReport } from './actionability';
import { buildProtocolsReport } from './protocols';
import { buildAgentFixesEmptyState, buildAgentRemediationPipeline } from './remediation-pipeline';
import { computeAgentScore, deriveAgentInputs } from './score';

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
    const [opportunitySlice, overviewSlice, readinessSlice, clientRow, latestAudit] = await Promise.all([
        getOpportunitySlice(clientId).catch((error) => {
            console.error(`[agent-fixes-slice] opportunities ${clientId}`, error);
            return null;
        }),
        getOverviewSlice(clientId).catch((error) => {
            console.error(`[agent-fixes-slice] overview ${clientId}`, error);
            return null;
        }),
        getReadinessSlice(clientId).catch((error) => {
            console.error(`[agent-fixes-slice] readiness ${clientId}`, error);
            return null;
        }),
        db.getClientById(clientId).catch((error) => {
            console.error(`[agent-fixes-slice] client ${clientId}`, error);
            return null;
        }),
        db.getLatestAudit(clientId).catch((error) => {
            console.error(`[agent-fixes-slice] audit ${clientId}`, error);
            return null;
        }),
    ]);

    const client = clientRow ? normalizeClientProfileShape(clientRow) : null;
    const actionabilityReport = buildActionabilityReport({ client, audit: latestAudit });
    const protocolsReport = buildProtocolsReport({ audit: latestAudit });
    const inputs = deriveAgentInputs({
        overviewSlice,
        readinessSlice,
        actionabilityReport,
        protocolsReport,
    });
    const score = computeAgentScore(inputs);

    const remediation = buildAgentRemediationPipeline({
        opportunitySlice,
        readinessSlice,
        actionabilityReport,
        protocolsReport,
        overviewSlice,
        score,
    });

    return {
        provenance: {
            observed: getProvenanceMeta('observed'),
            derived: getProvenanceMeta('derived'),
        },
        summary: {
            total: remediation?.summary?.total ?? 0,
            open: remediation?.summary?.open ?? 0,
            highPriorityOpen: remediation?.summary?.highPriorityOpen ?? 0,
            inProgress: remediation?.summary?.inProgress ?? 0,
            pendingMergeCount: opportunitySlice?.summary?.pendingMergeCount ?? 0,
            reviewQueueCount: Math.max(
                remediation?.summary?.reviewQueue ?? 0,
                opportunitySlice?.summary?.reviewQueueCount ?? 0,
            ),
            remediationDraftCount: opportunitySlice?.summary?.remediationDraftCount ?? 0,
            derivedOpen: remediation?.summary?.derivedOpen ?? 0,
            opportunityOpen: opportunitySlice?.summary?.open ?? 0,
            uncoveredSubscores: remediation?.coverage?.uncoveredSubscores?.length ?? 0,
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

