import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('google grounding', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        delete process.env.GOOGLE_SEARCH_API_KEY;
        delete process.env.GOOGLE_SEARCH_ENGINE_ID;
        delete process.env.TAVILY_API_KEY;
    });

    it('returns disabled payload when grounding is turned off', async () => {
        const { buildGoogleGroundingContext } = await import('@/lib/llm-comparison/google-grounding');
        const result = await buildGoogleGroundingContext({
            prompt: 'test',
            enabled: false,
        });
        expect(result.enabled).toBe(false);
        expect(result.items).toEqual([]);
    });

    it('uses tavily fallback when configured and google is absent', async () => {
        process.env.TAVILY_API_KEY = 'tvly-test';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                results: [
                    { title: 'Result 1', url: 'https://example.com/a', content: 'Snippet A' },
                ],
            }),
            text: async () => '',
        }));

        const { buildGoogleGroundingContext } = await import('@/lib/llm-comparison/google-grounding');
        const result = await buildGoogleGroundingContext({
            prompt: 'prompt',
            enabled: true,
        });
        expect(result.used_provider).toBe('tavily_web');
        expect(result.items.length).toBe(1);
        expect(result.text).toContain('https://example.com/a');
    });
});
