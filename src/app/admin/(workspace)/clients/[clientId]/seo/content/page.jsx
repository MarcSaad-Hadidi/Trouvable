import SeoContentView from '@/features/admin/seo/SeoContentView';

export const metadata = {
    title: 'Contenu SEO',
    description: 'Lecture opérateur du contenu SEO: couverture éditoriale, retravails, pages manquantes, hubs et consolidations.',
};

export default function ClientSeoContentPage() {
    return <SeoContentView />;
}
