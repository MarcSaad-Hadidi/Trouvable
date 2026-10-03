import 'server-only';

function normalizeWebItems(items = [], limit = 5) {
    return items
        .filter((item) => item?.url && item?.title)
        .slice(0, limit)
        .map((item, index) => ({
            rank: index + 1,
            title: String(item.title || '').trim(),
            url: String(item.url || '').trim(),
            snippet: String(item.snippet || '').trim(),
        }));
}

function serializeWebItems(items = []) {
    if (!items.length) return '';
    return items
        .map((item) => (
            `[${item.rank}] ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet || '-'}`
        ))
        .join('\n\n');
}

async function searchWithGoogleCse({ query, maxResults = 5, timeoutMs = 8000 }) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    if (!apiKey || !engineId) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('key', apiKey);
        url.searchParams.set('cx', engineId);
        url.searchParams.set('q', query);
        url.searchParams.set('num', String(Math.min(10, Math.max(1, maxResults))));

        const response = await fetch(url.toString(), {
            method: 'GET',
            signal: controller.signal,
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Google CSE HTTP ${response.status}: ${body.slice(0, 200)}`);
        }
        const json = await response.json();
        const items = (json.items || []).map((item) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
        }));
        return {
            provider: 'google_cse',
            items: normalizeWebItems(items, maxResults),
        };
    } finally {
        clearTimeout(timer);
    }
}

async function searchWithTavily({ query, maxResults = 5, timeoutMs = 8000 }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                api_key: apiKey,
                query,
                max_results: Math.min(10, Math.max(1, maxResults)),
                search_depth: 'basic',
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Tavily HTTP ${response.status}: ${body.slice(0, 200)}`);
        }
        const json = await response.json();
        const items = (json.results || []).map((item) => ({
            title: item.title,
            url: item.url,
            snippet: item.content,
        }));
        return {
            provider: 'tavily_web',
            items: normalizeWebItems(items, maxResults),
        };
    } finally {
        clearTimeout(timer);
    }
}

export async function buildGoogleGroundingContext({
    prompt,
    sourceUrl = null,
    maxResults = 5,
    timeoutMs = 8000,
    enabled = true,
}) {
    if (!enabled) {
        return { enabled: false, used_provider: null, items: [], text: '' };
    }

    const urlHint = sourceUrl ? ` site:${new URL(sourceUrl).hostname.replace(/^www\./, '')}` : '';
    const query = `${String(prompt || '').trim()}${urlHint}`.trim();
    if (!query) {
        return { enabled: true, used_provider: null, items: [], text: '' };
    }

    try {
        const google = await searchWithGoogleCse({ query, maxResults, timeoutMs });
        if (google && google.items.length > 0) {
            return {
                enabled: true,
                used_provider: google.provider,
                items: google.items,
                text: serializeWebItems(google.items),
                error: null,
            };
        }
    } catch (error) {
        console.warn('[llm-comparison/google-grounding] Google CSE failed:', error.message);
    }

    try {
        const tavily = await searchWithTavily({ query, maxResults, timeoutMs });
        if (tavily && tavily.items.length > 0) {
            return {
                enabled: true,
                used_provider: tavily.provider,
                items: tavily.items,
                text: serializeWebItems(tavily.items),
                error: null,
            };
        }
    } catch (error) {
        console.warn('[llm-comparison/google-grounding] Tavily fallback failed:', error.message);
        return {
            enabled: true,
            used_provider: null,
            items: [],
            text: '',
            error: error.message,
        };
    }

    return {
        enabled: true,
        used_provider: null,
        items: [],
        text: '',
        error: null,
    };
}
