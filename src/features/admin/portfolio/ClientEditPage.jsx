import { getAdminSupabase } from '@/lib/supabase-admin';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import ClientForm from '@/features/admin/portfolio/ClientForm';
import {
    COMMAND_BUTTONS,
    CommandHeader,
    CommandPageShell,
} from '@/features/admin/shared/components/command';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
    return { title: 'Éditer le profil | Trouvable OS' };
}

export default async function EditClientPage({ params }) {
    const { clientId } = await params;
    const supabase = getAdminSupabase();

    const { data: client, error } = await supabase
        .from('client_geo_profiles')
        .select('id, client_name, client_slug, website_url, business_type, seo_title, seo_description, is_published, social_profiles, address, geo_faqs')
        .eq('id', clientId)
        .single();

    if (error || !client) notFound();

    const header = (
        <CommandHeader
            eyebrow="Paramètres mandat · Édition"
            title={`Éditer : ${client.client_name}`}
            subtitle="Profil SEO/GEO du mandat. Les changements ici sont appliqués au site public et à l’ensemble des analyses."
            actions={(
                <>
                    <Link href={`/admin/clients/${clientId}/dossier`} className={COMMAND_BUTTONS.secondary}>
                        Retour au dossier
                    </Link>
                    <Link href={`/admin/clients/${clientId}/dossier/settings`} className={COMMAND_BUTTONS.subtle}>
                        Paramètres
                    </Link>
                </>
            )}
        />
    );

    return (
        <CommandPageShell header={header}>
            <ClientForm initialData={client} />
        </CommandPageShell>
    );
}

