import 'server-only';

import { currentUser } from '@clerk/nextjs/server';

import { isAdminEmail } from '@/lib/admin-email';
import { resolvePortalMembership } from '@/features/portal/server/access';

/**
 * Après authentification Clerk : destination selon le rôle.
 * - Admin (CLERK_ADMIN_EMAIL, etc.) ? tableau de bord /admin
 * - Invité portail actif ? /portal ou /portal/[slug]
 * - Sinon ? null (afficher une page d’aide)
 */
export async function resolvePostSignInDestination() {
    const user = await currentUser();
    if (!user) return null;

    const allEmails = user.emailAddresses?.map((e) => e.emailAddress).filter(Boolean) ?? [];
    if (allEmails.some((email) => isAdminEmail(email))) {
        return '/admin';
    }

    const { memberships = [] } = await resolvePortalMembership();
    if (memberships.length === 1) {
        return `/portal/${memberships[0].client_slug}`;
    }
    if (memberships.length > 1) {
        return '/portal';
    }

    return null;
}
