import { noStoreJson } from '@/lib/http-response';

import { requireAdmin } from '@/lib/auth';
import { getOperatorWorkspaceShell } from '@/lib/operator-intelligence/base';

export async function GET(_, { params }) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return noStoreJson({ error: 'Non autorise' }, { status: 401 });
        }

        const { clientId } = await params;
        if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
            return noStoreJson({ error: 'ID invalide' }, { status: 400 });
        }

        const payload = await getOperatorWorkspaceShell(clientId);
        if (!payload?.client) {
            return noStoreJson({ error: 'Client non trouve' }, { status: 404 });
        }

        return noStoreJson(payload);
    } catch (error) {
        const status = error?.code === 'OPERATOR_CLIENT_UNAVAILABLE' ? 503 : 500;
        const message = status === 503 ? 'Données client temporairement indisponibles.' : 'Erreur interne du serveur.';
        return noStoreJson({ error: message, status }, { status });
    }
}
