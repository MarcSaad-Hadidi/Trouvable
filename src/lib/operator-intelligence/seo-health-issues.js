import 'server-only';

import { normalizeAuditProblems } from '@/lib/truth/problems';

const PRIORITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sortIssues(left, right) {
    const leftPriority = PRIORITY_ORDER[left.priority] ?? 99;
    const rightPriority = PRIORITY_ORDER[right.priority] ?? 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return String(left.title || '').localeCompare(String(right.title || ''), 'fr-CA');
}

function isSeoHealthIssue(issue) {
    const haystack = [
        issue?.title,
        issue?.description,
        issue?.evidence_summary,
        issue?.recommended_fix,
        issue?.category,
        issue?.dimension,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return issue?.dimension === 'technical_seo'
        || issue?.category === 'technical'
        || /canonical|https|crawl|render|robots|crawler|schema|index|noindex|llms/i.test(haystack);
}

function issueReliability(issue) {
    const truthClass = issue?.truth_class || issue?.provenance;
    if (truthClass === 'observed') return 'measured';
    if (truthClass === 'derived') return 'calculated';
    if (truthClass === 'inferred' || truthClass === 'recommended') return 'ai_analysis';
    return 'unavailable';
}

function normalizeIssueCard(issue, audit) {
    const evidenceItems = toArray(issue?.evidence).map((item) => compactString(item?.summary)).filter(Boolean);
    const evidence = compactString(issue?.evidence_summary)
        || evidenceItems.join(' · ')
        || 'Preuve non detaillee dans cet audit.';
    const recommendedFix = compactString(issue?.recommended_fix)
        || 'Correction a preciser depuis la preuve observee.';
    const sourceUrl = compactString(issue?.affected_entity?.source_url)
        || compactString(audit?.resolved_url)
        || compactString(audit?.source_url);

    return {
        id: issue?.id || String(issue?.title || issue?.description || 'issue'),
        title: issue?.title || issue?.description || 'Point a corriger',
        description: issue?.description || issue?.title || 'Point a corriger',
        priority: issue?.priority || issue?.severity || 'medium',
        category: issue?.category || 'seo',
        dimension: issue?.dimension || null,
        truth_class: issue?.truth_class || issue?.provenance || 'unavailable',
        confidence: issue?.confidence || null,
        reliability: issueReliability(issue),
        evidence,
        recommendedFix,
        sourceUrl,
        affectedScope: issue?.affected_scope || issue?.surface || 'sitewide',
        promptAvailable: Boolean(issue?.id),
    };
}

export function getSeoHealthIssues(audit, { limit = 8 } = {}) {
    const normalized = normalizeAuditProblems(toArray(audit?.issues), {
        auditId: audit?.id || null,
        clientId: audit?.client_id || null,
        sourceUrl: audit?.resolved_url || audit?.source_url || null,
    });

    const issues = normalized
        .filter(isSeoHealthIssue)
        .map((issue) => normalizeIssueCard(issue, audit))
        .sort(sortIssues);

    if (typeof limit === 'number' && limit >= 0) return issues.slice(0, limit);
    return issues;
}
