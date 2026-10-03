import { getRequestOrigin } from '@/lib/agent-discovery/config';

export function GET(request) {
    const origin = getRequestOrigin(request);
    const serviceUrl = `${origin}/a2a`;

    const card = {
        protocolVersion: '0.3.0',
        name: 'Trouvable Agent',
        version: '0.1.0',
        description: 'Agent discovery card for Trouvable public services and workflows.',
        url: serviceUrl,
        documentationUrl: `${origin}/docs/api`,
        supportedInterfaces: [
            {
                url: serviceUrl,
                transport: 'https',
                protocol: 'jsonrpc',
            },
        ],
        capabilities: {
            streaming: false,
            pushNotifications: false,
            stateTransitionHistory: false,
        },
        defaultInputModes: ['application/json', 'text/plain'],
        defaultOutputModes: ['application/json', 'text/markdown', 'text/plain'],
        skills: [
            {
                id: 'api_discovery',
                name: 'API Discovery',
                description: 'Find OpenAPI, API catalog, and health resources for Trouvable.',
            },
            {
                id: 'site_navigation',
                name: 'Site Navigation',
                description: 'Navigate public Trouvable pages and contact pathways.',
            },
        ],
    };

    return Response.json(card, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
