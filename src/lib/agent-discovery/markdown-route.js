import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { CONTENT_SIGNAL_VALUE, getRequestOrigin } from '@/lib/agent-discovery/config';
import { estimateMarkdownTokens, renderMarkdownFromHtml } from '@/lib/agent-discovery/markdown';
import { SITE_URL } from '@/lib/site-config';

const MARKDOWN_SOURCE_HEADER = 'x-trouvable-markdown-source';

export const runtime = 'nodejs';

function normalizePathParam(pathParam) {
    if (typeof pathParam !== 'string') return '/';
    const trimmed = pathParam.trim();
    if (!trimmed.startsWith('/')) return '/';

    let pathname;
    try {
        const parsed = new URL(trimmed, SITE_URL);
        pathname = parsed.pathname;
    } catch {
        pathname = '/';
    }

    if (pathname.startsWith('/markdown')) return '/';
    if (pathname.startsWith('/__agent/markdown')) return '/';

    return pathname.startsWith('/') ? pathname : '/';
}

function resolveTarget(request) {
    const requestUrl = new URL(request.url);
    const pathParam = requestUrl.searchParams.get('path') || '/';
    const queryParam = requestUrl.searchParams.get('query') || '';

    const safePath = normalizePathParam(pathParam);
    const target = new URL(safePath, getRequestOrigin(request));

    if (queryParam.startsWith('?')) {
        target.search = queryParam;
    }

    return {
        safePath,
        targetUrl: target.toString(),
    };
}

function markdownResponse(markdown, estimatedTokens) {
    return new Response(markdown, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            Vary: 'Accept',
            'x-markdown-tokens': String(estimatedTokens),
            'Content-Signal': CONTENT_SIGNAL_VALUE,
            'Cache-Control': 'public, max-age=0, s-maxage=300',
        },
    });
}

async function fetchUpstreamHtml(targetUrl) {
    try {
        const upstream = await fetch(targetUrl, {
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                [MARKDOWN_SOURCE_HEADER]: '1',
            },
            redirect: 'follow',
            cache: 'no-store',
        });

        if (!upstream.ok) return null;

        const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
        const isLikelyHtml = (
            !contentType
            || contentType.includes('text/html')
            || contentType.includes('application/xhtml+xml')
            || contentType.startsWith('text/')
        );

        if (!isLikelyHtml) {
            return null;
        }

        return await upstream.text();
    } catch {
        return null;
    }
}

function buildStaticHtmlCandidates(safePath) {
    const appDir = path.join(process.cwd(), '.next', 'server', 'app');
    if (safePath === '/' || !safePath) {
        return [path.join(appDir, 'index.html')];
    }

    const rawSegments = safePath.split('/').filter(Boolean);
    if (rawSegments.length === 0) {
        return [path.join(appDir, 'index.html')];
    }

    const decodedSegments = [];
    for (const segment of rawSegments) {
        let decoded;
        try {
            decoded = decodeURIComponent(segment);
        } catch {
            return [];
        }

        if (!decoded || decoded === '.' || decoded === '..' || decoded.includes('\\') || decoded.includes('/')) {
            return [];
        }

        decodedSegments.push(decoded);
    }

    const joined = path.join(...decodedSegments);
    return [
        path.join(appDir, `${joined}.html`),
        path.join(appDir, joined, 'index.html'),
    ];
}

async function readStaticHtmlSnapshot(safePath) {
    const candidates = buildStaticHtmlCandidates(safePath);
    for (const candidate of candidates) {
        try {
            return await readFile(candidate, 'utf-8');
        } catch {
            // Try next candidate.
        }
    }
    return null;
}

function fallbackMarkdown(targetUrl, safePath) {
    const body = [
        '---',
        'title: Trouvable',
        `source: ${targetUrl}`,
        '---',
        '',
        '# Trouvable',
        '',
        `A markdown snapshot is unavailable for \`${safePath || '/'}\` right now.`,
        '',
        `[HTML version](${targetUrl})`,
        '',
    ].join('\n');

    return {
        markdown: body,
        estimatedTokens: estimateMarkdownTokens(body),
    };
}

export async function GET(request) {
    const { safePath, targetUrl } = resolveTarget(request);

    const upstreamHtml = await fetchUpstreamHtml(targetUrl);
    const html = upstreamHtml || await readStaticHtmlSnapshot(safePath);

    if (!html) {
        const fallback = fallbackMarkdown(targetUrl, safePath);
        return markdownResponse(fallback.markdown, fallback.estimatedTokens);
    }

    const rendered = renderMarkdownFromHtml({
        html,
        sourceUrl: targetUrl,
        fallbackTitle: 'Trouvable',
    });

    return markdownResponse(rendered.markdown, rendered.estimatedTokens);
}
