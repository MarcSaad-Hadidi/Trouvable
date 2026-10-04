import 'server-only';

import { requireAdmin } from '@/lib/auth';
import { resolvePortalMembership } from '@/features/portal/server/access';

/** Check the current operator or exact active portal scope without identity writes. */
export async function authorizeGoogleOAuthClient(clientId) {
    try {
        if (await requireAdmin()) return { authorized: true };

        const access = await resolvePortalMembership({ backfill: false });
        if (!access.userId || !access.user) {
            return { error: 'google_oauth_authentication_required', status: 401 };
        }
        const allowed = access.memberships.some(
            (membership) => membership.client_id === clientId && membership.status === 'active',
        );
        if (!allowed) return { error: 'google_oauth_forbidden', status: 403 };

        return { authorized: true };
    } catch {
        return { error: 'google_oauth_access_unavailable', status: 503 };
    }
}
