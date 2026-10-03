import { getAgentSkill } from '@/lib/agent-discovery/skills';

export async function GET(_request, { params }) {
    const resolvedParams = await params;
    const skill = getAgentSkill(resolvedParams?.skill);

    if (!skill) {
        return Response.json(
            {
                error: 'Skill not found',
                status: 404,
            },
            { status: 404 },
        );
    }

    return new Response(skill, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
