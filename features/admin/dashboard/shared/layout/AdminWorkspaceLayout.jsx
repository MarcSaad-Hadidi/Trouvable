import Link from 'next/link';

import { getAdminAccessState } from '@/lib/auth';
import { resolvePortalMembership } from '@/features/portal/server/access';

import AdminClerkProvider from '@/features/auth/admin/AdminClerkProvider';
import SwitchAccountButton from '@/features/auth/admin/SwitchAccountButton';
import AdminSidebar from '@/features/admin/dashboard/shared/components/AdminSidebar';
import AdminTopCommandBar from '@/features/admin/dashboard/shared/components/AdminTopCommandBar';
import AdminKeyboardShortcuts from '@/features/admin/dashboard/shared/components/AdminKeyboardShortcuts';
import IssueActionsDrawer from '@/features/admin/dashboard/shared/components/IssueActionsDrawer';
import { IssueHandoffProvider } from '@/features/admin/dashboard/shared/context/IssueHandoffContext';
import '@/features/admin/dashboard/shared/admin-shell.css';

export const metadata = {
    title: 'Trouvable - Centre de commande',
    robots: { index: false, follow: false },
};

function withAdminClerk(children, enabled) {
    return enabled ? <AdminClerkProvider>{children}</AdminClerkProvider> : children;
}

function displayEmail(user) {
    return user?.emailAddresses?.find((entry) => entry.id === user?.primaryEmailAddressId)?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress
        || '';
}

export default async function AdminWorkspaceLayout({ children }) {
    const accessState = await getAdminAccessState();

    if (!accessState.admin) {
        if (accessState.kind === 'anonymous') {
            return <>{children}</>;
        }

        const userEmail = displayEmail(accessState.user);

        let portalHref = null;
        let portalLabel = null;

        try {
            const { memberships = [] } = await resolvePortalMembership();
            if (memberships.length === 1) {
                portalHref = `/portal/${memberships[0].client_slug}`;
                portalLabel = 'Ouvrir mon espace client';
            } else if (memberships.length > 1) {
                portalHref = '/portal';
                portalLabel = 'Ouvrir le portail client';
            }
        } catch (error) {
            console.error('[AdminWorkspaceLayout] resolvePortalMembership', error);
        }

        return withAdminClerk((
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#060607] p-6 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                    <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <h1 className="mb-2 text-xl font-bold text-white">Acces administration refuse</h1>
                <p className="mb-1 max-w-md text-sm text-white/40">
                    Le compte <span className="font-medium text-white/70">{userEmail}</span> n&apos;est pas dans la liste des operateurs
                    Trouvable (<code className="text-white/50">CLERK_ADMIN_EMAIL</code>).
                </p>
                <p className="mb-6 max-w-md text-xs text-white/30">
                    L&apos;acces au <strong className="text-white/45">portail client</strong> et au centre de commande sont deux roles distincts.
                </p>

                <div className="flex w-full max-w-sm flex-col gap-3">
                    {portalHref && portalLabel ? (
                        <Link
                            href={portalHref}
                            className="rounded-xl bg-[#5b73ff] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4a62ee]"
                        >
                            {portalLabel}
                        </Link>
                    ) : null}
                    <SwitchAccountButton className="rounded-xl border border-white/[0.08] bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white/70 transition-all hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-50" />
                    <p className="text-[11px] text-white/25">
                        Portail client:{' '}
                        <Link href="/portal/sign-in" className="text-[#7b8fff] hover:underline">
                            /portal/sign-in
                        </Link>
                    </p>
                </div>
            </div>
        ), true);
    }

    const isDevBypass = accessState.kind === 'dev-bypass';
    return withAdminClerk((
        <IssueHandoffProvider>
            <div className="geo-shell">
                <AdminSidebar devBypass={isDevBypass} devBypassEmail={accessState.admin.email} />
                <div className="geo-main">
                    <AdminTopCommandBar />
                    {isDevBypass ? (
                        <div className="border-b border-amber-400/15 bg-amber-400/10 px-4 py-2 text-[11px] text-amber-100/85 md:px-5">
                            Mode local de développement actif : l&apos;authentification admin est simulée uniquement sur localhost tant que{' '}
                            <code className="text-amber-50">DEV_BYPASS_AUTH=1</code>.
                        </div>
                    ) : null}
                    <div className="geo-content">{children}</div>
                </div>
            </div>
            <IssueActionsDrawer />
            <AdminKeyboardShortcuts />
        </IssueHandoffProvider>
    ), true);
}

