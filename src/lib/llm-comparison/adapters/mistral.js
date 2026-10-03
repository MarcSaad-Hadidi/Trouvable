import 'server-only';

import { callAiText } from '@/lib/ai/index';

export function getMistralCompareModel() {
    return process.env.MISTRAL_MODEL_COMPARE || 'mistral-small-2603';
}

export async function runMistralCompare({ prompt, content, modelOverride = null }) {
    const model = modelOverride || getMistralCompareModel();
    const response = await callAiText({
        providerOverride: 'mistral',
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
        provider: 'mistral',
        model,
        content: String(response?.text || '').trim(),
        usage: {
            prompt_tokens: Number(response?.usage?.prompt_tokens || 0),
            completion_tokens: Number(response?.usage?.completion_tokens || 0),
            total_tokens: Number((response?.usage?.prompt_tokens || 0) + (response?.usage?.completion_tokens || 0)),
        },
    };
}
