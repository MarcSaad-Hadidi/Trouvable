import { getRequestOrigin } from '@/lib/agent-discovery/config';

export function GET(request) {
    const origin = getRequestOrigin(request);

    const specification = {
        openapi: '3.1.0',
        info: {
            title: 'Trouvable Public API',
            version: '0.1.0',
            description: 'Discovery-oriented API description for agents and integrators.',
        },
        servers: [
            {
                url: origin,
            },
        ],
        paths: {
            '/api/health': {
                get: {
                    summary: 'Health check',
                    description: 'Returns service availability and current timestamp.',
                    operationId: 'getHealth',
                    responses: {
                        200: {
                            description: 'Service is reachable.',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            ok: { type: 'boolean' },
                                            status: { type: 'string' },
                                            service: { type: 'string' },
                                            time: { type: 'string', format: 'date-time' },
                                        },
                                        required: ['ok', 'status', 'service', 'time'],
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };

    return new Response(JSON.stringify(specification, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/openapi+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
