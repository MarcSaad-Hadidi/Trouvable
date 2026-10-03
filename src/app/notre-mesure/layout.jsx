import { buildPublicMetadata } from '@/lib/seo/metadata';

export const metadata = buildPublicMetadata({
    title: 'Notre mesure | Trouvable',
    description:
        'Cadre de mesure Trouvable : distinguer signaux techniques, présence Google et IA, puis indicateurs d’affaires vérifiables.',
});

export default function NotreMesureLayout({ children }) {
    return children;
}
