import 'server-only';

import { Mistral } from '@mistralai/mistralai';

import { scheduleMistralRequest } from '@/lib/llm-comparison/mistral-rate-limit';

const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 2;
const DEFAULT_MODEL = 'mistral-small-2603';

/** Deprecated model aliases that must be remapped to a valid model ID. */
const DEPRECATED_ALIASES = new Set([
    'mistral-small-latest',
    'mistral-small-2402',
    'mistral-small-2312',
    'mistral-small-2501',
]);

/**
 * Normalizes a Mistral model name — remaps deprecated aliases to the current
 * valid default so the API call does not fail with "Invalid model".
 */
function normalizeModel(model) {
    if (!model) return DEFAULT_MODEL;
    if (DEPRECATED_ALIASES.has(model)) {
        console.warn(`[AI/Mistral] Modele deprecie "${model}" remplace par "${DEFAULT_MODEL}".`);
        return DEFAULT_MODEL;
    }
    return model;
}

function getApiKey() {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) throw new Error('[AI/Mistral] MISTRAL_API_KEY manquante');
    return key;
}

function getModel(purpose = 'audit') {
    const raw = purpose === 'query'
        ? process.env.MISTRAL_MODEL_QUERY || process.env.MISTRAL_MODEL_COMPARE || DEFAULT_MODEL
        : process.env.MISTRAL_MODEL_AUDIT || process.env.MISTRAL_MODEL_COMPARE || DEFAULT_MODEL;
    return normalizeModel(raw);
}

function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`[AI/Mistral] Timeout apres ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function callMistral({
    messages,
    purpose = 'audit',
    temperature = 0.2,
    maxTokens = 4096,
    modelOverride = null,
}) {
    const apiKey = getApiKey();
    const client = new Mistral({ apiKey });
    const model = modelOverride ? normalizeModel(modelOverride) : getModel(purpose);

    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await scheduleMistralRequest(() => withTimeout(client.chat.complete({
                model,
                temperature,
                maxTokens,
                messages,
            }), DEFAULT_TIMEOUT));

            const usage = response?.usage || {};
            return {
                text: String(response?.choices?.[0]?.message?.content || ''),
                usage: {
                    prompt_tokens: Number(usage.promptTokens || usage.prompt_tokens || 0),
                    completion_tokens: Number(usage.completionTokens || usage.completion_tokens || 0),
                },
                model,
            };
        } catch (error) {
            lastError = error;
            const message = String(error?.message || '');
            // invalid_model errors will never succeed on retry — fail immediately
            if (message.includes('invalid_model') || message.includes('Invalid model')) break;
            const shouldRetry = message.includes('429') || message.toLowerCase().includes('rate') || message.toLowerCase().includes('timeout');
            if (attempt < MAX_RETRIES && shouldRetry) {
                const wait = Math.min(2000 * 2 ** attempt, 8000);
                console.warn(`[AI/Mistral] Erreur: ${message}. Retry ${attempt + 1}/${MAX_RETRIES} dans ${wait}ms...`);
                await new Promise((resolve) => setTimeout(resolve, wait));
                continue;
            }
        }
    }

    throw lastError || new Error('[AI/Mistral] Echec appel provider');
}
