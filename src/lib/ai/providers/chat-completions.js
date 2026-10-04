import 'server-only';

const DEFAULT_TIMEOUT = 30_000;

const MAX_RETRIES = 2;

async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

/**
 * OpenAI-compatible non-streaming transport used by Groq and OpenRouter.
 * Keep the established three attempts and final 429/5xx backoff; adapters
 * supply provider identity, credentials, model selection and error wording.
 */
export async function requestChatCompletion({ url, getHeaders, body, errorPrefix, emptyResponseMessage, timeoutMessage }) {
    const model = body.model;

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetchWithTimeout(url, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                const msg = `${errorPrefix} HTTP ${res.status}: ${errBody.slice(0, 300)}`;
                if (res.status === 429 || res.status >= 500) {
                    lastError = new Error(msg);
                    const wait = Math.min(2000 * 2 ** attempt, 8000);
                    console.warn(`${errorPrefix} Retry ${attempt + 1}/${MAX_RETRIES} dans ${wait}ms...`);
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                throw new Error(msg);
            }

            const data = await res.json();
            const choice = data.choices?.[0];
            if (!choice) throw new Error(`${errorPrefix} ${emptyResponseMessage}`);

            return {
                text: choice.message?.content || '',
                usage: data.usage || {},
                model,
            };
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') {
                lastError = new Error(`${errorPrefix} ${timeoutMessage} ${DEFAULT_TIMEOUT}ms`);
            }
            if (attempt < MAX_RETRIES) {
                const wait = Math.min(2000 * 2 ** attempt, 8000);
                console.warn(`${errorPrefix} Erreur: ${lastError.message}. Retry ${attempt + 1}...`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    }

    throw lastError;
}
