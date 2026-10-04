import { redirect } from 'next/navigation';

export default async function GeoSchemaRedirectPage({ params }) {
    const { clientId } = await params;
    redirect(`/admin/clients/${clientId}/geo/schema`);
}
