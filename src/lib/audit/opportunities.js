import { normalizeTruthClass, defaultReviewStatusForTruthClass } from '../truth/definitions.js';

function normalizePriority(value) {
    return ['high', 'medium', 'low'].includes(value) ? value : 'medium';
}

function normalizeSource(value) {
    return ['observed', 'inferred', 'recommended'].includes(value) ? value : 'recommended';
}

function normalizeCategory(value, fallbackText = '') {
    if (['seo', 'geo', 'content', 'technical', 'trust'].includes(value)) return value;

    const text = `${value || ''} ${fallbackText || ''}`.toLowerCase();
    if (/(https|noindex|canonical|crawl|rendered|schema)/.test(text)) return 'technical';
    if (/(city|region|area served|zone|local|service area|adresse|maps)/.test(text)) return 'geo';
    if (/(faq|answer|content|service|offer|heading)/.test(text)) return 'content';
    if (/(trust|review|testimonial|proof|social|credib)/.test(text)) return 'trust';
    return 'seo';
}

function coerceIssue(issue) {
    if (typeof issue === 'string') {
        return {
            title: issue,
            description: issue,
            priority: 'medium',
            category: normalizeCategory('', issue),
            source: 'observed',
            evidence_summary: '',
            recommended_fix: '',
        };
    }

    return {
        title: issue?.title || issue?.description || 'Audit issue',
        description: issue?.description || issue?.title || 'Audit issue',
        priority: normalizePriority(issue?.priority || issue?.severity),
        category: normalizeCategory(issue?.category, `${issue?.title || ''} ${issue?.description || ''}`),
        source: normalizeSource(issue?.provenance === 'inferred' ? 'inferred' : 'observed'),
        evidence_summary: issue?.evidence_summary || '',
        recommended_fix: issue?.recommended_fix || '',
    };
}

function buildOpportunityDescription(base, evidenceSummary, recommendedFix) {
    return [base, evidenceSummary ? `Evidence: ${evidenceSummary}` : '', recommendedFix ? `Fix direction: ${recommendedFix}` : '']
        .filter(Boolean)
        .join(' ');
}

export function generateOpportunities({ clientId, auditId, deterministicIssues, aiOpportunities }) {
    const rows = [];

    for (const rawIssue of deterministicIssues || []) {
        const issue = coerceIssue(rawIssue);
        const truthClass = normalizeTruthClass(issue.source);
        rows.push({
            client_id: clientId,
            audit_id: auditId,
            title: issue.title.length > 120 ? `${issue.title.slice(0, 117)}...` : issue.title,
            description: buildOpportunityDescription(issue.description, issue.evidence_summary, issue.recommended_fix),
            priority: issue.priority,
            category: issue.category,
            source: issue.source,
            truth_class: truthClass,
            review_status: defaultReviewStatusForTruthClass(truthClass),
            status: 'open',
        });
    }

    for (const rawOpportunity of aiOpportunities || []) {
        if (!rawOpportunity?.title || !rawOpportunity?.description) continue;
        const aiSource = normalizeSource(rawOpportunity.source);
        const aiTruthClass = normalizeTruthClass(aiSource);
        rows.push({
            client_id: clientId,
            audit_id: auditId,
            title: rawOpportunity.title,
            description: buildOpportunityDescription(
                rawOpportunity.description,
                rawOpportunity.evidence_summary || '',
                rawOpportunity.recommended_fix || ''
            ),
            priority: normalizePriority(rawOpportunity.priority),
            category: normalizeCategory(rawOpportunity.category, `${rawOpportunity.title} ${rawOpportunity.description}`),
            source: aiSource,
            truth_class: aiTruthClass,
            review_status: defaultReviewStatusForTruthClass(aiTruthClass),
            status: 'open',
        });
    }

    return rows;
}
