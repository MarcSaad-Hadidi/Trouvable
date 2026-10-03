import 'server-only';

import { callAiText } from '@/lib/ai/index';

export function getGeminiCompareModel() {
    return process.env.GOOGLE_MODEL_COMPARE || process.env.GEMINI_MODEL_COMPARE || 'gemini-2.5-flash';
}

export async function runGeminiCompare({ prompt, content, modelOverride = null }) {
    const model = modelOverride || getGeminiCompareModel();
    const response = await callAiText({
        providerOverride: 'gemini',
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
        provider: 'gemini',
        model,
        content: String(response?.text || '').trim(),
        usage: {
            prompt_tokens: Number(response?.usage?.prompt_tokens || 0),
            completion_tokens: Number(response?.usage?.completion_tokens || 0),
            total_tokens: Number((response?.usage?.prompt_tokens || 0) + (response?.usage?.completion_tokens || 0)),
        },
    };
}
