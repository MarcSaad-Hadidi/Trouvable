import crypto from 'node:crypto';

/** @typedef {'geo_runs' | 'continuous_jobs' | 'action_center' | 'audit'} ProblemSource */
/** @typedef {'low' | 'medium' | 'high' | 'critical'} ProblemSeverity */
/** @typedef {'missing_faq_for_intent' | 'target_never_found' | 'weak_local_clarity' | 'schema_missing_or_incoherent' | 'job_audit_flaky' | 'job_prompt_rerun_inactive' | 'visibility_declining' | 'ai_crawlers_blocked' | 'llms_txt_missing'} ProblemType */
/** @typedef {'open' | 'in_review' | 'resolved' | 'ignored'} ProblemStatus */

/**
 * @typedef {Object} Problem
 * @property {string} id
 * @property {string} clientId
 * @property {ProblemSource} source
 * @property {ProblemType} type
 * @property {ProblemSeverity} severity
 * @property {string} detectedAt
 * @property {Record<string, any>} context
 * @property {ProblemStatus} status
 */

export const PROBLEM_SOURCES = ['geo_runs', 'continuous_jobs', 'action_center', 'audit'];
export const PROBLEM_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const PROBLEM_TYPES = [
    'missing_faq_for_intent',
    'target_never_found',
    'weak_local_clarity',
    'schema_missing_or_incoherent',
    'job_audit_flaky',
    'job_prompt_rerun_inactive',
    'visibility_declining',
    'ai_crawlers_blocked',
    'llms_txt_missing',
];
export const PROBLEM_STATUSES = ['open', 'in_review', 'resolved', 'ignored'];

export function makeProblemId(clientId, type, contextKey = '') {
    const normalized = [clientId || '', type || '', contextKey || '']
        .map((value) => String(value).trim().toLowerCase())
        .join('::');

    const digest = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 16);
    return `${clientId || 'unknown'}:${type || 'unknown'}:${digest}`;
}

/**
 * Creates a normalized Problem object with conservative defaults.
 * @param {Partial<Problem> & { clientId: string, source: ProblemSource, type: ProblemType }} input
 * @returns {Problem}
 */
export function createProblem(input) {
    const detectedAt = input.detectedAt || new Date().toISOString();
    const context = input.context && typeof input.context === 'object' ? input.context : {};
    const contextKey = context.context_key || context.query_text || context.job_id || context.job_type || detectedAt;

    return {
        id: input.id || makeProblemId(input.clientId, input.type, String(contextKey)),
        clientId: input.clientId,
        source: input.source,
        type: input.type,
        severity: input.severity || 'medium',
        detectedAt,
        context,
        status: input.status || 'open',
    };
}
