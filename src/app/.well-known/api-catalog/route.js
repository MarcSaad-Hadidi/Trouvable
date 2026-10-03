import { getRequestOrigin } from '@/lib/agent-discovery/config';

export function GET(request) {
    const origin = getRequestOrigin(request);
    const body = {
        linkset: [
            {
                anchor: `${origin}/api`,
                'service-desc': [
                    {
                        href: `${origin}/.well-known/openapi.json`,
                        type: 'application/openapi+json',
                    },
                ],
                'service-doc': [
                    {
                        href: `${origin}/docs/api`,
                        type: 'text/html',
                    },
                ],
                status: [
                    {
                        href: `${origin}/api/health`,
                        type: 'application/json',
                    },
                ],
            },
        ],
    };

    return new Response(JSON.stringify(body, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
