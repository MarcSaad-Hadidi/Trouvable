import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';

import { requireAdmin } from '@/lib/auth';
import { normalizePortalContactEmail } from '@/lib/client-profile';
import { getAdminSupabase } from '@/lib/supabase-admin';

function isVerifiedClerkEmail(emailAddress) {
    return emailAddress?.verification?.status === 'verified';
}

export function getVerifiedClerkEmails(user) {
    const emails = user?.emailAddresses || [];

    return emails
        .filter(isVerifiedClerkEmail)
        .map((emailAddress) => normalizePortalContactEmail(emailAddress.emailAddress))
        .filter(Boolean);
}

export async function requireAdminAccess() {
    return requireAdmin();
}

export async function listClientPortalMembers(clientId) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('client_portal_access')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(`[PortalAccess] listClientPortalMembers: ${error.message}`);
    }

    return (data || []).map((row) => ({
        ...row,
        contact_email: normalizePortalContactEmail(row.contact_email),
    }));
}

export async function upsertClientPortalAccess({
    clientId,
    contactEmail,
    clerkUserId = null,
    memberType = 'client_contact',
    portalRole = 'viewer',
    status = 'active',
}) {
    const normalizedEmail = normalizePortalContactEmail(contactEmail);
    const supabase = getAdminSupabase();

    const { data, error } = await supabase
        .from('client_portal_access')
        .upsert(
            {
                client_id: clientId,
                contact_email: normalizedEmail,
                clerk_user_id: clerkUserId || null,
                member_type: memberType,
                portal_role: portalRole,
                status,
            },
            {
                onConflict: 'client_id,contact_email',
            },
        )
        .select()
        .single();

    if (error) {
        throw new Error(`[PortalAccess] upsertClientPortalAccess: ${error.message}`);
    }

    return {
        ...data,
        contact_email: normalizePortalContactEmail(data.contact_email),
    };
}

export async function setClientPortalAccessStatus(id, status) {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
        .from('client_portal_access')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`[PortalAccess] setClientPortalAccessStatus: ${error.message}`);
    }

    return {
        ...data,
        contact_email: normalizePortalContactEmail(data.contact_email),
    };
}

function sortMemberships(memberships) {
    return memberships.sort((a, b) => {
        const nameA = a.client_name || '';
        const nameB = b.client_name || '';
        return nameA.localeCompare(nameB, 'fr-CA');
    });
}

export async function resolvePortalMembership({ backfill = true } = {}) {
    const { userId } = await auth();

    if (!userId) {
        return {
            userId: null,
            user: null,
            verifiedEmails: [],
            primaryVerifiedEmail: '',
            memberships: [],
            resolvedBy: 'none',
        };
    }

    const user = await currentUser();
    if (!user) {
        return {
            userId,
            user: null,
            verifiedEmails: [],
            primaryVerifiedEmail: '',
            memberships: [],
            resolvedBy: 'none',
        };
    }

    const verifiedEmails = getVerifiedClerkEmails(user);
    const primaryVerifiedEmail = verifiedEmails[0] || '';
    const supabase = getAdminSupabase();

    const { data: directRows, error: directError } = await supabase
        .from('client_portal_access')
        .select('*')
        .eq('status', 'active')
        .eq('clerk_user_id', userId);

    if (directError) {
        throw new Error(`[PortalAccess] resolvePortalMembership direct lookup: ${directError.message}`);
    }

    let resolvedBy = 'none';
    let membershipRows = directRows || [];

    if (membershipRows.length > 0) {
        resolvedBy = 'clerk_user_id';
    } else if (verifiedEmails.length > 0) {
        const { data: emailRows, error: emailError } = await supabase
            .from('client_portal_access')
            .select('*')
            .eq('status', 'active')
            .in('contact_email', verifiedEmails);

        if (emailError) {
            throw new Error(`[PortalAccess] resolvePortalMembership email lookup: ${emailError.message}`);
        }

        membershipRows = emailRows || [];

        if (membershipRows.length > 0) {
            resolvedBy = 'verified_email';

            const rowsToBackfill = membershipRows.filter((row) => !row.clerk_user_id).map((row) => row.id);

            if (backfill && rowsToBackfill.length > 0) {
                const { error: updateError } = await supabase
                    .from('client_portal_access')
                    .update({ clerk_user_id: userId })
                    .in('id', rowsToBackfill);

                if (updateError) {
                    console.error('[PortalAccess] clerk_user_id backfill failed:', updateError.message);
                } else {
                    membershipRows = membershipRows.map((row) =>
                        rowsToBackfill.includes(row.id) ? { ...row, clerk_user_id: userId } : row,
                    );
                }
            }
        }
    }

    if (membershipRows.length === 0) {
        return {
            userId,
            user,
            verifiedEmails,
            primaryVerifiedEmail,
            memberships: [],
            resolvedBy,
        };
    }

    const clientIds = [...new Set(membershipRows.map((row) => row.client_id).filter(Boolean))];
    const { data: clientRows, error: clientError } = await supabase
        .from('client_geo_profiles')
        .select(
            'id, client_name, client_slug, website_url, business_type, publication_status, is_published, lifecycle_status',
        )
        .in('id', clientIds)
        .neq('lifecycle_status', 'archived');

    if (clientError) {
        throw new Error(`[PortalAccess] resolvePortalMembership clients lookup: ${clientError.message}`);
    }

    const clientsById = new Map((clientRows || []).map((client) => [client.id, client]));

    const memberships = sortMemberships(
        membershipRows
            .map((row) => {
                const client = clientsById.get(row.client_id);
                if (!client) return null;

                return {
                    id: row.id,
                    client_id: row.client_id,
                    contact_email: normalizePortalContactEmail(row.contact_email),
                    clerk_user_id: row.clerk_user_id,
                    member_type: row.member_type,
                    portal_role: row.portal_role,
                    status: row.status,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    client_name: client.client_name,
                    client_slug: client.client_slug,
                    website_url: client.website_url,
                    business_type: client.business_type,
                    publication_status: client.publication_status,
                    is_published: client.is_published,
                };
            })
            .filter(Boolean),
    );

    return {
        userId,
        user,
        verifiedEmails,
        primaryVerifiedEmail,
        memberships,
        resolvedBy,
    };
}
