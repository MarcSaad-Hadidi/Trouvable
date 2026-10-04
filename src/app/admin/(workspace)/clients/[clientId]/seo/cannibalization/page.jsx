import SeoCannibalizationView from '@/features/admin/seo/SeoCannibalizationView';

export const metadata = {
    title: 'Cannibalisation SEO',
    description:
        'Lecture opérateur du recouvrement potentiel ou probable entre pages SEO, fondée uniquement sur les signaux réellement disponibles.',
};

export default function ClientSeoCannibalizationPage() {
    return <SeoCannibalizationView />;
}
