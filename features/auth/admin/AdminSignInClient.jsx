'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { signInAppearance } from '@/features/auth/sign-in-appearance';

const ClerkSignIn = dynamic(
    () => import('@clerk/nextjs').then((mod) => mod.SignIn),
    { ssr: false }
);

/** Composant client : garantit le montage de Clerk cote navigateur (Vercel / hydration). */
export default function AdminSignInClient() {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();
    const [showSignIn, setShowSignIn] = useState(false);

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            router.replace('/espace/apres-connexion');
        }
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (showSignIn) return undefined;
        const id = window.setTimeout(() => setShowSignIn(true), 1200);
        return () => window.clearTimeout(id);
    }, [showSignIn]);

    if (!isLoaded) {
        return (
            <div
                className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-xl bg-white/[0.03]"
                aria-busy="true"
            >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#5b73ff]" />
                <p className="text-sm text-zinc-500">Chargement...</p>
            </div>
        );
    }

    if (isSignedIn) {
        return (
            <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#5b73ff]" />
                <p className="text-sm text-zinc-400">Redirection vers le tableau de bord...</p>
            </div>
        );
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