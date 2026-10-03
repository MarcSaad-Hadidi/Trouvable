import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Redirection Visibilité SEO',
    description: 'Redirection vers la nouvelle surface Visibilité SEO.',
};

export default async function VisibilityPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/seo/visibility`);
}

