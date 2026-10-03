import { redirect } from 'next/navigation';

export default async function OverviewRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo`);
}

