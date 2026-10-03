import 'server-only';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 2;

function getApiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('[AI/OpenRouter] OPENROUTER_API_KEY manquante');
    return key;
}

function getModel(purpose = 'audit') {
    if (purpose === 'query') return process.env.OPENROUTER_MODEL_QUERY || 'openai/gpt-4o-mini';
    return process.env.OPENROUTER_MODEL_AUDIT || 'openai/gpt-4o-mini';
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

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetchWithTimeout(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                    'X-Title': 'Trouvable',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                const msg = `[AI/OpenRouter] HTTP ${res.status}: ${errBody.slice(0, 300)}`;
                if (res.status === 429 || res.status >= 500) {
                    lastError = new Error(msg);
                    const wait = Math.min(2000 * 2 ** attempt, 8000);
                    console.warn(`[AI/OpenRouter] Retry ${attempt + 1}/${MAX_RETRIES} dans ${wait}ms...`);
                    await new Promise((r) => setTimeout(r, wait));
                    continue;
                }
                throw new Error(msg);
            }

            const data = await res.json();
            const choice = data.choices?.[0];
            if (!choice) throw new Error('[AI/OpenRouter] Reponse vide (pas de choices)');

            return {
                text: choice.message?.content || '',
                usage: data.usage || {},
                model,
            };
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') {
                lastError = new Error(`[AI/OpenRouter] Timeout apres ${DEFAULT_TIMEOUT}ms`);
            }
            if (attempt < MAX_RETRIES) {
                const wait = Math.min(2000 * 2 ** attempt, 8000);
                console.warn(`[AI/OpenRouter] Erreur: ${lastError.message}. Retry ${attempt + 1}...`);
                await new Promise((r) => setTimeout(r, wait));
            }
        }
    }

    throw lastError;
}
