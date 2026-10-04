import { noStoreJson } from '@/lib/http-response';

import { requireAdmin } from '@/lib/auth';
import {
    getOpportunities as dbGetOpportunities,
    updateOpportunity as dbUpdateOpportunity,
} from '@/lib/db/opportunities';
import { logAction as dbLogAction } from '@/lib/db/actions';

const VALID_STATUSES = new Set(['open', 'in_progress', 'done', 'dismissed']);

export async function POST(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId, opportunityId } = await params;
    let body;

    try {
        body = await request.json();
    } catch {
        return noStoreJson({ error: 'JSON invalide' }, { status: 400 });
    }

    const status = body?.status;
    if (!clientId || !opportunityId || !VALID_STATUSES.has(status)) {
        return noStoreJson({ error: 'Statut invalide' }, { status: 400 });
    }

    try {
        const existingOpts = await dbGetOpportunities(clientId);
        const existingOpp = existingOpts.find((o) => o.id === opportunityId);

        if (!existingOpp) {
            return noStoreJson({ error: 'Opportunity introuvable pour ce client' }, { status: 404 });
        }

        const row = await dbUpdateOpportunity(opportunityId, { status });
        await dbLogAction({
            client_id: clientId,
            action_type: 'opportunity_status_updated',
            details: { opportunity_id: opportunityId, status },
            performed_by: admin.email,
        });

        return noStoreJson({ success: true, opportunity: row });
    } catch (error) {
        console.error(`[api/admin/geo/client/${clientId}/opportunities/${opportunityId}]`, error);
        return noStoreJson({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
