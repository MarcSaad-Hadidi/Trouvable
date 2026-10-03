import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildRunReviewContract } from '../queries/run-review-contract.js';

describe('buildRunReviewContract()', () => {
    it('builds canonical review problems for FAQ and schema diagnostics', () => {
        const result = buildRunReviewContract({
            clientId: 'client-1',
            queryRunId: 'run-1',
            trackedQueryId: 'tracked-1',
            queryText: 'Meilleur plombier a Montreal',
            createdAt: '2026-03-28T12:00:00.000Z',
            extraction: {
                diagnostics: {
                    zero_citation_reason: 'no_structured_faq',
                    operator_reason_codes: ['schema_incoherent_payload'],
                },
            },
        });

        expect(result.problems).toHaveLength(2);
        expect(result.problems.some((item) => item.type === 'missing_faq_for_intent')).toBe(true);
        expect(result.problems.some((item) => item.type === 'schema_missing_or_incoherent')).toBe(true);
        expect(result.problems.every((item) => item.review_status === 'needs_review')).toBe(true);
        expect(result.problems.every((item) => item.provenance_entries[0].source_table === 'query_runs')).toBe(true);
        expect(result.summary.total).toBe(2);
        expect(result.review_queue).toHaveLength(2);
    });

    it('returns an empty contract when no supported diagnostics are present', () => {
        const result = buildRunReviewContract({
            clientId: 'client-1',
            queryRunId: 'run-1',
            extraction: {
                diagnostics: {
                    zero_citation_reason: 'no_source_detected',
                    operator_reason_codes: ['TARGET_NOT_FOUND'],
                },
            },
        });

        expect(result.problems).toEqual([]);
        expect(result.summary.total).toBe(0);
        expect(result.review_queue).toEqual([]);
    });
});