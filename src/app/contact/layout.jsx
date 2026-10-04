import { buildPublicMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site-config';

export const metadata = buildPublicMetadata({
    title: 'Contact | Trouvable',
    canonical: `${SITE_URL}/contact`,
    description:
        'Planifiez un appel de cadrage avec Trouvable pour évaluer votre visibilité Google, vos réponses IA et le mandat le plus adapté.',
});

export default function ContactLayout({ children }) {
    return children;
}
