import { redirect } from 'next/navigation';

export default async function ContinuousRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/continuous`);
}

