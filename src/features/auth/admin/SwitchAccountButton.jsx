'use client';

import { useClerk } from '@clerk/nextjs';
import { useState } from 'react';

/**
 * Déconnecte la session Clerk puis envoie vers la page de connexion.
 * Un simple <a href="/admin/sign-in"> ne suffit pas : l’utilisateur reste connecté.
 */
export default function SwitchAccountButton({ className }) {
    const { signOut } = useClerk();
    const [pending, setPending] = useState(false);

    const handleClick = async () => {
        setPending(true);
        try {
            await signOut({ redirectUrl: '/espace' });
        } catch {
            setPending(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            className={className}
        >
            {pending ? 'Déconnexion…' : 'Se connecter avec un autre compte'}
        </button>
    );
}
