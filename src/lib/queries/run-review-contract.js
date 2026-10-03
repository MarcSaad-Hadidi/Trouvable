import 'server-only';

import { makeProblemId } from '@/lib/remediation/problem-types';
import { normalizeProblemForReview } from '@/lib/truth/operator-review';

function hasCode(codes = [], matcher = '') {
    const normalizedMatcher = String(matcher || '').toUpperCase();
    return (codes || []).some((code) => String(code || '').toUpperCase().includes(normalizedMatcher));
}

function buildBaseProblem({ clientId, queryRunId, trackedQueryId, queryText, createdAt, type, severity, context = {} }) {
    return {
        id: makeProblemId(clientId, type, `${trackedQueryId || queryRunId || queryText || 'run'}`),
        clientId,
        source: 'geo_runs',
        type,
        severity,
        detectedAt: createdAt,
        context: {
            query_run_id: queryRunId || null,
            tracked_query_id: trackedQueryId || null,
            query_text: queryText || null,
            ...context,
        },
    };
}

function summarizeReviewProblems(problems = []) {
    const summary = {
        total: problems.length,
        by_review_status: {},
        by_truth_class: {},
    };

    for (const problem of problems) {
        summary.by_review_status[problem.review_status] = (summary.by_review_status[problem.review_status] || 0) + 1;
        summary.by_truth_class[problem.truth_class] = (summary.by_truth_class[problem.truth_class] || 0) + 1;
    }

    return summary;
}

export function buildRunReviewContract({
    clientId,
    queryRunId,
    trackedQueryId = null,
    queryText = '',
    createdAt,
    extraction = {},
}) {
    const diagnostics = extraction?.diagnostics || {};
    const operatorReasonCodes = Array.isArray(diagnostics.operator_reason_codes) ? diagnostics.operator_reason_codes : [];
    const timestamp = createdAt || new Date().toISOString();
    const problems = [];

    if (diagnostics.zero_citation_reason === 'no_structured_faq') {
        problems.push(buildBaseProblem({
            clientId,
            queryRunId,
            trackedQueryId,
            queryText,
            createdAt: timestamp,
            type: 'missing_faq_for_intent',
            severity: 'medium',
            context: {
                zero_citation_reason: diagnostics.zero_citation_reason,
                operator_reason_codes: operatorReasonCodes,
                evidence_summary: 'Le run n’a pas detecte de support FAQ structure pour cette intention.',
                recommended_fix: 'Ajouter ou renforcer une FAQ ciblee sur cette intention, avec structure et couverture locale explicite.',
            },
        }));
    }

    if (String(diagnostics.zero_citation_reason || '').toLowerCase().includes('schema') || hasCode(operatorReasonCodes, 'SCHEMA')) {
        problems.push(buildBaseProblem({
            clientId,
            queryRunId,
            trackedQueryId,
            queryText,
            createdAt: timestamp,
            type: 'schema_missing_or_incoherent',
            severity: 'medium',
            context: {
                zero_citation_reason: diagnostics.zero_citation_reason,
                operator_reason_codes: operatorReasonCodes,
                evidence_summary: 'Le run remonte un signal schema.org manquant ou incoherent.',
                recommended_fix: 'Verifier le balisage schema.org expose, son type metier et sa coherence avec le contenu visible.',
            },
        }));
    }

    if (hasCode(operatorReasonCodes, 'LOCAL') && (hasCode(operatorReasonCodes, 'WEAK') || hasCode(operatorReasonCodes, 'CLARITY'))) {
        problems.push(buildBaseProblem({
            clientId,
            queryRunId,
            trackedQueryId,
            queryText,
            createdAt: timestamp,
            type: 'weak_local_clarity',
            severity: 'medium',
            context: {
                operator_reason_codes: operatorReasonCodes,
                evidence_summary: 'La reponse ne communique pas clairement la zone, le service ou le signal local attendus.',
                recommended_fix: 'Renforcer les signaux locaux visibles: zone desservie, ville cible, pages de service et formulation locale claire.',
            },
        }));
    }

    const normalizedProblems = problems.map((problem) => normalizeProblemForReview(problem, {
        clientId,
        queryRunId,
        trackedQueryId,
        queryText,
        createdAt: timestamp,
        source: 'geo_runs',
        sourceType: 'query_run_diagnostic',
        sourceTable: 'query_runs',
        entityType: 'query_run',
    }));

    return {
        problems: normalizedProblems,
        summary: summarizeReviewProblems(normalizedProblems),
        review_queue: normalizedProblems
            .filter((problem) => problem.review_status !== 'auto_accepted')
            .map((problem) => ({
                id: problem.id,
                type: problem.type,
                title: problem.title,
                review_status: problem.review_status,
                truth_class: problem.truth_class,
                confidence: problem.confidence,
            })),
    };
}