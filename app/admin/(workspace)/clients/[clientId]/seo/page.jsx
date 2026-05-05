import SeoOverviewView from '@/features/admin/dashboard/seo/SeoOverviewView';

export const metadata = {
    title: 'SEO Ops',
    description: 'Entree SEO Ops du mandat operateur.',
};

export default function ClientSeoPage() {
    return <SeoOverviewView />;
}
