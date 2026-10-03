'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { signInAppearance } from '@/features/auth/sign-in-appearance';

const ClerkSignIn = dynamic(
    () => import('@clerk/nextjs').then((mod) => mod.SignIn),
    { ssr: false }
);

const REDIRECT = '/espace/apres-connexion';

export default function EspaceSignInClient() {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            router.replace(REDIRECT);
        }
    }, [isLoaded, isSignedIn, router]);

    if (!isLoaded) {
        return (
            <div
                className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-xl bg-white/[0.03]"
                aria-busy="true"
            >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#5b73ff]" />
                <p className="text-sm text-zinc-500">Chargement…</p>
            </div>
        );
    }

    if (isSignedIn) {
        return (
            <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#5b73ff]" />
                <p className="text-sm text-zinc-400">Redirection…</p>
            </div>
        );
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
