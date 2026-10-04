import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ ai: vi.fn(), extract: vi.fn(), grounding: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/index', () => ({ callAiText: io.ai }));
vi.mock('@/lib/llm-comparison/extract-content', () => ({ extractInputContent: io.extract }));
vi.mock('@/lib/llm-comparison/google-grounding', () => ({ buildGoogleGroundingContext: io.grounding }));

import { compareModels } from '../llm-comparison/compare-models.js';

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.extract.mockResolvedValue({ source_type: 'text', url: null, content: 'normalized content', content_preview: 'preview' });
    io.grounding.mockResolvedValue({ text: 'local fixture context', used_provider: 'fixture', items: [{}], error: null });
    for (const provider of ['GROQ', 'MISTRAL', 'OPENROUTER']) vi.stubEnv(`${provider}_MODEL_COMPARE`, `${provider.toLowerCase()}-fixture-model`);
    vi.stubEnv('GOOGLE_MODEL_COMPARE', 'gemini-fixture-model');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('comparison through actual adapters with simulated provider IO', () => {
    it('preserves provider order, latency, model errors and late timeout isolation', async () => {
        vi.stubEnv('GROQ_API_KEY', 'local-fixture-secret');
        io.ai.mockImplementation(({ providerOverride }) => {
            if (providerOverride === 'openrouter') return Promise.resolve({ text: 'router', usage: {} });
            return new Promise((resolve, reject) => {
                const delay = { gemini: 10, groq: 20, mistral: 80 }[providerOverride];
                setTimeout(() => {
                    if (providerOverride === 'groq') {
                        vi.stubEnv('GROQ_MODEL_COMPARE', 'groq-error-model');
                        reject(new Error('429 rate limit local-fixture-secret Bearer local-token'));
                    } else resolve({ text: providerOverride, usage: { prompt_tokens: 2, completion_tokens: 3 } });
                }, delay);
            });
        });
        const pending = compareModels({ text: 'raw', prompt: ' analyse ', providerTimeoutMs: 50 });
        await vi.advanceTimersByTimeAsync(50);
        const result = await pending;
        expect(result.results.map(({ provider, model, latency_ms, ok }) => ({ provider, model, latency_ms, ok }))).toEqual([
            { provider: 'gemini', model: 'gemini-fixture-model', latency_ms: 10, ok: true },
            { provider: 'groq', model: 'groq-error-model', latency_ms: 20, ok: false },
            { provider: 'mistral', model: 'mistral-fixture-model', latency_ms: 50, ok: false },
            { provider: 'openrouter', model: 'openrouter-fixture-model', latency_ms: 0, ok: true },
        ]);
        expect(result.results[0].usage).toEqual({ prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 });
        expect(result.results[1]).toMatchObject({ status: 'error', usage: null, content: null, error: { class: 'rate_limit', message: '429 rate limit [redacted] Bearer [redacted]' } });
        expect(result.results[2].error.class).toBe('timeout');
        expect(result.input).toEqual({ source_type: 'text', url: null, prompt: 'analyse', content_preview: 'preview' });
        expect(result.grounding).toEqual({ enabled: true, used_provider: 'fixture', results_count: 1, error: null });
        expect(io.ai.mock.calls.map(([request]) => request.providerOverride)).toEqual(['gemini', 'groq', 'mistral', 'openrouter']);
        for (const [request] of io.ai.mock.calls) {
            expect(request.fallbackProvider).toBeNull();
            expect(request.messages[1].content).toBe('Instruction:\n analyse \n\nContenu:\nnormalized content\n\n---\nContexte web externe (Google/Tavily):\nlocal fixture context');
        }
        await vi.advanceTimersByTimeAsync(40);
        expect(result.results[2].ok).toBe(false);
        expect(io.ai).toHaveBeenCalledTimes(4);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('retains four structured errors when all providers reject', async () => {
        io.ai.mockRejectedValue(new Error('provider local error'));
        const result = await compareModels({ text: 'raw', prompt: 'analyse', enableGoogleGrounding: false });
        expect(result.results).toHaveLength(4);
        expect(result.results.every((item) => !item.ok && item.error.class === 'provider_error' && item.latency_ms === 0)).toBe(true);
        expect(io.ai).toHaveBeenCalledTimes(4);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('rejects empty prompts before extracting input or calling providers', async () => {
        await expect(compareModels({ text: 'raw', prompt: '  ' })).rejects.toMatchObject({ errorClass: 'input_error' });
        expect(io.extract).not.toHaveBeenCalled();
        expect(io.grounding).not.toHaveBeenCalled();
        expect(io.ai).not.toHaveBeenCalled();
    });
});
