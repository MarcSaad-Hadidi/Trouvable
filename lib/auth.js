import { auth, currentUser } from '@clerk/nextjs/server';
import { isAdminEmail } from '@/lib/admin-email';
import { getDevAdminForCurrentRequest } from '@/lib/dev-bypass-server';

/** @typedef {'admin' | 'consultant' | 'viewer'} OperatorRole */

export const OPERATOR_ROLE = /** @type {const} */ ({
    ADMIN: 'admin',
    CONSULTANT: 'consultant',
    VIEWER: 'viewer',
});

/**
 * Clerk `publicMetadata.operatorRole` when set; otherwise allowlisted users default to admin.
 * Client portal viewers never receive admin access via getAdminAccessState.
 *
 * @param {object | null} user Clerk user object
 * @param {boolean} emailAllowed
 * @returns {OperatorRole | null}
 */
export function resolveOperatorRole(user, emailAllowed) {
    if (!user || !emailAllowed) return null;
    const raw = user.publicMetadata && user.publicMetadata.operatorRole;
    if (raw === OPERATOR_ROLE.CONSULTANT) return OPERATOR_ROLE.CONSULTANT;
    if (raw === OPERATOR_ROLE.ADMIN) return OPERATOR_ROLE.ADMIN;
    if (raw === OPERATOR_ROLE.VIEWER) return OPERATOR_ROLE.VIEWER;
    return OPERATOR_ROLE.ADMIN;
}

function getAllUserEmails(user) {
    return user?.emailAddresses?.map((entry) => entry.emailAddress).filter(Boolean) ?? [];
}

function getPrimaryUserEmail(user) {
    return user?.emailAddresses?.find((entry) => entry.id === user?.primaryEmailAddressId)?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress
        || '';
}

export async function getAdminAccessState() {
    const devAdmin = await getDevAdminForCurrentRequest();
    if (devAdmin) {
        return {
            kind: 'dev-bypass',
            admin: devAdmin,
            user: null,
            operatorRole: OPERATOR_ROLE.ADMIN,
        };
    }

    const { userId } = await auth();
    if (!userId) {
        return {
            kind: 'anonymous',
            admin: null,
            user: null,
            operatorRole: null,
        };
    }

    const user = await currentUser();
    if (!user) {
        return {
            kind: 'anonymous',
            admin: null,
            user: null,
            operatorRole: null,
        };
    }

    const allEmails = getAllUserEmails(user);
    const allowed = allEmails.some((email) => isAdminEmail(email));

    if (!allowed) {
        return {
            kind: 'forbidden',
            admin: null,
            user,
            operatorRole: null,
        };
    }

    return {
        kind: 'clerk',
        admin: {
            userId,
            email: getPrimaryUserEmail(user) || allEmails[0] || '',
        },
        user,
        operatorRole: resolveOperatorRole(user, allowed),
    };
}

export async function requireAdmin() {
    const accessState = await getAdminAccessState();
    return accessState.admin;
}
