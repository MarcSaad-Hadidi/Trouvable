import { buildPublicMetadata } from '@/lib/seo/metadata';

export const metadata = buildPublicMetadata({
    title: 'Études de cas | Trouvable',
    description:
        'Études de cas Trouvable : exemples anonymisés de mandats, livrables, mesures Google et IA, sans promesse de résultat inventée.',
});

export default function EtudesDeCasLayout({ children }) {
    return children;
}
