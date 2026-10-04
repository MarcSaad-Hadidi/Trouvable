import { buildPublicMetadata } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site-config';

export const metadata = buildPublicMetadata({
    title: 'Notre mesure | Trouvable',
    canonical: `${SITE_URL}/notre-mesure`,
    description:
        'Cadre de mesure Trouvable : distinguer signaux techniques, présence Google et IA, puis indicateurs d’affaires vérifiables.',
});

export default function NotreMesureLayout({ children }) {
    return children;
}
