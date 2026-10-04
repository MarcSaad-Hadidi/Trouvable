import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAiTextMock = vi.fn();

vi.mock('@/lib/ai/index', () => ({
    callAiText: (...args) => callAiTextMock(...args),
}));

import { callMistralForRemediation, isMistralRemediationType } from '../remediation/remediation-ai.js';

describe('isMistralRemediationType()', () => {
    it('returns true for content and GEO types', () => {
        expect(isMistralRemediationType('missing_faq_for_intent')).toBe(true);
        expect(isMistralRemediationType('weak_local_clarity')).toBe(true);
        expect(isMistralRemediationType('schema_missing_or_incoherent')).toBe(true);
        expect(isMistralRemediationType('visibility_declining')).toBe(true);
    });

    it('returns false for technical types', () => {
        expect(isMistralRemediationType('job_audit_flaky')).toBe(false);
        expect(isMistralRemediationType('job_prompt_rerun_inactive')).toBe(false);
    });
});

describe('callMistralForRemediation()', () => {
    beforeEach(() => {
        callAiTextMock.mockReset();
    });

    it('returns structured output when provider call succeeds', async () => {
        callAiTextMock.mockResolvedValue({
            text: 'Suggestion test',
            model: 'mistral-small-2603',
        });

        const result = await callMistralForRemediation({
            system: 'system',
            user: 'user',
            clientId: 'client-1',
            problemType: 'missing_faq_for_intent',
        });

        expect(result).toEqual({
            text: 'Suggestion test',
            provider: 'mistral',
            model: 'mistral-small-2603',
        });
    });

    it('returns null on provider failure', async () => {
        callAiTextMock.mockRejectedValue(new Error('provider down'));

        const result = await callMistralForRemediation({
            system: 'system',
            user: 'user',
            clientId: 'client-1',
            problemType: 'missing_faq_for_intent',
        });

        expect(result).toBeNull();
    });
});
