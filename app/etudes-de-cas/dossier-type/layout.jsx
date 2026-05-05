import { buildPublicMetadata } from '@/lib/seo/metadata';

export const metadata = buildPublicMetadata({
    title: 'Dossier-type | Trouvable',
    description:
        'Découvrez un dossier-type Trouvable : audit initial, mise aux normes, livrables anonymisés et pilotage continu documenté.',
});

export default function DossierTypeLayout({ children }) {
    return children;
}
