'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import useSignInRedirect from '@/features/auth/useSignInRedirect';
import SignInProgress from '@/features/auth/SignInProgress';
import { signInAppearance } from '@/features/auth/sign-in-appearance';

const ClerkSignIn = dynamic(
    () => import('@clerk/nextjs').then((mod) => mod.SignIn),
    { ssr: false }
);

/** Composant client : garantit le montage de Clerk cote navigateur (Vercel / hydration). */
export default function AdminSignInClient() {
    const { isLoaded, isSignedIn } = useSignInRedirect();
    const [showSignIn, setShowSignIn] = useState(false);

    useEffect(() => {
        if (showSignIn) return undefined;
        const id = window.setTimeout(() => setShowSignIn(true), 1200);
        return () => window.clearTimeout(id);
    }, [showSignIn]);

    if (!isLoaded || isSignedIn) {
        return <SignInProgress isLoaded={isLoaded} loadingMessage="Chargement..." redirectMessage="Redirection vers le tableau de bord..." />;
    }

    if (!showSignIn) {
        return (
            <div className="flex min-h-[260px] w-full flex-col items-center justify-center gap-4 rounded-xl bg-white/[0.03] p-4 text-center">
                <p className="text-sm text-zinc-300">Connexion securisee administrateur</p>
                <button
                    type="button"
                    onClick={() => setShowSignIn(true)}
                    className="rounded-xl bg-[#5b73ff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a62ee]"
                >
                    Ouvrir le formulaire
                </button>
            </div>
        );
    }

    return (
        <ClerkSignIn
            routing="path"
            path="/admin/sign-in"
            forceRedirectUrl="/espace/apres-connexion"
            fallbackRedirectUrl="/espace/apres-connexion"
            appearance={signInAppearance}
        />
    );
}