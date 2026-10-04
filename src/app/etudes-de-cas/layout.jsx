import { buildPublicMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site-config';

export const metadata = buildPublicMetadata({
    title: 'Études de cas | Trouvable',
    canonical: `${SITE_URL}/etudes-de-cas`,
    description:
        'Études de cas Trouvable : exemples anonymisés de mandats, livrables, mesures Google et IA, sans promesse de résultat inventée.',
});

export default function EtudesDeCasLayout({ children }) {
    return children;
}
