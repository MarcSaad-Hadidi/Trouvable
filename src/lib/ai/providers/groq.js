import 'server-only';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 2;

function getApiKey() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('[AI/Groq] GROQ_API_KEY manquante');
    return key;
}

function getModel(purpose = 'audit') {
    if (purpose === 'query') return process.env.GROQ_MODEL_QUERY || 'llama-3.3-70b-versatile';
    return process.env.GROQ_MODEL_AUDIT || 'llama-3.3-70b-versatile';
}

async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
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

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetchWithTimeout(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                const msg = `[AI/Groq] HTTP ${res.status}: ${errBody.slice(0, 300)}`;
                if (res.status === 429 || res.status >= 500) {
                    lastError = new Error(msg);
                    const wait = Math.min(2000 * 2 ** attempt, 8000);
                    console.warn(`[AI/Groq] Retry ${attempt + 1}/${MAX_RETRIES} dans ${wait}ms...`);
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                throw new Error(msg);
            }

            const data = await res.json();
            const choice = data.choices?.[0];
            if (!choice) throw new Error('[AI/Groq] Réponse vide (pas de choices)');

            return {
                text: choice.message?.content || '',
                usage: data.usage || {},
                model,
            };
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') {
                lastError = new Error(`[AI/Groq] Timeout après ${DEFAULT_TIMEOUT}ms`);
            }
            if (attempt < MAX_RETRIES) {
                const wait = Math.min(2000 * 2 ** attempt, 8000);
                console.warn(`[AI/Groq] Erreur: ${lastError.message}. Retry ${attempt + 1}...`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    }

    throw lastError;
}
