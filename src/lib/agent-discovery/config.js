import { SITE_URL } from '@/lib/site-config';

export const CONTENT_SIGNAL_VALUE = 'ai-train=yes, search=yes, ai-input=yes';

export const CONTENT_SIGNAL_POLICY_LINES = [
    '# As a condition of accessing this website, you agree to abide by the following content signals:',
    '# (a) If a content-signal = yes, you may collect content for the corresponding use.',
    '# (b) If a content-signal = no, you may not collect content for the corresponding use.',
    '# (c) If the website operator does not include a content signal for a corresponding use,',
    '#     the website operator neither grants nor restricts permission via content signal for that use.',
    '# The content signals and their meanings are:',
    '# search: building a search index and providing search results with links and short excerpts.',
    '#         Search does not include providing AI-generated search summaries.',
    '# ai-input: inputting content into one or more AI models for grounding, RAG,',
    '#           or other real-time use in generative AI search answers.',
    '# ai-train: training or fine-tuning AI models.',
    '# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF RIGHTS.',
];

export const HOME_DISCOVERY_LINKS = [
    '</.well-known/api-catalog>; rel="api-catalog"',
    '</docs/api>; rel="service-doc"; type="text/html"',
    '</.well-known/openapi.json>; rel="service-desc"; type="application/openapi+json"',
    '</api/health>; rel="status"; type="application/json"',
    '</markdown?path=%2F>; rel="alternate"; type="text/markdown"',
    '</rss.xml>; rel="alternate"; type="application/rss+xml"',
    '</.well-known/ai.txt>; rel="alternate"; type="text/plain"',
    '</.well-known/webmcp.json>; rel="alternate"; type="application/json"',
    '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
    '</mcp>; rel="service"; type="application/json"',
];

export function buildRobotsTxt() {
    return [
        ...CONTENT_SIGNAL_POLICY_LINES,
        `Content-Signal: ${CONTENT_SIGNAL_VALUE}`,
        '',
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /portal/',
        'Disallow: /espace/',
        'Disallow: /api/',
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        '',
    ].join('\n');
}

export function getRequestOrigin(request) {
    try {
        return new URL(request.url).origin;
    } catch {
        return SITE_URL;
    }
}

export function parseAcceptHeader(value) {
    if (typeof value !== 'string') return [];

    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

export function acceptsMarkdown(request) {
    const accepts = parseAcceptHeader(request.headers.get('accept'));
    return accepts.some((value) => value.startsWith('text/markdown'));
}
