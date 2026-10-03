import { redirect } from 'next/navigation';

export default async function SignalsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/signals`);
}

