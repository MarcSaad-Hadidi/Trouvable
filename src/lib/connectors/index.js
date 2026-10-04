import 'server-only';

import { getClientConnectorRows } from '@/lib/connectors/repository';
import { getGa4SnapshotFromDb } from '@/lib/connectors/providers/ga4';
import { getGscSnapshotFromDb } from '@/lib/connectors/providers/gsc';
import { getAgentReachSnapshotFromDb } from '@/lib/connectors/providers/agent-reach';

export async function getConnectorOverviewForClient(clientId) {
    const connections = await getClientConnectorRows(clientId);
    const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));

    const [ga4, gsc, agent_reach] = await Promise.all([
        getGa4SnapshotFromDb({ connection: byProvider.get('ga4'), clientId }),
        getGscSnapshotFromDb({ connection: byProvider.get('gsc'), clientId }),
        getAgentReachSnapshotFromDb({ connection: byProvider.get('agent_reach'), clientId }),
    ]);

    return {
        connections,
        providers: {
            ga4,
            gsc,
            agent_reach,
        },
        summary: {
            configured: connections.filter((row) => row.status === 'configured').length,
            sample_mode: connections.filter((row) => row.status === 'sample_mode').length,
            not_connected: connections.filter((row) => row.status === 'not_connected').length,
            disabled: connections.filter((row) => row.status === 'disabled').length,
            error: connections.filter((row) => row.status === 'error').length,
            healthy: connections.filter((row) => row.status === 'healthy').length,
        },
    };
}
