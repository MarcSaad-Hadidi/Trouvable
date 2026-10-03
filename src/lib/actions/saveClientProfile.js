'use server';

import { syncClientProfileCompatibilityFields } from '@/lib/client-profile';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';
import { LIFECYCLE_SERVICEABLE_STATES } from '@/lib/lifecycle';

const clientProfileSchema = z.object({
    id: z.string().uuid().optional().nullable(),
    client_name: z.string().min(2, "Le nom du client est requis (min 2 caractères)"),
    client_slug: z.string().min(2, "Le slug est requis").regex(/^[a-z0-9-]+$/, "Le slug ne doit contenir que des minuscules, chiffres et tirets"),
    website_url: z.union([
        z.string().url("L'URL du site web est invalide"),
        z.literal(''),
        z.null(),
        z.undefined()
    ]).transform(e => (e === null || e === undefined) ? '' : e),
    business_type: z.string().max(50, "Le type d'entreprise est trop long").optional().transform(e => e?.trim() || ''),
    seo_title: z.string().max(70, "Le titre SEO est trop long (max 70)").optional().nullable(),
    seo_description: z.string().max(200, "La description SEO est trop longue (max 200)").optional().nullable(),
    is_published: z.boolean().default(false),
    social_profiles: z.array(
        z.string().url("URL de profil social invalide")
    ).max(10, "Maximum 10 profils sociaux autorisés").default([]),
    address: z.object({
        street: z.string().max(100).optional().nullable(),
        city: z.string().max(60).optional().nullable(),
        region: z.string().max(60).optional().nullable(),
        postalCode: z.string().max(20).optional().nullable(),
        country: z.string().max(60).optional().nullable()
    }).default({}),
    geo_faqs: z.array(
        z.object({
            question: z.string().min(5, "Question FAQ trop courte (min 5 chars)").max(200, "Question FAQ trop longue"),
            answer: z.string().min(10, "Réponse FAQ trop courte (min 10 chars)").max(1000, "Réponse FAQ trop longue")
        })
    ).max(20, "Maximum 20 FAQs autorisées").default([])
});

export async function saveClientProfileAction(formDataObject) {
    const admin = await requireAdmin();
    if (!admin) {
        return { error: 'Non autorisé.' };
    }

    try {
        const validatedData = clientProfileSchema.parse(formDataObject);
        const supabase = getAdminSupabase();
        let existingPublicationStatus = validatedData.is_published ? 'published' : 'draft';

        let slugCheckQuery = supabase
            .from('client_geo_profiles')
            .select('id')
            .eq('client_slug', validatedData.client_slug);

        if (validatedData.id) {
            slugCheckQuery = slugCheckQuery.neq('id', validatedData.id);
        }

        const { data: existingSlugs, error: slugError } = await slugCheckQuery;

        if (slugError) throw slugError;
        if (existingSlugs && existingSlugs.length > 0) {
            return { error: 'Ce slug (URL) est déjà utilisé par un autre client.' };
        }

        if (validatedData.id) {
            const { data: existingProfile, error: existingProfileError } = await supabase
                .from('client_geo_profiles')
                .select('publication_status, is_published, lifecycle_status')
                .eq('id', validatedData.id)
                .single();

            if (existingProfileError) throw existingProfileError;

            // Lifecycle guard: block publishing from non-serviceable states
            if (validatedData.is_published && !existingProfile?.is_published) {
                const lifecycle = existingProfile?.lifecycle_status || 'prospect';
                if (!LIFECYCLE_SERVICEABLE_STATES.includes(lifecycle)) {
                    return { error: `Publication bloquée : état du cycle de vie « ${lifecycle} ».` };
                }
            }

            existingPublicationStatus = existingProfile?.publication_status
                || (existingProfile?.is_published ? 'published' : 'draft');
        }

        const cleanAddress = Object.fromEntries(
            Object.entries(validatedData.address || {})
                .filter(([_, v]) => v !== null && v !== undefined && v.toString().trim() !== '')
        );

        const nextPublicationStatus = validatedData.is_published
            ? 'published'
            : existingPublicationStatus === 'published'
                ? 'draft'
                : existingPublicationStatus || 'draft';

        const payload = syncClientProfileCompatibilityFields({
            client_name: validatedData.client_name,
            client_slug: validatedData.client_slug,
            website_url: validatedData.website_url || '',
            business_type: validatedData.business_type,
            seo_title: validatedData.seo_title || null,
            seo_description: validatedData.seo_description || null,
            is_published: validatedData.is_published,
            publication_status: nextPublicationStatus,
            social_profiles: validatedData.social_profiles,
            address: cleanAddress,
            geo_faqs: validatedData.geo_faqs,
        });

        let resultError = null;

        if (validatedData.id) {
            const { error: updateError } = await supabase
                .from('client_geo_profiles')
                .update(payload)
                .eq('id', validatedData.id);
            resultError = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('client_geo_profiles')
                .insert([payload]);
            resultError = insertError;
        }

        if (resultError) {
            console.error('[SaveClient] DB error:', resultError);
            return { error: 'Erreur lors de la sauvegarde en base de données.' };
        }

    } catch (err) {
        if (err?.issues && Array.isArray(err.issues) && err.issues.length > 0) {
            const messages = err.issues.map(i => i.message).join(' | ');
            return { error: messages };
        }
        console.error('[SaveClient] Error:', err);
        return { error: 'Une erreur inattendue est survenue.' };
    }

    revalidatePath('/admin/clients');
    return { success: true };
}
