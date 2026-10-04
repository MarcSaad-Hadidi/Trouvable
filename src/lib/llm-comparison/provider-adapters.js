import 'server-only';

import { callAiText } from '@/lib/ai/index';
import { LlmComparisonError } from './response-contract';

/** Resolve comparison models at call time, including the existing env aliases. */
export function getCompareModel(provider) {
    switch (provider) {
        case 'gemini':
            return process.env.GOOGLE_MODEL_COMPARE || process.env.GEMINI_MODEL_COMPARE || 'gemini-2.5-flash';
        case 'groq':
            return process.env.GROQ_MODEL_COMPARE || 'llama-3.3-70b-versatile';
        case 'mistral':
            return process.env.MISTRAL_MODEL_COMPARE || 'mistral-small-2603';
        case 'openrouter':
            return process.env.OPENROUTER_MODEL_COMPARE || process.env.OPENROUTER_MODEL_QUERY || 'openai/gpt-4o-mini';
        default:
            throw new LlmComparisonError('runtime_error', `Provider compare inconnu: ${provider}`);
    }
}

export async function runProviderCompare(provider, { prompt, content, modelOverride = null }) {
    const model = modelOverride || getCompareModel(provider);
    const response = await callAiText({
        providerOverride: provider,
        fallbackProvider: null,
        purpose: 'query',
        modelOverride: model,
        temperature: 0.2,
        maxTokens: 2048,
        messages: [
            { role: 'system', content: 'Tu es un analyste qui suit strictement l instruction donnee.' },
            { role: 'user', content: `Instruction:\n${prompt}\n\nContenu:\n${content}` },
        ],
    });
    return {
        provider,
        model,
        content: String(response?.text || '').trim(),
        usage: {
            prompt_tokens: Number(response?.usage?.prompt_tokens || 0),
            completion_tokens: Number(response?.usage?.completion_tokens || 0),
            total_tokens: Number((response?.usage?.prompt_tokens || 0) + (response?.usage?.completion_tokens || 0)),
        },
    };
}
