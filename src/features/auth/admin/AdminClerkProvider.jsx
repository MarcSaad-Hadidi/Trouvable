'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { frFR } from '@clerk/localizations';
import { clerkProviderAppearance } from '@/features/auth/clerk-provider-appearance';

export default function AdminClerkProvider({ children }) {
    return (
        <ClerkProvider
            localization={frFR}
            appearance={clerkProviderAppearance}
            signInUrl="/admin/sign-in"
            signUpUrl="/admin/sign-in"
            afterSignInUrl="/espace/apres-connexion"
        >
            {children}
        </ClerkProvider>
    );
}
