import SeoHealthView from '@/features/admin/seo/SeoHealthView';

export const metadata = {
    title: 'Santé SEO',
    description: 'Lecture technique SEO du mandat: indexation, canonical, robots, schema et problèmes prioritaires.',
};

export default function ClientSeoHealthPage() {
    return <SeoHealthView />;
}

