import 'server-only';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT = 45_000;
const MAX_RETRIES = 2;

function getApiKey() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('[AI/Gemini] GEMINI_API_KEY manquante');
    return key;
}

function getModel(purpose = 'audit') {
    if (purpose === 'query') return process.env.GEMINI_MODEL_QUERY || 'gemini-2.5-flash';
    return process.env.GEMINI_MODEL_AUDIT || 'gemini-2.5-flash';
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
 * @param {string} [params.purpose]
 * @param {boolean} [params.jsonMode]
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @returns {Promise<{text:string, usage:{prompt_tokens:number,completion_tokens:number}}>}
 */
export async function callGemini({
    messages,
    purpose = 'audit',
    jsonMode = false,
    temperature = 0.2,
    maxTokens = 4096,
    modelOverride = null,
}) {
    const apiKey = getApiKey();
    const model = modelOverride || getModel(purpose);

    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const systemInstruction = messages.find(m => m.role === 'system');

    const body = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    if (jsonMode) {
        body.generationConfig.responseMimeType = 'application/json';
    }

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                const msg = `[AI/Gemini] HTTP ${res.status}: ${errBody.slice(0, 300)}`;
                if (res.status === 429 || res.status >= 500) {
                    lastError = new Error(msg);
                    const wait = Math.min(2000 * 2 ** attempt, 8000);
                    console.warn(`[AI/Gemini] Retry ${attempt + 1}/${MAX_RETRIES}...`);
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                throw new Error(msg);
            }

            const data = await res.json();
            const candidate = data.candidates?.[0];
            if (!candidate?.content?.parts?.[0]) {
                throw new Error('[AI/Gemini] Réponse vide (pas de candidates)');
            }

            const text = candidate.content.parts.map(p => p.text || '').join('');
            const usage = data.usageMetadata || {};

            return {
                text,
                usage: {
                    prompt_tokens: usage.promptTokenCount || 0,
                    completion_tokens: usage.candidatesTokenCount || 0,
                },
                model,
            };
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') {
                lastError = new Error(`[AI/Gemini] Timeout après ${DEFAULT_TIMEOUT}ms`);
            }
            if (attempt < MAX_RETRIES) {
                const wait = Math.min(2000 * 2 ** attempt, 8000);
                console.warn(`[AI/Gemini] Erreur: ${lastError.message}. Retry ${attempt + 1}...`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    }

    throw lastError;
}
