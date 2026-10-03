import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import {
    CorrectionPromptServiceError,
    generateSeoHealthCorrectionPrompt,
    generateCorrectionPromptFromRef,
} from '@/lib/correction-prompts/service';

function noStoreJson(payload, init = {}) {
    return NextResponse.json(payload, {
        ...init,
        headers: {
            'Cache-Control': 'no-store',
            ...(init.headers || {}),
        },
    });
}

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
    const admin = await requireAdmin();
    if (!admin) {
        return noStoreJson({ error: 'Non autorise' }, { status: 401 });
    }

    const { clientId } = await params;
    if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
        return noStoreJson({ error: 'ID invalide' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const ref = body?.ref && typeof body.ref === 'object' ? body.ref : null;
    const issueId = typeof body?.issueId === 'string' ? body.issueId.trim() : '';

    try {
        if (ref) {
            // Nouveau flux ProblemRef — force clientId depuis l'URL.
            const result = await generateCorrectionPromptFromRef({
                ref: { ...ref, clientId },
                triggerSource: typeof body?.triggerSource === 'string' ? body.triggerSource : 'manual',
            });
            return noStoreJson(result);
        }

        if (!issueId) {
            return noStoreJson({ error: 'issueId ou ref manquant' }, { status: 400 });
        }

        // Flux legacy SEO Health — préservé tel quel.
        const result = await generateSeoHealthCorrectionPrompt({
            clientId,
            issueId,
            triggerSource: 'manual',
        });

        return noStoreJson(result);
    } catch (error) {
        if (error instanceof CorrectionPromptServiceError) {
            return noStoreJson({
                error: error.message,
                details: error.details || null,
            }, { status: error.status || 500 });
        }

        console.error(`[api/admin/seo/client/${clientId}/correction-prompt]`, error);
        return noStoreJson({ error: 'Erreur generation prompt correction' }, { status: 500 });
    }
}

