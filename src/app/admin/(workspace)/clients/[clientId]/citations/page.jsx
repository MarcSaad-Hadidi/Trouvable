import { redirect } from 'next/navigation';

export default async function CitationsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/signals?focus=citations`);
}

