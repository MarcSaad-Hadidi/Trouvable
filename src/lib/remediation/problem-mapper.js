import { createProblem, makeProblemId } from '@/lib/remediation/problem-types';

function toIso(value) {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function getGeoDiagnostics(run) {
    return {
        ...(run?.raw_analysis?.diagnostics || {}),
        ...(run?.parsed_response || {}),
    };
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function issueSearchText(issue) {
    return [
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
}

function isLlmsTxtMissingIssue(issue) {
    const text = issueSearchText(issue);
    if (!text.includes('llms.txt')) return false;

    return (
        text.includes('no llms.txt')
        || text.includes('missing llms.txt')
        || text.includes('does not expose an llms.txt file')
        || text.includes('no /llms.txt file was found')
        || text.includes('consider adding an llms.txt file')
    );
}

function isAiCrawlerBlockedIssue(issue) {
    const text = issueSearchText(issue);
    return (
        text.includes('ai crawler')
        && (text.includes('blocked') || text.includes('robots.txt'))
    );
}

function problemsFromCanonicalRunReview(run, clientId) {
    const canonicalProblems = Array.isArray(run?.raw_analysis?.review_contract?.problems)
        ? run.raw_analysis.review_contract.problems
        : Array.isArray(run?.raw_analysis?.truth_problems)
            ? run.raw_analysis.truth_problems
            : [];

    return canonicalProblems
        .filter((item) => item?.type)
        .map((item) => createProblem({
            id: item.id || makeProblemId(clientId, item.type, `${run?.tracked_query_id || run?.id || 'run'}:${item.type}`),
            clientId,
            source: 'geo_runs',
            type: item.type,
            severity: item.severity || 'medium',
            detectedAt: toIso(item.created_at || run?.created_at),
            context: {
                query_run_id: item.affected_entity?.query_run_id || run?.id || null,
                tracked_query_id: item.affected_entity?.tracked_query_id || run?.tracked_query_id || null,
                query_text: item.metadata?.query_text || run?.query_text || run?.tracked_queries?.query_text || null,
                review_status: item.review_status || null,
                truth_class: item.truth_class || null,
                evidence_summary: item.evidence_summary || null,
                recommended_fix: item.recommended_fix || null,
                dedupe_key: item.dedupe_key || null,
            },
        }));
}

function hoursSince(isoDate) {
    if (!isoDate) return null;
    const timestamp = new Date(isoDate).getTime();
    if (Number.isNaN(timestamp)) return null;
    return Math.round((Date.now() - timestamp) / (1000 * 60 * 60));
}

/**
 * Maps a single GEO run to normalized Problems (rule-based MVP).
 * Implemented rules:
 * - no_structured_faq => missing_faq_for_intent
 * - diagnostics mentioning schema gap => schema_missing_or_incoherent
 * - diagnostics mentioning local clarity weakness => weak_local_clarity
 */
export function problemsFromGeoRun(run, clientId) {
    if (!run || !clientId) return [];

    const canonicalProblems = problemsFromCanonicalRunReview(run, clientId);
    if (canonicalProblems.length > 0) return canonicalProblems;

    const diagnostics = getGeoDiagnostics(run);
    const zeroCitationReason = diagnostics.zero_citation_reason || null;
    const operatorReasonCodes = asArray(diagnostics.operator_reason_codes).map((item) => String(item || '').toLowerCase());
    const baseContext = {
        query_run_id: run.id || null,
        tracked_query_id: run.tracked_query_id || null,
        query_text: run.query_text || run.tracked_queries?.query_text || null,
        parse_status: run.parse_status || null,
        target_found: run.target_found === true,
        zero_citation_reason: zeroCitationReason,
        operator_reason_codes: operatorReasonCodes,
        response_excerpt: typeof run.response_text === 'string' ? run.response_text.slice(0, 280) : null,
    };

    const problems = [];

    if (zeroCitationReason === 'no_structured_faq') {
        problems.push(createProblem({
            id: makeProblemId(clientId, 'missing_faq_for_intent', `${run.tracked_query_id || run.id || 'unknown'}:no_structured_faq`),
            clientId,
            source: 'geo_runs',
            type: 'missing_faq_for_intent',
            severity: 'medium',
            detectedAt: toIso(run.created_at),
            context: baseContext,
        }));
    }

    const hasSchemaSignal =
        String(zeroCitationReason || '').includes('schema')
        || operatorReasonCodes.some((code) => code.includes('schema'));

    if (hasSchemaSignal) {
        problems.push(createProblem({
            id: makeProblemId(clientId, 'schema_missing_or_incoherent', `${run.tracked_query_id || run.id || 'unknown'}:schema`),
            clientId,
            source: 'geo_runs',
            type: 'schema_missing_or_incoherent',
            severity: 'medium',
            detectedAt: toIso(run.created_at),
            context: baseContext,
        }));
    }

    const hasWeakLocalSignal = operatorReasonCodes.some((code) => code.includes('local') && (code.includes('weak') || code.includes('clarity')));
    if (hasWeakLocalSignal) {
        problems.push(createProblem({
            id: makeProblemId(clientId, 'weak_local_clarity', `${run.tracked_query_id || run.id || 'unknown'}:local_clarity`),
            clientId,
            source: 'geo_runs',
            type: 'weak_local_clarity',
            severity: 'medium',
            detectedAt: toIso(run.created_at),
            context: baseContext,
        }));
    }

    return problems;
}

/**
 * Maps a rolling series of GEO runs to aggregate Problems.
 * Implemented rule:
 * - same tracked_query_id with >= minConsecutive misses (target_found=false) => target_never_found
 */
export function problemsFromGeoRuns(runs, clientId, options = {}) {
    if (!Array.isArray(runs) || runs.length === 0 || !clientId) return [];

    const minConsecutive = Number(options.minConsecutive || 3);
    const grouped = new Map();

    for (const run of runs) {
        const key = run?.tracked_query_id;
        if (!key) continue;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(run);
    }

    const problems = [];

    for (const [trackedQueryId, group] of grouped.entries()) {
        const sorted = [...group].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        let consecutiveMisses = 0;
        const sampleRunIds = [];

        for (const run of sorted) {
            if (run.target_found === true) break;
            consecutiveMisses += 1;
            if (sampleRunIds.length < 5 && run.id) sampleRunIds.push(run.id);
        }

        if (consecutiveMisses < minConsecutive) continue;

        const reference = sorted[0];
        const diagnostics = getGeoDiagnostics(reference);
        problems.push(createProblem({
            id: makeProblemId(clientId, 'target_never_found', `${trackedQueryId}:${consecutiveMisses}`),
            clientId,
            source: 'geo_runs',
            type: 'target_never_found',
            severity: consecutiveMisses >= 5 ? 'critical' : 'high',
            detectedAt: toIso(reference?.created_at),
            context: {
                tracked_query_id: trackedQueryId,
                query_text: reference?.query_text || reference?.tracked_queries?.query_text || null,
                consecutive_misses: consecutiveMisses,
                sampled_run_ids: sampleRunIds,
                latest_zero_citation_reason: diagnostics.zero_citation_reason || null,
                latest_operator_reason_codes: asArray(diagnostics.operator_reason_codes),
            },
        }));
    }

    return problems;
}

/**
 * Maps recurring job health signals to normalized Problems (rule-based MVP).
 * Implemented rules:
 * - audit_refresh final failure / repeated retries => job_audit_flaky
 * - prompt_rerun inactive or stale/no recent run => job_prompt_rerun_inactive
 */
export function problemsFromJobRun(jobRun, job, clientId) {
    if (!job || !clientId) return [];

    const now = new Date().toISOString();
    const jobType = job.job_type;
    const attemptCount = Number(jobRun?.attempt_count || 0);
    const maxAttempts = Number(jobRun?.max_attempts || 1);
    const hasFinalFailure = jobRun?.final_failure === true || (jobRun?.status === 'failed' && attemptCount >= maxAttempts);
    const hasRetryPattern = attemptCount > 1;

    const problems = [];

    if (jobType === 'audit_refresh' && (hasFinalFailure || hasRetryPattern)) {
        problems.push(createProblem({
            id: makeProblemId(clientId, 'job_audit_flaky', `${job.id}:${jobRun?.id || 'no_run'}`),
            clientId,
            source: 'continuous_jobs',
            type: 'job_audit_flaky',
            severity: hasFinalFailure ? 'high' : 'medium',
            detectedAt: toIso(jobRun?.created_at || now),
            context: {
                job_id: job.id,
                run_id: jobRun?.id || null,
                job_type: jobType,
                run_status: jobRun?.status || null,
                final_failure: hasFinalFailure,
                retry_count: attemptCount,
                max_attempts: maxAttempts,
                last_error: jobRun?.error_message || null,
            },
        }));
    }

    if (jobType === 'prompt_rerun') {
        const inactive = job.is_active !== true;
        const staleHours = hoursSince(job.last_run_at || jobRun?.created_at);
        const noRunEver = !job.last_run_at && !jobRun?.created_at;
        const stale = noRunEver || (typeof staleHours === 'number' && staleHours >= 72);

        if (inactive || stale) {
            problems.push(createProblem({
                id: makeProblemId(clientId, 'job_prompt_rerun_inactive', `${job.id}:${inactive ? 'inactive' : 'stale'}`),
                clientId,
                source: 'continuous_jobs',
                type: 'job_prompt_rerun_inactive',
                severity: inactive ? 'high' : 'medium',
                detectedAt: toIso(job.updated_at || now),
                context: {
                    job_id: job.id,
                    job_type: jobType,
                    is_active: job.is_active === true,
                    status: job.status || null,
                    last_run_at: job.last_run_at || null,
                    stale_hours: staleHours,
                    latest_run_id: jobRun?.id || null,
                },
            }));
        }
    }

    return problems;
}

/**
 * Optionally maps trend/action-center slices to normalized Problems.
 * Implemented rule:
 * - action center score/citation/prompt drop signals => visibility_declining
 */
export function problemsFromTrendSlice(trendSlice, clientId) {
    if (!trendSlice || !clientId) return [];

    const actionCenter = Array.isArray(trendSlice.actionCenter) ? trendSlice.actionCenter : [];
    const visibilitySignals = actionCenter.filter((item) => (
        String(item?.id || '').startsWith('score_drop_')
        || item?.id === 'citation_gap'
        || item?.id === 'prompt_coverage_gap'
    ));

    if (visibilitySignals.length === 0) return [];

    return [createProblem({
        id: makeProblemId(clientId, 'visibility_declining', visibilitySignals.map((item) => item.id).join('|')),
        clientId,
        source: 'action_center',
        type: 'visibility_declining',
        severity: visibilitySignals.some((item) => item?.priority === 'high') ? 'high' : 'medium',
        detectedAt: new Date().toISOString(),
        context: {
            signal_count: visibilitySignals.length,
            action_center_signals: visibilitySignals.map((item) => ({
                id: item.id,
                title: item.title || null,
                category: item.category || null,
                priority: item.priority || null,
                rationale: item.rationale || null,
            })),
        },
    })];
}

/**
 * Maps audit-originated issues to canonical Problems.
 * Inspects the audit's stored issues array for llms_txt_missing and ai_crawlers_blocked signals.
 */
export function problemsFromAuditResult(auditResult, clientId) {
    if (!auditResult || !clientId) return [];

    const issues = Array.isArray(auditResult.issues) ? auditResult.issues : [];
    const problems = [];

    // Detect llms_txt_missing from audit issues
    const llmsTxtIssue = issues.find((issue) => isLlmsTxtMissingIssue(issue));

    if (llmsTxtIssue) {
        problems.push(createProblem({
            id: makeProblemId(clientId, 'llms_txt_missing', `audit:${auditResult.id || 'latest'}`),
            clientId,
            source: 'audit',
            type: 'llms_txt_missing',
            severity: 'medium',
            detectedAt: toIso(auditResult.created_at),
            context: {
                audit_id: auditResult.id || null,
                issue_title: llmsTxtIssue.title,
                evidence_summary: llmsTxtIssue.evidence_summary || null,
                recommended_fix: llmsTxtIssue.recommended_fix || null,
            },
        }));
    }

    // Detect ai_crawlers_blocked from audit issues
    const crawlerBlockedIssue = issues.find((issue) => isAiCrawlerBlockedIssue(issue));

    if (crawlerBlockedIssue) {
        problems.push(createProblem({
            id: makeProblemId(clientId, 'ai_crawlers_blocked', `audit:${auditResult.id || 'latest'}`),
            clientId,
            source: 'audit',
            type: 'ai_crawlers_blocked',
            severity: 'high',
            detectedAt: toIso(auditResult.created_at),
            context: {
                audit_id: auditResult.id || null,
                issue_title: crawlerBlockedIssue.title,
                evidence_summary: crawlerBlockedIssue.evidence_summary || null,
                recommended_fix: crawlerBlockedIssue.recommended_fix || null,
            },
        }));
    }

    return problems;
}
