import { redirect } from 'next/navigation';

export default async function ClientIndexPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/dossier`);
}

