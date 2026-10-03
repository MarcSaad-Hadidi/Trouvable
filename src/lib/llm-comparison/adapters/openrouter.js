import 'server-only';

import { callAiText } from '@/lib/ai/index';

export function getOpenRouterCompareModel() {
    return process.env.OPENROUTER_MODEL_COMPARE || process.env.OPENROUTER_MODEL_QUERY || 'openai/gpt-4o-mini';
}

export async function runOpenRouterCompare({ prompt, content, modelOverride = null }) {
    const model = modelOverride || getOpenRouterCompareModel();
    const response = await callAiText({
        providerOverride: 'openrouter',
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
        provider: 'openrouter',
        model,
        content: String(response?.text || '').trim(),
        usage: {
            prompt_tokens: Number(response?.usage?.prompt_tokens || 0),
            completion_tokens: Number(response?.usage?.completion_tokens || 0),
            total_tokens: Number((response?.usage?.prompt_tokens || 0) + (response?.usage?.completion_tokens || 0)),
        },
    };
}
