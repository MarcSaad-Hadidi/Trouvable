import { getRequestOrigin } from '@/lib/agent-discovery/config';

function createAuthorizationMetadata(origin) {
    return {
        issuer: origin,
        authorization_endpoint: `${origin}/api/oauth/authorize`,
        token_endpoint: `${origin}/api/oauth/token`,
        jwks_uri: `${origin}/.well-known/jwks.json`,
        trouvable_status: 'disabled',
        authorization_server_status: 'unsupported',
        authorization_server_note: 'Trouvable does not issue OAuth tokens from these public discovery endpoints. /api/oauth/authorize and /api/oauth/token return structured unsupported errors.',
        response_types_supported: [],
        grant_types_supported: [],
        token_endpoint_auth_methods_supported: [],
        scopes_supported: [],
        code_challenge_methods_supported: [],
        service_documentation: `${origin}/docs/api`,
    };
}

export function GET(request) {
    const origin = getRequestOrigin(request);
    return Response.json(createAuthorizationMetadata(origin), {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
