import { redirect } from 'next/navigation';

export default async function RunsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/runs`);
}

