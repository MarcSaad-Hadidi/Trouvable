'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export default function useSignInRedirect() {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            router.replace('/espace/apres-connexion');
        }
    }, [isLoaded, isSignedIn, router]);

    return { isLoaded, isSignedIn };
}
