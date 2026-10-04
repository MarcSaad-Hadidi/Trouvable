import 'server-only';
import { requestChatCompletion } from './chat-completions.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('[AI/OpenRouter] OPENROUTER_API_KEY manquante');
    return key;
}

function getModel(purpose = 'audit') {
    if (purpose === 'query') return process.env.OPENROUTER_MODEL_QUERY || 'openai/gpt-4o-mini';
    return process.env.OPENROUTER_MODEL_AUDIT || 'openai/gpt-4o-mini';
}

export async function callOpenRouter({
    messages,
    purpose = 'audit',
    jsonMode = false,
    temperature = 0.2,
    maxTokens = 4096,
    modelOverride = null,
}) {
    const apiKey = getApiKey();
    const model = modelOverride || getModel(purpose);
    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
    };
    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    return requestChatCompletion({
        url: OPENROUTER_API_URL,
        getHeaders: () => ({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Trouvable',
        }),
        body,
        errorPrefix: '[AI/OpenRouter]',
        emptyResponseMessage: 'Reponse vide (pas de choices)',
        timeoutMessage: 'Timeout apres',
    });
}
