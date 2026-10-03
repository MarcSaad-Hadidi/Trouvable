import { describe, expect, it } from 'vitest';

import {
    problemsFromAuditResult,
    problemsFromGeoRun,
    problemsFromGeoRuns,
    problemsFromJobRun,
    problemsFromTrendSlice,
} from '../remediation/problem-mapper.js';

describe('problemsFromGeoRun()', () => {
    it('prefers canonical run review payloads when present', () => {
        const run = {
            id: 'run-1',
            tracked_query_id: 'tq-1',
            query_text: 'Quel plombier choisir ?',
            created_at: '2026-03-25T10:00:00.000Z',
            raw_analysis: {
                review_contract: {
                    problems: [
                        {
                            id: 'canonical-1',
                            type: 'schema_missing_or_incoherent',
                            severity: 'medium',
                            truth_class: 'inferred',
                            review_status: 'needs_review',
                            created_at: '2026-03-25T10:00:00.000Z',
                            evidence_summary: 'Le schema expose est incoherent.',
                            recommended_fix: 'Verifier le balisage schema.org.',
                            affected_entity: {
                                query_run_id: 'run-1',
                                tracked_query_id: 'tq-1',
                            },
                            metadata: {
                                query_text: 'Quel plombier choisir ?',
                            },
                        },
                    ],
                },
            },
        };

        const problems = problemsFromGeoRun(run, 'client-1');
        expect(problems).toHaveLength(1);
        expect(problems[0].type).toBe('schema_missing_or_incoherent');
        expect(problems[0].context.review_status).toBe('needs_review');
        expect(problems[0].context.evidence_summary).toBe('Le schema expose est incoherent.');
    });

    it('maps no_structured_faq to missing_faq_for_intent', () => {
        const run = {
            id: 'run-1',
            tracked_query_id: 'tq-1',
            query_text: 'Quel avocat en droit fiscal a Montreal ?',
            created_at: '2026-03-25T10:00:00.000Z',
            raw_analysis: { diagnostics: { zero_citation_reason: 'no_structured_faq' } },
        };

        const problems = problemsFromGeoRun(run, 'client-1');
        expect(problems.some((item) => item.type === 'missing_faq_for_intent')).toBe(true);
    });

    it('maps schema diagnostic signals', () => {
        const run = {
            id: 'run-2',
            tracked_query_id: 'tq-2',
            query_text: 'Cabinet fiscal local fiable',
            created_at: '2026-03-25T10:00:00.000Z',
            parsed_response: {
                operator_reason_codes: ['schema_incoherent_payload'],
            },
        };

        const problems = problemsFromGeoRun(run, 'client-1');
        expect(problems.some((item) => item.type === 'schema_missing_or_incoherent')).toBe(true);
    });
});

describe('problemsFromGeoRuns()', () => {
    it('creates target_never_found after consecutive misses', () => {
        const runs = [
            { id: 'r1', tracked_query_id: 'tq-1', query_text: 'q1', target_found: false, created_at: '2026-03-25T10:00:00.000Z' },
            { id: 'r2', tracked_query_id: 'tq-1', query_text: 'q1', target_found: false, created_at: '2026-03-24T10:00:00.000Z' },
            { id: 'r3', tracked_query_id: 'tq-1', query_text: 'q1', target_found: false, created_at: '2026-03-23T10:00:00.000Z' },
        ];

        const problems = problemsFromGeoRuns(runs, 'client-1');
        expect(problems.some((item) => item.type === 'target_never_found')).toBe(true);
    });
});

describe('problemsFromJobRun()', () => {
    it('maps flaky audit refresh runs', () => {
        const job = { id: 'job-1', job_type: 'audit_refresh', is_active: true, updated_at: '2026-03-25T10:00:00.000Z' };
        const run = { id: 'job-run-1', status: 'failed', attempt_count: 3, max_attempts: 3, error_message: 'timeout' };

        const problems = problemsFromJobRun(run, job, 'client-1');
        expect(problems.some((item) => item.type === 'job_audit_flaky')).toBe(true);
    });

    it('maps inactive prompt rerun jobs', () => {
        const job = { id: 'job-2', job_type: 'prompt_rerun', is_active: false, status: 'cancelled', updated_at: '2026-03-25T10:00:00.000Z' };

        const problems = problemsFromJobRun(null, job, 'client-1');
        expect(problems.some((item) => item.type === 'job_prompt_rerun_inactive')).toBe(true);
    });
});

describe('problemsFromTrendSlice()', () => {
    it('maps visibility decline signals', () => {
        const trendSlice = {
            actionCenter: [
                { id: 'score_drop_geo_score', title: 'Score GEO en baisse', priority: 'high' },
            ],
        };

        const problems = problemsFromTrendSlice(trendSlice, 'client-1');
        expect(problems.some((item) => item.type === 'visibility_declining')).toBe(true);
    });
});

describe('problemsFromAuditResult()', () => {
    it('maps llms.txt missing from semantic audit evidence, not only the exact title', () => {
        const audit = {
            id: 'audit-1',
            created_at: '2026-03-25T10:00:00.000Z',
            issues: [
                {
                    title: 'AI answerability gap',
                    description: 'The site does not expose an llms.txt file for AI systems.',
                    evidence_summary: 'No /llms.txt file was found at the domain root.',
                    recommended_fix: 'Consider adding an llms.txt file that describes the business.',
                    category: 'content',
                    dimension: 'ai_answerability',
                },
            ],
        };

        const problems = problemsFromAuditResult(audit, 'client-1');
        expect(problems.some((item) => item.type === 'llms_txt_missing')).toBe(true);
    });

    it('maps blocked AI crawlers from robots evidence even if the title changes', () => {
        const audit = {
            id: 'audit-2',
            created_at: '2026-03-25T10:00:00.000Z',
            issues: [
                {
                    title: 'Robots access issue',
                    description: 'Major AI crawlers are restricted by robots.txt rules.',
                    evidence_summary: 'Blocked: GPTBot, ClaudeBot.',
                    recommended_fix: 'Review robots.txt directives for GPTBot, ClaudeBot, and PerplexityBot.',
                    category: 'content',
                    dimension: 'ai_answerability',
                },
            ],
        };

        const problems = problemsFromAuditResult(audit, 'client-1');
        expect(problems.some((item) => item.type === 'ai_crawlers_blocked')).toBe(true);
    });
});
