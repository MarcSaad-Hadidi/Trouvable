import { redirect } from 'next/navigation';

export default async function PromptsRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/prompts`);
}

