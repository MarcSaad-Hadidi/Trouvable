'use client';

import dynamic from 'next/dynamic';
import useSignInRedirect from '@/features/auth/useSignInRedirect';
import SignInProgress from '@/features/auth/SignInProgress';
import { signInAppearance } from '@/features/auth/sign-in-appearance';

const ClerkSignIn = dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignIn), { ssr: false });

export default function PortalSignInClient() {
    const { isLoaded, isSignedIn } = useSignInRedirect();

    if (!isLoaded || isSignedIn) {
        return (
            <SignInProgress
                isLoaded={isLoaded}
                loadingMessage="Chargement…"
                redirectMessage="Redirection vers votre espace…"
            />
        );
    }

    return (
        <div className="w-full space-y-4">
            <p className="text-center text-sm text-zinc-400">
                Utilisez le même courriel que celui invité sur votre dossier Trouvable (doit être vérifié dans votre
                compte).
            </p>
            <ClerkSignIn
                routing="path"
                path="/portal/sign-in"
                forceRedirectUrl="/espace/apres-connexion"
                fallbackRedirectUrl="/espace/apres-connexion"
                appearance={signInAppearance}
            />
        </div>
    );
}
