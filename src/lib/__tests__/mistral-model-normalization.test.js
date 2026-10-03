import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const chatCompleteMock = vi.fn();

vi.mock('@mistralai/mistralai', () => ({
    Mistral: class {
        constructor() {
            this.chat = { complete: chatCompleteMock };
        }
    },
}));

vi.mock('@/lib/llm-comparison/mistral-rate-limit', () => ({
    scheduleMistralRequest: vi.fn((fn) => fn()),
}));

const ORIGINAL_ENV = { ...process.env };

describe('Mistral model normalization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...ORIGINAL_ENV, MISTRAL_API_KEY: 'test-key' };
        chatCompleteMock.mockResolvedValue({
            choices: [{ message: { content: 'ok' } }],
            usage: { promptTokens: 10, completionTokens: 5 },
        });
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('normalizes deprecated mistral-small-latest override to default model', async () => {
        const { callMistral } = await import('../ai/providers/mistral.js');

        await callMistral({
            messages: [{ role: 'user', content: 'test' }],
            modelOverride: 'mistral-small-latest',
        });

        expect(chatCompleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'mistral-small-2603' }),
        );
    });

    it('normalizes deprecated mistral-small-2402 override', async () => {
        const { callMistral } = await import('../ai/providers/mistral.js');

        await callMistral({
            messages: [{ role: 'user', content: 'test' }],
            modelOverride: 'mistral-small-2402',
        });

        expect(chatCompleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'mistral-small-2603' }),
        );
    });

    it('passes valid model names through unchanged', async () => {
        const { callMistral } = await import('../ai/providers/mistral.js');

        await callMistral({
            messages: [{ role: 'user', content: 'test' }],
            modelOverride: 'mistral-small-2603',
        });

        expect(chatCompleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'mistral-small-2603' }),
        );
    });

    it('normalizes deprecated model name from env var', async () => {
        process.env.MISTRAL_MODEL_QUERY = 'mistral-small-latest';
        vi.resetModules();

        const { callMistral } = await import('../ai/providers/mistral.js');

        await callMistral({
            messages: [{ role: 'user', content: 'test' }],
            purpose: 'query',
        });

        expect(chatCompleteMock).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'mistral-small-2603' }),
        );
    });

    it('does not retry on invalid_model errors', async () => {
        chatCompleteMock.mockRejectedValue(new Error('Invalid model: mistral-foo'));

        const { callMistral } = await import('../ai/providers/mistral.js');

        await expect(
            callMistral({
                messages: [{ role: 'user', content: 'test' }],
                modelOverride: 'mistral-foo',
            }),
        ).rejects.toThrow('Invalid model');

        // Should only be called once — no retries for invalid model errors
        expect(chatCompleteMock).toHaveBeenCalledTimes(1);
    });
});
