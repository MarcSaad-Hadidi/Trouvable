import { redirect } from 'next/navigation';

export default async function LlmsTxtRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/llms-txt`);
}

