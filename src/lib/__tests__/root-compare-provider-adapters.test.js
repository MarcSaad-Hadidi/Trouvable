import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { callAiText } = vi.hoisted(() => ({ callAiText: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/index', () => ({ callAiText }));

import { getCompareModel, runProviderCompare } from '../llm-comparison/provider-adapters.js';

const adapters = [
    ['gemini', 'gemini-2.5-flash', 'GOOGLE_MODEL_COMPARE', 'GEMINI_MODEL_COMPARE'],
    ['groq', 'llama-3.3-70b-versatile', 'GROQ_MODEL_COMPARE'],
    ['mistral', 'mistral-small-2603', 'MISTRAL_MODEL_COMPARE'],
    ['openrouter', 'openai/gpt-4o-mini', 'OPENROUTER_MODEL_COMPARE', 'OPENROUTER_MODEL_QUERY'],
];

beforeEach(() => {
    vi.resetAllMocks();
    for (const name of [
        'GOOGLE_MODEL_COMPARE',
        'GEMINI_MODEL_COMPARE',
        'GROQ_MODEL_COMPARE',
        'MISTRAL_MODEL_COMPARE',
        'OPENROUTER_MODEL_COMPARE',
        'OPENROUTER_MODEL_QUERY',
    ])
        vi.stubEnv(name, '');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(adapters)('%s comparison adapter', (provider, defaultModel, envName, fallbackEnvName) => {
    const getModel = () => getCompareModel(provider);
    const run = (args) => runProviderCompare(provider, args);
    it('reads model configuration at call time with existing precedence', () => {
        expect(getModel()).toBe(defaultModel);
        if (fallbackEnvName) {
            vi.stubEnv(fallbackEnvName, 'fallback-model');
            expect(getModel()).toBe('fallback-model');
        }
        vi.stubEnv(envName, 'first-model');
        expect(getModel()).toBe('first-model');
        vi.stubEnv(envName, 'second-model');
        expect(getModel()).toBe('second-model');
    });

    it('sends the bounded comparison request once without fallback and normalizes output', async () => {
        callAiText.mockResolvedValue({ text: '  réponse  ', usage: { prompt_tokens: 2, completion_tokens: 3 } });
        const output = await run({ prompt: 'analyse', content: 'contenu' });
        expect(callAiText.mock.calls).toEqual([
            [
                {
                    providerOverride: provider,
                    fallbackProvider: null,
                    purpose: 'query',
                    modelOverride: defaultModel,
                    temperature: 0.2,
                    maxTokens: 2048,
                    messages: [
                        { role: 'system', content: 'Tu es un analyste qui suit strictement l instruction donnee.' },
                        { role: 'user', content: 'Instruction:\nanalyse\n\nContenu:\ncontenu' },
                    ],
                },
            ],
        ]);
        expect(output).toEqual({
            provider,
            model: defaultModel,
            content: 'réponse',
            usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
        });
    });

    it('preserves explicit model overrides and absent response usage', async () => {
        callAiText.mockResolvedValue({});
        expect(await run({ prompt: 'p', content: 'c', modelOverride: 'override-model' })).toEqual({
            provider,
            model: 'override-model',
            content: '',
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
        expect(callAiText.mock.calls[0][0].modelOverride).toBe('override-model');
    });

    it('preserves provider errors without retrying or masking their identity', async () => {
        const error = new Error('provider local failure');
        callAiText.mockRejectedValue(error);
        await expect(run({ prompt: 'p', content: 'c' })).rejects.toBe(error);
        expect(callAiText).toHaveBeenCalledOnce();
    });
});
