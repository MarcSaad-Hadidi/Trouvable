import { getRequestOrigin } from '@/lib/agent-discovery/config';
import { getAgentSkillEntries } from '@/lib/agent-discovery/skills';

export function GET(request) {
    const origin = getRequestOrigin(request);

    const index = {
        $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
        skills: getAgentSkillEntries(origin),
    };

    return Response.json(index, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
