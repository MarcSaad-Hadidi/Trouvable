import { renderLlmsTxt } from '@/lib/agent-discovery/public-data';
import { SITE_LAST_MODIFIED_ISO } from '@/lib/site-config';

export const runtime = 'nodejs';

export function GET() {
    return new Response(renderLlmsTxt(), {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Last-Modified': new Date(SITE_LAST_MODIFIED_ISO).toUTCString(),
        },
    });
}

