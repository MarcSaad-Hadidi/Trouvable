import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';

import { requireAdmin } from '@/lib/auth';
import { listClientPortalMembers, setClientPortalAccessStatus, upsertClientPortalAccess } from '@/features/portal/server/access';
import { logAction } from '@/lib/db/actions';
import { getClientById } from '@/lib/db/clients';
import { sendPortalInvitationEmail } from '@/features/portal/server/email';

const upsertBody = z.object({
    action: z.literal('upsert'),
    clientId: z.string().uuid(),
    contactEmail: z.string().email().max(320),
});

const revokeBody = z.object({
    action: z.literal('revoke'),
    clientId: z.string().uuid(),
    accessId: z.string().uuid(),
});

const activateBody = z.object({
    action: z.literal('activate'),
    clientId: z.string().uuid(),
    accessId: z.string().uuid(),
});

const resendBody = z.object({
    action: z.literal('resend_invitation'),
    clientId: z.string().uuid(),
});

const bodySchema = z.discriminatedUnion('action', [upsertBody, revokeBody, activateBody, resendBody]);

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    try {
        if (parsed.data.action === 'upsert') {
            const row = await upsertClientPortalAccess({
                clientId: parsed.data.clientId,
                contactEmail: parsed.data.contactEmail,
                portalRole: 'viewer',
                memberType: 'client_contact',
                status: 'active',
            });

            await logAction({
                client_id: parsed.data.clientId,
                action_type: 'portal_access_upserted',
                details: { contact_email: row.contact_email, access_id: row.id },
                performed_by: admin.email || null,
            });

            // Create Clerk account so the client can sign in directly (non-blocking)
            let clerkAccountCreated = false;
            try {
                const clerk = await clerkClient();
                const existingUsers = await clerk.users.getUserList({
                    emailAddress: [row.contact_email],
                });
                if (existingUsers.totalCount === 0) {
                    await clerk.users.createUser({
                        emailAddress: [row.contact_email],
                        skipPasswordRequirement: true,
                        publicMetadata: {
                            source: 'portal_invitation',
                            client_id: parsed.data.clientId,
                        },
                    });
                    clerkAccountCreated = true;
                }
            } catch (err) {
                console.error('[portal-access] Clerk account creation failed:', err?.message);
            }

            // Send portal notification email (non-blocking)
            const client = await getClientById(parsed.data.clientId).catch(() => null);
            const emailResult = await sendPortalInvitationEmail({
                contactEmail: row.contact_email,
                clientName: client?.client_name || null,
            }).catch((err) => {
                console.error('[portal-access] Invitation email failed:', err?.message);
                return { sent: false, reason: 'exception' };
            });

            const members = await listClientPortalMembers(parsed.data.clientId);
            return NextResponse.json({ success: true, access: row, members, invitation: emailResult, clerkAccountCreated });
        }

        if (parsed.data.action === 'resend_invitation') {
            const client = await getClientById(parsed.data.clientId).catch(() => null);
            const members = await listClientPortalMembers(parsed.data.clientId);
            const primaryMember = members.find(m => m.status === 'active') || members[0];
            
            if (!primaryMember) {
                return NextResponse.json({ error: 'Aucun compte portail actif pour renvoyer l\'invitation.' }, { status: 400 });
            }

            const emailResult = await sendPortalInvitationEmail({
                contactEmail: primaryMember.contact_email,
                clientName: client?.client_name || null,
                clientId: client?.id || null,
                clientSlug: client?.client_slug || null,
            }).catch((err) => {
                console.error('[portal-access] Invitation email failed:', err?.message);
                return { sent: false, reason: 'exception', detail: err?.message };
            });

            if (!emailResult || !emailResult.sent) {
                let msg = 'Erreur inconnue';
                if (emailResult?.reason === 'no_api_key') msg = 'Clé API Resend manquante (.env)';
                else if (emailResult?.reason === 'no_email') msg = 'Adresse courriel manquante';
                else if (emailResult?.reason === 'send_error') msg = emailResult.detail || 'Erreur API Resend';
                else if (emailResult?.reason === 'exception') msg = emailResult.detail || 'Exception globale';

                return NextResponse.json({ error: `Echec envoi: ${msg}` }, { status: 500 });
            }

            await logAction({
                client_id: parsed.data.clientId,
                action_type: 'portal_invitation_resent',
                details: { contact_email: primaryMember.contact_email, email_sent: emailResult.sent },
                performed_by: admin.email || null,
            });

            return NextResponse.json({ success: true, invitation: emailResult });
        }

        const nextStatus = parsed.data.action === 'activate' ? 'active' : 'revoked';
        const row = await setClientPortalAccessStatus(parsed.data.accessId, nextStatus);
        if (row.client_id !== parsed.data.clientId) {
            return NextResponse.json({ error: 'Accès invalide pour ce client' }, { status: 400 });
        }

        await logAction({
            client_id: parsed.data.clientId,
            action_type: parsed.data.action === 'activate' ? 'portal_access_activated' : 'portal_access_revoked',
            details: {
                access_id: parsed.data.accessId,
                contact_email: row.contact_email,
                status: nextStatus,
            },
            performed_by: admin.email || null,
        });

        const members = await listClientPortalMembers(parsed.data.clientId);
        return NextResponse.json({ success: true, members });
    } catch (err) {
        console.error('[clients/portal-access]', err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
