import { getAdminSupabase } from '@/lib/supabase-admin';
import { VILLES, EXPERTISES } from '../lib/data/geo-architecture';
import { SEO_GROWTH_PAGES } from '@/lib/data/seo-growth-pages';
import { SITE_LAST_MODIFIED_ISO, SITE_URL } from '@/lib/site-config';

export const revalidate = 3600; // Revalider le sitemap toutes les heures (3600 secondes)

export default async function sitemap() {

    const staticPaths = [
        '',
        '/offres',
        '/methodologie',
        '/notre-mesure',
        '/a-propos',
        '/contact',
        '/recherche',
        '/etudes-de-cas',
        '/etudes-de-cas/dossier-type',
    ];

    const routes = staticPaths.map((path) => ({
        url: `${SITE_URL}${path}`,
        lastModified: new Date(SITE_LAST_MODIFIED_ISO),
        changeFrequency: path === '' ? 'weekly' : 'monthly',
        priority: path === '' ? 1.0 : 0.85,
    }));

    // Build static programmatic SEO routes (Villes & Expertises)
    VILLES.forEach(ville => {
        routes.push({
            url: `${SITE_URL}/villes/${ville.slug}`,
            lastModified: new Date(SITE_LAST_MODIFIED_ISO),
            changeFrequency: 'monthly',
            priority: 0.9,
        });
    });

    EXPERTISES.forEach(expertise => {
        routes.push({
            url: `${SITE_URL}/expertises/${expertise.slug}`,
            lastModified: new Date(SITE_LAST_MODIFIED_ISO),
            changeFrequency: 'monthly',
            priority: 0.9,
        });
    });

    SEO_GROWTH_PAGES.forEach(page => {
        routes.push({
            url: `${SITE_URL}${page.path}`,
            lastModified: new Date(SITE_LAST_MODIFIED_ISO),
            changeFrequency: 'monthly',
            priority: page.path === '/agence-geo-montreal' ? 0.95 : 0.9,
        });
    });

    // Fetch published clients for the sitemap (server-side only, uses service_role)
    try {
        const supabase = getAdminSupabase();

        const { data: clients } = await supabase
            .from('client_geo_profiles')
            .select('client_slug, updated_at')
            .eq('is_published', true)
            .in('lifecycle_status', ['active', 'paused']);

        if (clients && clients.length > 0) {
            const clientRoutes = clients.map((client) => ({
                url: `${SITE_URL}/clients/${client.client_slug}`,
                lastModified: new Date(client.updated_at),
                changeFrequency: 'monthly',
                priority: 0.8,
            }));

            routes.push(...clientRoutes);
        }
    } catch (err) {
        console.error('[Sitemap] Error fetching clients:', err.message);
    }

    return routes;
}

