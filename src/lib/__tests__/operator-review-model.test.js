import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    normalizeMergeSuggestionReviewItem,
    normalizeOpportunityReviewItem,
    normalizeRemediationSuggestionReviewItem,
} from '../truth/operator-review.js';

describe('operator review normalization', () => {
    it('normalizes opportunities into review items', () => {
        const item = normalizeOpportunityReviewItem({
            id: 'opp-1',
            client_id: 'client-1',
            audit_id: 'audit-1',
            title: 'Ajouter une FAQ locale',
            description: 'Le site manque de FAQ localisee.',
            priority: 'high',
            category: 'content',
            source: 'recommended',
            status: 'open',
            created_at: '2026-03-28T10:00:00.000Z',
        });

        expect(item.item_type).toBe('opportunity');
        expect(item.truth_class).toBe('recommended');
        expect(item.review_status).toBe('needs_review');
        expect(item.dedupe_key).toBeTruthy();
    });

    it('keeps pending merge suggestions in needs_review even when source is observed', () => {
        const item = normalizeMergeSuggestionReviewItem({
            id: 'merge-1',
            client_id: 'client-1',
            audit_id: 'audit-1',
            field_name: 'phone',
            current_value: '',
            suggested_value: '514-555-0000',
            confidence: 'high',
            source: 'observed',
            status: 'pending',
            created_at: '2026-03-28T10:00:00.000Z',
        });

        expect(item.item_type).toBe('merge_suggestion');
        expect(item.truth_class).toBe('observed');
        expect(item.review_status).toBe('needs_review');
        expect(item.confidence).toBe('high');
    });

    it('normalizes remediation drafts as recommended review items', () => {
        const item = normalizeRemediationSuggestionReviewItem({
            id: 'rem-1',
            client_id: 'client-1',
            problem_type: 'llms_txt_missing',
            problem_source: 'audit',
            severity: 'medium',
            status: 'draft',
            ai_output: '# Mon entreprise',
            created_at: '2026-03-28T10:00:00.000Z',
        });

        expect(item.item_type).toBe('remediation_suggestion');
        expect(item.truth_class).toBe('recommended');
        expect(item.review_status).toBe('needs_review');
        expect(item.type).toBe('llms_txt_missing');
    });
});