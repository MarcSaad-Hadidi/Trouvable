import { Suspense } from 'react';

import SignInShell from '@/features/auth/SignInShell';

import EspaceSignInClient from './EspaceSignInClient';

export const dynamic = 'force-dynamic';

export default function EspaceSignInPage() {
    return (
        <SignInShell footer="Connexion securisee (Clerk).">
            <Suspense
                fallback={
                    <div
                        className="w-full min-h-[280px] rounded-xl bg-white/[0.03] animate-pulse"
                        aria-hidden
                    />
                }
            >
                <EspaceSignInClient />
            </Suspense>
        </SignInShell>
    );
}
