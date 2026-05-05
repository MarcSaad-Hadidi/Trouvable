import {
    SITE_AI_DESCRIPTION,
    SITE_AI_DISCOVERY_PATHS,
    SITE_NAME,
    SITE_URL,
} from '@/lib/site-config';

export const MCP_PROTOCOL_VERSION = '2025-11-25';

export const MCP_TOOL_DEFINITIONS = [
    {
        name: 'navigate_page',
        title: 'Naviguer vers une page publique',
        description: 'Navigate to a public Trouvable page path.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Absolute path on trouvable.app, for example /contact or /offres.',
                },
            },
            required: ['path'],
            additionalProperties: false,
        },
        readOnlyHint: true,
    },
    {
        name: 'open_contact_page',
        title: 'Ouvrir la page contact',
        description: 'Open the public contact page.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        readOnlyHint: true,
    },
    {
        name: 'search_site',
        title: 'Rechercher dans le site',
        description: 'Open Trouvable search results page for a query.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query used on /recherche.',
                },
            },
            required: ['query'],
            additionalProperties: false,
        },
        readOnlyHint: true,
    },
];

function safePath(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) return '';
    if (trimmed.startsWith('/admin') || trimmed.startsWith('/portal') || trimmed.startsWith('/espace') || trimmed.startsWith('/api')) {
        return '';
    }
    return trimmed;
}

export function listMcpTools() {
    return MCP_TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
            readOnlyHint: tool.readOnlyHint,
        },
    }));
}

export function buildMcpDescriptorPayload() {
    return {
        name: 'trouvable-webmcp',
        title: `${SITE_NAME} WebMCP Endpoint`,
        description: SITE_AI_DESCRIPTION,
        url: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.mcp}`,
        declarationUrl: `${SITE_URL}${SITE_AI_DISCOVERY_PATHS.webMcp}`,
        protocol: 'mcp-jsonrpc',
        protocolVersion: MCP_PROTOCOL_VERSION,
        tools: listMcpTools(),
    };
}

export const WEBMCP_DECLARATIVE_PAYLOAD = {
    ...buildMcpDescriptorPayload(),
    mode: 'declarative-and-imperative',
};

export function executeMcpToolServer(name, args = {}) {
    if (name === 'navigate_page') {
        const path = safePath(args.path);
        if (!path) {
            return { ok: false, error: 'invalid_path' };
        }
        return {
            ok: true,
            action: 'navigate',
            path,
            url: `${SITE_URL}${path}`,
        };
    }

    if (name === 'open_contact_page') {
        return {
            ok: true,
            action: 'navigate',
            path: '/contact',
            url: `${SITE_URL}/contact`,
        };
    }

    if (name === 'search_site') {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) return { ok: false, error: 'missing_query' };
        const url = `${SITE_URL}/recherche?q=${encodeURIComponent(query)}`;
        return {
            ok: true,
            action: 'navigate',
            path: `/recherche?q=${encodeURIComponent(query)}`,
            url,
        };
    }

    return { ok: false, error: 'unknown_tool' };
}
