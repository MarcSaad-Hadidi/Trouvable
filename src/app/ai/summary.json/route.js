import { AI_SUMMARY_PAYLOAD } from '@/lib/agent-discovery/public-data';
import { SITE_LAST_MODIFIED_ISO } from '@/lib/site-config';

export const runtime = 'nodejs';

export function GET() {
    return Response.json(AI_SUMMARY_PAYLOAD, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
            'Last-Modified': new Date(SITE_LAST_MODIFIED_ISO).toUTCString(),
        },
    });
}
