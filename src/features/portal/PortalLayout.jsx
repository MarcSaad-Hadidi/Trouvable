import { ClerkProvider } from '@clerk/nextjs';
import { clerkProviderAppearance } from '@/features/auth/clerk-provider-appearance';
import { frFR } from '@clerk/localizations';

export const metadata = {
    robots: { index: false, follow: false },
};

export default function PortalLayout({ children }) {
    return (
        <ClerkProvider
            localization={frFR}
            appearance={clerkProviderAppearance}
            signInUrl="/portal/sign-in"
            signUpUrl="/portal/sign-in"
            afterSignInUrl="/espace/apres-connexion"
        >
            {children}
        </ClerkProvider>
    );
}
