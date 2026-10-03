import { redirect } from 'next/navigation';

export default async function ModelsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/models`);
}

