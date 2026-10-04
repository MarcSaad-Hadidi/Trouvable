import 'server-only';
import { requestChatCompletion } from './chat-completions.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('[AI/Groq] GROQ_API_KEY manquante');
    return key;
}

function getModel(purpose = 'audit') {
    if (purpose === 'query') return process.env.GROQ_MODEL_QUERY || 'llama-3.3-70b-versatile';
    return process.env.GROQ_MODEL_AUDIT || 'llama-3.3-70b-versatile';
}

/**
 * @param {Object} params
 * @param {Array<{role:string,content:string}>} params.messages
 * @param {string} [params.purpose] - 'audit' | 'query'
 * @param {boolean} [params.jsonMode] - force JSON response
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @returns {Promise<{text:string, usage:{prompt_tokens:number,completion_tokens:number}}>}
 */
export async function callGroq({
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
        url: GROQ_API_URL,
        getHeaders: () => ({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        }),
        body,
        errorPrefix: '[AI/Groq]',
        emptyResponseMessage: 'Réponse vide (pas de choices)',
        timeoutMessage: 'Timeout après',
    });
}
