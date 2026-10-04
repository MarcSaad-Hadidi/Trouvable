import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('response-contract', () => {
    it('sanitizes secrets in structured errors', async () => {
        process.env.GROQ_API_KEY = 'super-secret-key';
        const { toStructuredError } = await import('@/lib/llm-comparison/response-contract');
        const structured = toStructuredError(new Error('request failed with Bearer super-secret-key'));
        expect(structured.message).not.toContain('super-secret-key');
        expect(structured.message).toContain('[redacted]');
    });
});
