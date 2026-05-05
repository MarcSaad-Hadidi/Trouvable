import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { trackedQueryCreateSchema } from '@/lib/admin-schemas';
import * as db from '@/lib/db';
import { inferDiscoveryMode, normalizeDiscoveryMode } from '@/lib/operator-intelligence/prompt-taxonomy';
import { buildPromptMetadata, shouldSoftBlockPromptActivation } from '@/lib/queries/prompt-intelligence';
import { serializePromptContractForDb } from '@/lib/queries/prompt-contract-persistence';

const TRACKED_QUERY_DRIFT_ERROR =
    'Impossible d enregistrer ce prompt suivi: environnement DB en drift de contraintes. Appliquez les migrations Supabase les plus recentes puis reessayez.';

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const validation = trackedQueryCreateSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: 'Validation', details: validation.error.issues }, { status: 400 });
    }

    const input = validation.data;
    try {
        const client = await db.getClientById(input.clientId);
        const promptMetadata = buildPromptMetadata({
            queryText: input.query_text,
            clientName: client?.client_name || '',
            city: client?.address?.city || client?.target_region || '',
            region: client?.target_region || '',
            locale: input.locale || 'fr-CA',
            category: client?.business_type || '',
            services: client?.business_details?.services || [],
            knownCompetitors: client?.business_details?.competitors || [],
            promptOrigin: input.prompt_origin || 'manual_operator',
            intentFamily: input.intent_family || null,
            promptMode: input.prompt_mode || input.prompt_metadata?.prompt_mode || 'user_like',
            offerAnchor: input.offer_anchor || input.prompt_metadata?.offer_anchor || '',
            userVisibleOffering: input.user_visible_offering || input.prompt_metadata?.user_visible_offering || '',
            targetAudience: input.target_audience || input.prompt_metadata?.target_audience || '',
            primaryUseCase: input.primary_use_case || input.prompt_metadata?.primary_use_case || '',
            differentiationAngle: input.differentiation_angle || input.prompt_metadata?.differentiation_angle || '',
        });
        const resolvedDiscoveryMode = input.discovery_mode
            ? normalizeDiscoveryMode(input.discovery_mode)
            : inferDiscoveryMode({
                category: input.category || input.query_type,
                intentFamily: input.intent_family,
                queryText: input.query_text,
                clientName: client?.client_name || '',
            });
        const activationBlocked = shouldSoftBlockPromptActivation(promptMetadata) && input.is_active !== false;
        const serialized = serializePromptContractForDb({
            contract: promptMetadata,
            existingPromptMetadata: input.prompt_metadata || {},
            extraPromptMetadata: {
                generated_at: new Date().toISOString(),
                discovery_mode: resolvedDiscoveryMode,
            },
        });

        const row = await db.createTrackedQuery({
            client_id: input.clientId,
            query_text: input.query_text,
            category: input.category,
            discovery_mode: resolvedDiscoveryMode,
            locale: input.locale,
            query_type: input.query_type,
            is_active: activationBlocked ? false : input.is_active,
            ...serialized.dbFields,
            prompt_metadata: serialized.prompt_metadata,
        });

        await db.logAction({
            client_id: input.clientId,
            action_type: 'tracked_query_created',
            details: {
                id: row.id,
                quality_status: promptMetadata.quality_status,
                discovery_mode: resolvedDiscoveryMode,
                activation_blocked: activationBlocked,
            },
            performed_by: admin.email,
        });

        return NextResponse.json({
            success: true,
            query: row,
            quality: promptMetadata,
            activation_blocked: activationBlocked,
            warning: activationBlocked
                ? 'Prompt cree avec statut faible: activation bloquee en attente de revue operateur.'
                : null,
        });
    } catch (error) {
        console.error('[queries/create]', error);
        if (db.isTrackedQueryConstraintDrift(error)) {
            return NextResponse.json({ error: TRACKED_QUERY_DRIFT_ERROR }, { status: 500 });
        }
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
