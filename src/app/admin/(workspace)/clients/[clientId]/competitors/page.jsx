import { redirect } from 'next/navigation';

export default async function CompetitorsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/signals?focus=competitors`);
}

