import { redirect } from 'next/navigation';

export default async function SocialRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/social`);
}

