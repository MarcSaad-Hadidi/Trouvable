import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { activateClientOnboarding } from '@/lib/onboarding/client-onboarding';

const promptSuggestionSchema = z.object({
    query_text: z.string().min(1).max(2000),
    category: z.string().max(64).optional(),
    locale: z.string().max(20).optional(),
    is_active: z.boolean().optional(),
    prompt_mode: z.enum(['user_like', 'operator_probe']).optional(),
    intent_family: z.string().max(80).optional(),
    validation: z.object({
        status: z.enum(['strong', 'review', 'weak']).optional(),
        is_valid: z.boolean().optional(),
        reasons: z.array(z.string().max(240)).max(20).optional(),
    }).optional(),
    offer_anchor: z.string().max(200).optional(),
    offer_label_normalized: z.string().max(200).optional(),
    user_visible_offering: z.string().max(240).optional(),
});

const activateSchema = z.object({
    clientId: z.string().uuid(),
    profile: z.object({
        client_name: z.string().min(2).max(200),
        client_slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
        business_type: z.string().max(120),
        target_region: z.string().max(160),
        seo_description: z.string().max(500).optional().nullable(),
        address: z.object({
            city: z.string().max(120).optional(),
            region: z.string().max(120).optional(),
            country: z.string().max(120).optional(),
        }).optional(),
        contact_info: z.object({
            public_email: z.string().email().max(320).optional(),
            email: z.string().email().max(320).optional(),
            phone: z.string().max(80).optional(),
        }).optional(),
        social_profiles: z.array(z.string().url().max(400)).max(20).optional(),
        business_details: z.object({
            short_desc: z.string().max(500).optional(),
            short_description: z.string().max(500).optional(),
            services: z.array(z.string().max(200)).max(20).optional(),
            areas_served: z.array(z.string().max(120)).max(20).optional(),
        }).optional(),
        geo_faqs: z.array(z.object({
            question: z.string().min(3).max(200),
            answer: z.string().min(3).max(1200),
        })).max(20).optional(),
    }),
    promptSuggestions: z.array(promptSuggestionSchema).max(30).default([]),
    portalDraft: z.object({
        enabled: z.boolean().default(false),
        contact_email: z.string().email().max(320).optional(),
        portal_role: z.enum(['owner', 'viewer']).default('viewer'),
        member_type: z.enum(['client_contact', 'client_staff', 'internal_staff']).default('client_contact'),
    }).optional(),
});

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    try {
        const result = await activateClientOnboarding(parsed.data, {
            performedBy: admin.email || null,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('[clients/onboarding/activate]', error);
        return NextResponse.json({ error: error?.message || 'Echec onboarding activation' }, { status: 500 });
    }
}
