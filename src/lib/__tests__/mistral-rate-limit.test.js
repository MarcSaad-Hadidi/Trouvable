import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('MistralRateLimiter', () => {
    it('serializes calls with >= interval spacing', async () => {
        const { MistralRateLimiter } = await import('@/lib/llm-comparison/mistral-rate-limit');
        const limiter = new MistralRateLimiter(40);
        const starts = [];

        await Promise.all([
            limiter.schedule(async () => {
                starts.push(Date.now());
                return 'a';
            }),
            limiter.schedule(async () => {
                starts.push(Date.now());
                return 'b';
            }),
            limiter.schedule(async () => {
                starts.push(Date.now());
                return 'c';
            }),
        ]);

        expect(starts).toHaveLength(3);
        expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(35);
        expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(35);
    });
});
