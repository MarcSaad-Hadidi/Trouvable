import { buildPublicMetadata } from '@/lib/seo/metadata';

export const metadata = buildPublicMetadata({
    title: 'Contact | Trouvable',
    description:
        'Planifiez un appel de cadrage avec Trouvable pour évaluer votre visibilité Google, vos réponses IA et le mandat le plus adapté.',
});

export default function ContactLayout({ children }) {
    return children;
}
