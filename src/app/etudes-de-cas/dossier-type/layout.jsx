import { buildPublicMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site-config';

export const metadata = buildPublicMetadata({
    title: 'Dossier-type | Trouvable',
    canonical: `${SITE_URL}/etudes-de-cas/dossier-type`,
    description:
        'Découvrez un dossier-type Trouvable : audit initial, mise aux normes, livrables anonymisés et pilotage continu documenté.',
});

export default function DossierTypeLayout({ children }) {
    return children;
}
