import { ClerkProvider } from '@clerk/nextjs';
import { frFR } from '@clerk/localizations';
import { clerkProviderAppearance } from '@/features/auth/clerk-provider-appearance';

export const metadata = {
    title: 'Espace client | Trouvable',
    robots: { index: false, follow: false },
};

export default function EspaceLayout({ children }) {
    return (
        <ClerkProvider
            localization={frFR}
            appearance={clerkProviderAppearance}
            signInUrl="/espace"
            signUpUrl="/espace"
            afterSignInUrl="/espace/apres-connexion"
        >
            {children}
        </ClerkProvider>
    );
}
