import { getRequestOrigin } from '@/lib/agent-discovery/config';

export function GET(request) {
    const origin = getRequestOrigin(request);
    const mcpEndpoint = `${origin}/mcp`;

    const card = {
        $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
        name: 'com.trouvable/public-site',
        title: 'Trouvable MCP Server',
        description: 'Discovery metadata for Trouvable browser and API capabilities.',
        version: '0.1.0',
        serverInfo: {
            name: 'Trouvable MCP Server',
            version: '0.1.0',
        },
        transport: {
            type: 'streamable-http',
            url: mcpEndpoint,
        },
        capabilities: {
            tools: {
                listChanged: false,
            },
            prompts: {
                listChanged: false,
            },
            resources: {
                subscribe: false,
                listChanged: false,
            },
        },
        remotes: [
            {
                type: 'streamable-http',
                url: mcpEndpoint,
                supportedProtocolVersions: ['2025-06-18', '2025-11-25'],
            },
        ],
    };

    return Response.json(card, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
