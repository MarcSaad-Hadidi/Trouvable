import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const extractInputContentMock = vi.fn();
vi.mock('@/lib/llm-comparison/extract-content', () => ({
    extractInputContent: extractInputContentMock,
}));

const runGeminiCompareMock = vi.fn();
const runGroqCompareMock = vi.fn();
const runMistralCompareMock = vi.fn();
const runOpenRouterCompareMock = vi.fn();
const buildGoogleGroundingContextMock = vi.fn();
vi.mock('@/lib/llm-comparison/adapters/gemini', () => ({
    runGeminiCompare: runGeminiCompareMock,
    getGeminiCompareModel: () => 'gemini-test-model',
}));
vi.mock('@/lib/llm-comparison/adapters/groq', () => ({
    runGroqCompare: runGroqCompareMock,
    getGroqCompareModel: () => 'groq-test-model',
}));
vi.mock('@/lib/llm-comparison/adapters/mistral', () => ({
    runMistralCompare: runMistralCompareMock,
    getMistralCompareModel: () => 'mistral-test-model',
}));
vi.mock('@/lib/llm-comparison/adapters/openrouter', () => ({
    runOpenRouterCompare: runOpenRouterCompareMock,
    getOpenRouterCompareModel: () => 'openrouter-test-model',
}));
vi.mock('@/lib/llm-comparison/google-grounding', () => ({
    buildGoogleGroundingContext: buildGoogleGroundingContextMock,
}));

describe('llm comparison orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildGoogleGroundingContextMock.mockResolvedValue({
            used_provider: null,
            items: [],
            text: '',
            error: null,
        });
        extractInputContentMock.mockResolvedValue({
            source_type: 'text',
            url: null,
            content: 'normalized content',
            content_preview: 'normalized content',
        });
    });

    it('returns full success with 4 providers', async () => {
        runGeminiCompareMock.mockResolvedValue({ model: 'gemini-a', content: 'g', usage: { prompt_tokens: 1, completion_tokens: 2 } });
        runGroqCompareMock.mockResolvedValue({ model: 'groq-a', content: 'q', usage: { prompt_tokens: 3, completion_tokens: 4 } });
        runMistralCompareMock.mockResolvedValue({ model: 'mistral-a', content: 'm', usage: { prompt_tokens: 5, completion_tokens: 6 } });
        runOpenRouterCompareMock.mockResolvedValue({ model: 'openrouter-a', content: 'o', usage: { prompt_tokens: 7, completion_tokens: 8 } });

        const { compareModels } = await import('@/lib/llm-comparison/compare-models');
        const result = await compareModels({ text: 'raw', prompt: 'analyse' });

        expect(result.contract_version).toBe('v1');
        expect(result.results).toHaveLength(4);
        expect(result.results.every((item) => item.ok)).toBe(true);
        expect(result.results.map((item) => item.provider)).toEqual(['gemini', 'groq', 'mistral', 'openrouter']);
        expect(result.grounding).toBeDefined();
    });

    it('supports partial success when one provider fails', async () => {
        runGeminiCompareMock.mockResolvedValue({ model: 'gemini-a', content: 'g', usage: {} });
        runGroqCompareMock.mockRejectedValue(new Error('Groq down'));
        runMistralCompareMock.mockResolvedValue({ model: 'mistral-a', content: 'm', usage: {} });
        runOpenRouterCompareMock.mockResolvedValue({ model: 'openrouter-a', content: 'o', usage: {} });

        const { compareModels } = await import('@/lib/llm-comparison/compare-models');
        const result = await compareModels({ text: 'raw', prompt: 'analyse' });

        const groq = result.results.find((item) => item.provider === 'groq');
        expect(groq.ok).toBe(false);
        expect(groq.error.class).toBe('provider_error');

        const successes = result.results.filter((item) => item.ok);
        expect(successes).toHaveLength(3);
    });

    it('marks provider as timeout when execution exceeds timeout', async () => {
        runGeminiCompareMock.mockResolvedValue({ model: 'gemini-a', content: 'g', usage: {} });
        runGroqCompareMock.mockImplementation(() => new Promise(() => {}));
        runMistralCompareMock.mockResolvedValue({ model: 'mistral-a', content: 'm', usage: {} });
        runOpenRouterCompareMock.mockResolvedValue({ model: 'openrouter-a', content: 'o', usage: {} });

        const { compareModels } = await import('@/lib/llm-comparison/compare-models');
        const result = await compareModels({ text: 'raw', prompt: 'analyse', providerTimeoutMs: 15 });

        const groq = result.results.find((item) => item.provider === 'groq');
        expect(groq.ok).toBe(false);
        expect(groq.error.class).toBe('timeout');
    });

    it('keeps a stable response shape', async () => {
        runGeminiCompareMock.mockResolvedValue({ model: 'gemini-a', content: 'g', usage: {} });
        runGroqCompareMock.mockResolvedValue({ model: 'groq-a', content: 'q', usage: {} });
        runMistralCompareMock.mockResolvedValue({ model: 'mistral-a', content: 'm', usage: {} });
        runOpenRouterCompareMock.mockResolvedValue({ model: 'openrouter-a', content: 'o', usage: {} });

        const { compareModels } = await import('@/lib/llm-comparison/compare-models');
        const result = await compareModels({ text: 'raw', prompt: 'analyse' });

        expect(result.contract_version).toBe('v1');
        expect(result.input).toMatchObject({
            source_type: expect.any(String),
            url: null,
            prompt: expect.any(String),
            content_preview: expect.any(String),
        });
        for (const item of result.results) {
            expect(item).toMatchObject({
                provider: expect.any(String),
                model: expect.any(String),
                ok: expect.any(Boolean),
                status: expect.any(String),
                latency_ms: expect.any(Number),
            });
            expect(Object.prototype.hasOwnProperty.call(item, 'usage')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(item, 'error')).toBe(true);
        }
    });
});
