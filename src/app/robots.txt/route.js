import { buildRobotsTxt, CONTENT_SIGNAL_VALUE } from '@/lib/agent-discovery/config';

export const runtime = 'nodejs';

export function GET() {
    return new Response(buildRobotsTxt(), {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, no-transform',
            'CDN-Cache-Control': 'no-transform',
            'Content-Signal': CONTENT_SIGNAL_VALUE,
        },
    });
}
