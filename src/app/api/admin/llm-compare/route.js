import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 300;

import { requireAdmin } from '@/lib/auth';
import { compareModels } from '@/lib/llm-comparison/compare-models';
import { LlmComparisonError, SOURCE_TYPES } from '@/lib/llm-comparison/response-contract';

const payloadSchema = z.object({
    source_type: z.enum([SOURCE_TYPES.URL, SOURCE_TYPES.TEXT]).optional(),
    url: z.string().url().optional(),
    text: z.string().min(1).optional(),
    prompt: z.string().min(1).max(20_000),
    provider_timeout_ms: z.number().int().positive().max(120_000).optional(),
    max_content_chars: z.number().int().positive().max(120_000).optional(),
    enable_google_grounding: z.boolean().optional(),
    client_id: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
    if (!value.url && !value.text) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'Fournir au moins `url` ou `text`.',
        });
    }
});

function statusFromError(error) {
    const errClass = error?.errorClass || 'runtime_error';
    if (errClass === 'input_error') return 400;
    if (errClass === 'provider_auth_error') return 503;
    if (errClass === 'timeout') return 504;
    return 500;
}

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
    }

    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Payload invalide', details: parsed.error.issues }, { status: 400 });
    }

    try {
        const result = await compareModels({
            sourceType: parsed.data.source_type || null,
            url: parsed.data.url || null,
            text: parsed.data.text || null,
            prompt: parsed.data.prompt,
            providerTimeoutMs: parsed.data.provider_timeout_ms,
            maxContentChars: parsed.data.max_content_chars,
            enableGoogleGrounding: parsed.data.enable_google_grounding !== false,
        });

        // Persist each successful provider result when a client context is provided
        const clientId = parsed.data.client_id;
        if (clientId) {
            const [{ createQueryRun }, { reparseStoredQueryRun }] = await Promise.all([
                import('@/lib/db/query-runs'),
                import('@/lib/queries/run-tracked-queries'),
            ]);
            const successResults = (result.results || []).filter((r) => r.ok);
            const createdRuns = [];

            for (const r of successResults) {
                try {
                    const run = await createQueryRun({
                        client_id: clientId,
                        tracked_query_id: null,
                        provider: r.provider,
                        model: r.model,
                        query_text: parsed.data.prompt,
                        status: 'completed',
                        run_mode: 'compare',
                        engine_variant: `compare_${r.provider}`,
                        target_found: false,
                        latency_ms: r.latency_ms ?? null,
                        parse_status: 'pending',
                        parse_confidence: null,
                        response_text: r.content || '',
                        raw_response_full: r.content || '',
                        usage_tokens: r.usage || {},
                        prompt_payload: {
                            query_text: parsed.data.prompt,
                            source_type: parsed.data.source_type || null,
                            url: parsed.data.url || null,
                        },
                    });
                    createdRuns.push(run);
                } catch (err) {
                    console.error(`[llm-compare] persist ${r.provider}:`, err?.message || err);
                }
            }

            // Run extraction pipeline on each persisted run to populate
            // parsed_response, normalized_response, mentions, and diagnostics
            const reparses = createdRuns.map((run) =>
                reparseStoredQueryRun({ clientId, runId: run.id })
                    .catch((err) => console.error(`[llm-compare] reparse ${run.id}:`, err?.message || err))
            );
            await Promise.allSettled(reparses);
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[api/admin/llm-compare]', error);
        if (error instanceof LlmComparisonError) {
            return NextResponse.json({
                error: {
                    class: error.errorClass,
                    message: error.message,
                },
            }, { status: statusFromError(error) });
        }
        return NextResponse.json({
            error: {
                class: 'runtime_error',
                message: error?.message || 'Execution compare impossible',
            },
        }, { status: 500 });
    }
}
