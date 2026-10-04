'use client';

import dynamic from 'next/dynamic';
import useSignInRedirect from '@/features/auth/useSignInRedirect';
import SignInProgress from '@/features/auth/SignInProgress';
import { signInAppearance } from '@/features/auth/sign-in-appearance';

const ClerkSignIn = dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignIn), { ssr: false });

const REDIRECT = '/espace/apres-connexion';

export default function EspaceSignInClient() {
    const { isLoaded, isSignedIn } = useSignInRedirect();

    if (!isLoaded || isSignedIn) {
        return <SignInProgress isLoaded={isLoaded} loadingMessage="Chargement…" redirectMessage="Redirection…" />;
    }

    return (
        <div className="w-full">
            <ClerkSignIn
                routing="path"
                path="/espace"
                forceRedirectUrl={REDIRECT}
                fallbackRedirectUrl={REDIRECT}
                appearance={signInAppearance}
            />
        </div>
    );
}
