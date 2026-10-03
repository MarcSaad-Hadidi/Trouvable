import { redirect } from 'next/navigation';

export default async function OpportunitiesRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/opportunities`);
}

