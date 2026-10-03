import { redirect } from 'next/navigation';

export default async function SettingsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/dossier/settings`);
}

