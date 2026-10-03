import { redirect } from 'next/navigation';

export default async function GeoCrawlersRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/crawlers`);
}
