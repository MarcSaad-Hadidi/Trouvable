import { buildPublicMetadata } from '@/lib/seo/metadata';

export const metadata = buildPublicMetadata({
    title: 'Méthodologie | Trouvable',
    description:
        'Méthodologie Trouvable en quatre étapes : audit de visibilité, mise aux normes, enrichissement IA et validation continue des signaux publics.',
});

export default function MethodologieLayout({ children }) {
    return children;
}
