import { Suspense } from 'react';

import SignInShell from '@/features/auth/SignInShell';

import AdminSignInClient from './AdminSignInClient';

export const metadata = {
    title: 'Connexion admin | Trouvable',
    robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AdminSignInPage() {
    return (
        <SignInShell footer="Plateforme securisee, acces reserve aux administrateurs">
            <Suspense
                fallback={
                    <div
                        className="w-full min-h-[280px] rounded-xl bg-white/[0.03] animate-pulse"
                        aria-hidden
                    />
                }
            >
                <AdminSignInClient />
            </Suspense>
        </SignInShell>
    );
}
