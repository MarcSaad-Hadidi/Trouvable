import { buildPublicMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site-config';

export const metadata = buildPublicMetadata({
    title: 'Méthodologie | Trouvable',
    canonical: `${SITE_URL}/methodologie`,
    description:
        'Méthodologie Trouvable en quatre étapes : audit de visibilité, mise aux normes, enrichissement IA et validation continue des signaux publics.',
});

export default function MethodologieLayout({ children }) {
    return children;
}
