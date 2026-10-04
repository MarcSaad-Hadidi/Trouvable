import 'server-only';

import { getReadinessSlice } from '@/lib/operator-intelligence/geo-readiness';

export async function getAgentReadinessSlice(clientId) {
    const base = await getReadinessSlice(clientId);
    return {
        ...base,
        surface: 'agent-readiness',
        section: 'execution',
        title: 'Preparation client',
        framing: {
            ...(base?.framing || {}),
            scope: 'Execution',
            summary: 'Readiness client avant livraison et verification, distincte de la preparation IA.',
        },
    };
}
