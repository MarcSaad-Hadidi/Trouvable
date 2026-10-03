import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { normalizeClientProfileShape } from '@/lib/client-profile';

// Utilisation de la clé publique (ANON KEY) uniquement,
// car l'accès est désormais géré par le RLS de Supabase.
const getSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return null; // Configuration missing, do not spawn an invalid client
    }

    return createClient(supabaseUrl, supabaseAnonKey);
};

/**
 * Récupère le profil SEO complet d'un client de façon sécurisée (SSR).
 * Utilise React Cache pour dédupliquer les appels entre generateMetadata et la Page.
 */
export const getClientProfile = cache(async (slug) => {
    const supabase = getSupabaseClient();

    // Si l'environnement Supabase est invalide (manquant) ou le slug absent,
    // on fail fast en retournant null (provoquera un 404 propre).
    if (!slug || !supabase) return null;

    const { data, error } = await supabase
        .from('client_geo_profiles')
        // Liste explicite des colonnes nécessaires (réduction de la surface d'attaque/fuite)
        .select(`
            client_slug, 
            client_name, 
            seo_title, 
            seo_description, 
            website_url, 
            business_type, 
            address, 
            geo_faqs,
            social_profiles,
            contact_info,
            business_details
        `)
        .eq('client_slug', slug)
        // Seules les données avec is_published à TRUE seront renvoyées (sécurité supplémentaire au RLS)
        .eq('is_published', true)
        // Lifecycle guard: only serviceable clients appear on public pages
        .in('lifecycle_status', ['active', 'paused'])
        .single();

    if (error || !data) {
        return null;
    }

    return normalizeClientProfileShape(data);
});
