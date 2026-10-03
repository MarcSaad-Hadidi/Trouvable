import { Suspense } from 'react';

import SignInShell from '@/features/auth/SignInShell';

import PortalSignInClient from './PortalSignInClient';

export const metadata = {
    title: 'Connexion client - Trouvable',
    robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function PortalSignInPage() {
    return (
        <SignInShell
            ariaLabel="Trouvable - Retour au site public"
            description="Espace client : consultation de votre dossier. Pas de compte ? Contactez l'equipe qui gere votre fiche Trouvable."
            footer="Connexion securisee (Clerk). Acces accorde par courriel invite, verifie sur ce compte."
        >
            <Suspense
                fallback={
                    <div
                        className="w-full min-h-[280px] rounded-xl bg-white/[0.03] animate-pulse"
                        aria-hidden
                    />
                }
            >
                <PortalSignInClient />
            </Suspense>
        </SignInShell>
    );
}
