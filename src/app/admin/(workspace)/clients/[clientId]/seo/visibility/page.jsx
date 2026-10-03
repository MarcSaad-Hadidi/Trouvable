import SeoVisibilityView from '@/features/admin/seo/SeoVisibilityView';

export const metadata = {
    title: 'Visibilité SEO',
    description: 'Lecture SEO des clics, impressions, CTR, position et requêtes organiques.',
};

export default function ClientSeoVisibilityPage() {
    return <SeoVisibilityView />;
}
