'use client';

import { useEffect } from 'react';
import { MCP_TOOL_DEFINITIONS } from '@/lib/agent-discovery/mcp-tools';

function safePath(path) {
    if (typeof path !== 'string') return '';
    const trimmed = path.trim();
    if (!trimmed.startsWith('/')) return '';
    if (trimmed.startsWith('/admin') || trimmed.startsWith('/portal') || trimmed.startsWith('/espace') || trimmed.startsWith('/api')) {
        return '';
    }
    return trimmed;
}

function executeClientTool(name, args = {}) {
    if (name === 'navigate_page') {
        const path = safePath(args.path);
        if (!path) return { ok: false, error: 'invalid_path' };
        window.location.assign(path);
        return { ok: true, navigatedTo: path };
    }

    if (name === 'open_contact_page') {
        window.location.assign('/contact');
        return { ok: true, navigatedTo: '/contact' };
    }

    if (name === 'search_site') {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) return { ok: false, error: 'missing_query' };
        const target = `/recherche?q=${encodeURIComponent(query)}`;
        window.location.assign(target);
        return { ok: true, navigatedTo: target };
    }

    return { ok: false, error: 'unknown_tool' };
}

const WEBMCP_TOOLS = MCP_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: async (args) => executeClientTool(tool.name, args),
    annotations: {
        readOnlyHint: tool.readOnlyHint,
    },
}));

function registerViaProvideContext(modelContext) {
    if (typeof modelContext?.provideContext !== 'function') return false;
    modelContext.provideContext({ tools: WEBMCP_TOOLS });
    return true;
}

function registerViaRegisterTool(modelContext) {
    if (typeof modelContext?.registerTool !== 'function') return false;

    for (const tool of WEBMCP_TOOLS) {
        try {
            modelContext.registerTool(tool);
        } catch {
            // Ignore duplicate registration and unsupported browser errors.
        }
    }
    return true;
}

export default function WebMcpProvider() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const modelContext = window.navigator?.modelContext;
        if (!modelContext) return;

        try {
            if (registerViaProvideContext(modelContext)) return;
            registerViaRegisterTool(modelContext);
        } catch {
            // WebMCP API can be unavailable depending on runtime support.
        }
    }, []);

    return null;
}
