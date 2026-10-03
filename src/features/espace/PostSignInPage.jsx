import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';

import { resolvePostSignInDestination } from '@/features/auth/resolve-post-sign-in-destination';

export const dynamic = 'force-dynamic';

function displayEmail(user) {
    const primary = user?.emailAddresses?.find((entry) => entry.id === user?.primaryEmailAddressId)?.emailAddress;
    return primary || user?.emailAddresses?.[0]?.emailAddress || '';
}

export default async function PostSignInPage() {
    const { userId } = await auth();
    if (!userId) {
        redirect('/espace');
    }

    const destination = await resolvePostSignInDestination();
    if (destination) {
        redirect(destination);
    }

    const user = await currentUser();
    const userEmail = displayEmail(user);

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-[#050505] px-6 py-12 text-center">
            <h1 className="mb-2 text-xl font-bold text-white">Aucun accès Trouvable pour ce compte</h1>
            <p className="mb-6 max-w-md text-sm text-white/45">
                Le compte <span className="font-medium text-white/70">{userEmail}</span> n&apos;est pas configuré comme administrateur
                ni comme invité sur un portail client actif.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                    href="/espace"
                    className="rounded-xl border border-white/12 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.1]"
                >
                    Réessayer une autre connexion
                </Link>
                <Link href="/" className="rounded-xl bg-[#5b73ff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4a62ee]">
                    Retour au site
                </Link>
            </div>
            <p className="mt-8 max-w-md text-xs text-white/30">
                Portail client : l&apos;équipe doit activer votre courriel dans l&apos;admin. Administrateurs : liste{' '}
                <code className="text-white/40">CLERK_ADMIN_EMAIL</code>.
            </p>
        </div>
    );
}
