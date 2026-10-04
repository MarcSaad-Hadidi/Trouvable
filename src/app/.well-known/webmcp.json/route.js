import { buildMcpDescriptorPayload } from '@/lib/agent-discovery/mcp-tools';
import { SITE_LAST_MODIFIED_ISO } from '@/lib/site-config';

export const runtime = 'nodejs';

export function GET() {
    return Response.json(buildMcpDescriptorPayload(), {
        headers: {
            'Cache-Control': 'public, max-age=300',
            'Last-Modified': new Date(SITE_LAST_MODIFIED_ISO).toUTCString(),
        },
    });
}
