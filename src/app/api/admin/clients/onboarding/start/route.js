import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { startClientOnboarding } from '@/lib/onboarding/client-onboarding';

const startSchema = z.object({
    business_name: z.string().min(2).max(200),
    website_url: z.string().min(4).max(500),
    primary_region: z.string().min(2).max(160),
    category: z.string().max(120).optional().or(z.literal('')),
    primary_contact_email: z.string().email().max(320),
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

    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    try {
        const onboarding = await startClientOnboarding(parsed.data, {
            performedBy: admin.email || null,
        });

        return NextResponse.json({
            success: true,
            onboarding,
        });
    } catch (error) {
        console.error('[clients/onboarding/start]', error);
        const message = error?.message || 'Echec onboarding start';
        const status = message.includes('Invalid URL') ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
