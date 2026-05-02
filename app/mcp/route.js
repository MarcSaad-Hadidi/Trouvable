import {
    buildMcpDescriptorPayload,
    executeMcpToolServer,
    listMcpTools,
    MCP_PROTOCOL_VERSION,
} from '@/lib/agent-discovery/mcp-tools';
import { SITE_LAST_MODIFIED_ISO } from '@/lib/site-config';

export const runtime = 'nodejs';

function jsonRpcResponse(id, result) {
    return Response.json({
        jsonrpc: '2.0',
        id,
        result,
    });
}

function jsonRpcError(id, code, message) {
    return Response.json({
        jsonrpc: '2.0',
        id,
        error: { code, message },
    }, {
        status: 400,
    });
}

function initializeResult() {
    return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: {
            name: 'Trouvable MCP Server',
            version: '0.1.0',
        },
        instructions: 'Public-site navigation tools for Trouvable pages only.',
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
    };
}

export function GET() {
    return Response.json(buildMcpDescriptorPayload(), {
        headers: {
            'Cache-Control': 'public, max-age=300',
            'Last-Modified': new Date(SITE_LAST_MODIFIED_ISO).toUTCString(),
        },
    });
}

export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return jsonRpcError(null, -32700, 'invalid_json');
    }

    const id = body?.id ?? null;
    const method = body?.method;
    const params = body?.params || {};

    if (method === 'initialize') {
        return jsonRpcResponse(id, initializeResult());
    }

    if (method === 'ping') {
        return jsonRpcResponse(id, {});
    }

    if (method === 'notifications/initialized') {
        return new Response(null, { status: 204 });
    }

    if (method === 'tools/list' || method === 'mcp.tools.list') {
        return jsonRpcResponse(id, { tools: listMcpTools() });
    }

    if (method === 'tools/call' || method === 'mcp.tools.call') {
        const toolName = params?.name || params?.tool_name;
        const toolArgs = params?.arguments || params?.args || {};
        if (!toolName) {
            return jsonRpcError(id, -32602, 'missing_tool_name');
        }
        const result = executeMcpToolServer(toolName, toolArgs);
        return jsonRpcResponse(id, { content: [{ type: 'json', json: result }] });
    }

    return jsonRpcError(id, -32601, 'method_not_found');
}
