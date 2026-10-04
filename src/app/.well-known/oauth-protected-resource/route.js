import { getRequestOrigin } from '@/lib/agent-discovery/config';

export function GET(request) {
    const origin = getRequestOrigin(request);

    const metadata = {
        resource: origin,
        authorization_servers: [origin],
        scopes_supported: ['read:public', 'write:lead'],
        bearer_methods_supported: ['header'],
        resource_name: 'Trouvable Public APIs',
        resource_documentation: `${origin}/docs/api`,
    };

    return Response.json(metadata, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
