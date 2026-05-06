import 'server-only';

import { callAiJson, callAiText } from '@/lib/ai/index';
import { normalizeGeoQueryAnalysis } from '@/lib/ai/normalize';
import { buildGeoQueryAnalysisPrompt, buildGeoPromptForMode } from '@/lib/ai/prompts';
import { getBusinessShortDescription } from '@/lib/client-profile';
import * as db from '@/lib/db';
import { getExtractionVersion, buildExtractionArtifacts } from '@/lib/queries/extraction-v2';
import { ENGINE_VARIANTS, resolveRequestedBenchmarkVariants, runBenchmarkVariant } from '@/lib/queries/engine-variants';
import { buildRunReviewContract } from '@/lib/queries/run-review-contract';
import { normalizeEntityTypeForDb } from '@/lib/queries/mention-entity-type';
import { normalizeDiscoveryMode, inferDiscoveryMode, isVisibilityEligible, classifyMeasurementOutcome } from '@/lib/operator-intelligence/prompt-taxonomy';

const GEO_DEFAULT_ENGINE_VARIANT = 'tavily_orchestrated';
const GEO_MISTRAL_ENGINE_VARIANT = 'mistral_geo_default';

function flagEnabled(value, defaultValue = false) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return defaultValue;
    }
    return !['0', 'false', 'off', 'no'].includes(String(value).trim().toLowerCase());
}

function resolveGeoMistralEnabled() {
    return flagEnabled(process.env.GEO_USE_MISTRAL_ENGINE, true);
}

function resolveMaxGeoRunsPerClientPerDay() {
    const value = Number(process.env.MAX_GEO_RUNS_PER_CLIENT_PER_DAY || 0);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value);
}

function resolveClientGeoEngineVariant(client = {}) {
    // TODO: prefer a dedicated DB field (e.g. client_geo_profiles.engine_variant) once schema-level toggle is available.
    const requested = String(
        client?.engine_variant
        || client?.geo_ai_data?.engine_variant
        || client?.settings?.geo_engine_variant
        || ''
    ).trim();

    if (requested && ENGINE_VARIANTS[requested]) {
        return requested;
    }

    const wantsMistral = resolveGeoMistralEnabled();
    if (!wantsMistral) {
        return GEO_DEFAULT_ENGINE_VARIANT;
    }

    const mistralVariant = ENGINE_VARIANTS[GEO_MISTRAL_ENGINE_VARIANT];
    const isMistralAvailable = Boolean(mistralVariant
        && (typeof mistralVariant.is_available !== 'function' || mistralVariant.is_available()));
    return isMistralAvailable ? GEO_MISTRAL_ENGINE_VARIANT : GEO_DEFAULT_ENGINE_VARIANT;
}

function resolveAiOverridesForVariant(engineVariant) {
    const variantMeta = ENGINE_VARIANTS[engineVariant] || {};
    if (variantMeta.provider !== 'mistral') {
        return {
            queryCall: {},
            analysisCall: {},
        };
    }

    return {
        queryCall: {
            providerOverride: 'mistral',
            fallbackProvider: null,
            modelOverride: variantMeta.model || null,
            temperature: Number(variantMeta.temperature ?? 0.15),
            maxTokens: Number(variantMeta.max_tokens || 2300),
        },
        analysisCall: {
            providerOverride: 'mistral',
            fallbackProvider: null,
            modelOverride: process.env.MISTRAL_MODEL_AUDIT || variantMeta.model || null,
            temperature: 0.1,
            maxTokens: 2300,
        },
    };
}

function nowMs() {
    return Date.now();
}

function resolveRunMode(trackedQueryId, runMode) {
    if (runMode === 'benchmark') return 'benchmark';
    return trackedQueryId ? 'single_prompt' : 'active_batch';
}

/**
 * Resolve the discovery_mode for a tracked query.
 * Checks the query's explicit discovery_mode first, then infers from metadata.
 */
function resolveQueryDiscoveryMode(query, clientName = '') {
    // Explicit discovery_mode on the tracked query takes priority
    const explicit = query.discovery_mode || query.prompt_metadata?.discovery_mode;
    if (explicit) {
        const raw = String(explicit || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        const normalized = normalizeDiscoveryMode(explicit);
        if (normalized !== 'brand_aware' || raw === 'brand_aware') {
            return normalized;
        }
    }
    // Infer from category, intent, and query text
    return inferDiscoveryMode({
        category: query.category || query.query_type,
        intentFamily: query.intent_family,
        queryText: query.query_text,
        clientName,
    });
}

function normalizeKnownCompetitors(client = {}, competitorAliases = []) {
    const profileCompetitors = Array.isArray(client?.business_details?.competitors)
        ? client.business_details.competitors
        : [];

    const aliasCanonicals = (competitorAliases || [])
        .map((row) => String(row?.canonical_name || '').trim())
        .filter(Boolean);

    return [...new Set([...profileCompetitors, ...aliasCanonicals].map((value) => String(value || '').trim()).filter(Boolean))];
}

function toUsageTotals(queryUsage = {}, analysisUsage = {}) {
    const queryPrompt = Number(queryUsage.prompt_tokens || 0);
    const queryCompletion = Number(queryUsage.completion_tokens || 0);
    const analysisPrompt = Number(analysisUsage.prompt_tokens || 0);
    const analysisCompletion = Number(analysisUsage.completion_tokens || 0);

    return {
        query: {
            prompt_tokens: queryPrompt,
            completion_tokens: queryCompletion,
            total_tokens: queryPrompt + queryCompletion,
        },
        analysis: {
            prompt_tokens: analysisPrompt,
            completion_tokens: analysisCompletion,
            total_tokens: analysisPrompt + analysisCompletion,
        },
        total_tokens: queryPrompt + queryCompletion + analysisPrompt + analysisCompletion,
    };
}

function classifyRunError(errorMessage = '', engineVariant = '') {
    const message = String(errorMessage || '').toLowerCase();
    const variantMeta = ENGINE_VARIANTS[engineVariant] || {};
    if (variantMeta.provider === 'mistral' || message.includes('mistral')) return 'mistral_error';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('rate') || message.includes('429')) return 'rate_limit';
    if (message.includes('provider') || message.includes('api key') || message.includes('http')) return 'provider_error';
    if (message.includes('parse') || message.includes('json')) return 'parse_error';
    return 'runtime_error';
}

function mapMentionsForInsert(queryRunId, mentions = []) {
    return (mentions || []).map((item, index) => ({
        query_run_id: queryRunId,
        business_name: item.business_name || item.normalized_label || '[unknown mention]',
        position: Number.isFinite(Number(item.position)) ? Number(item.position) : (index + 1),
        context: String(item.context || item.evidence_span || '').slice(0, 2000),
        is_target: item.is_target === true,
        sentiment: item.sentiment || 'neutral',
        entity_type: normalizeEntityTypeForDb(item.entity_type),
        mention_kind: item.mention_kind || 'mentioned',
        mentioned_url: item.mentioned_url || null,
        mentioned_domain: item.mentioned_domain || null,
        mentioned_source_name: item.mentioned_source_name || null,
        normalized_domain: item.normalized_domain || null,
        normalized_label: item.normalized_label || null,
        source_type: item.source_type || null,
        source_confidence: item.source_confidence ?? item.confidence ?? null,
        source_evidence_span: item.source_evidence_span || null,
        evidence_span: item.evidence_span || null,
        confidence: item.confidence ?? null,
        first_position: item.first_position ?? item.position ?? null,
        co_occurs_with_target: item.co_occurs_with_target === true,
        verified_status: item.verified_status || 'mentioned',
        recommendation_strength: item.recommendation_strength || null,
    }));
}

async function executeVariantForQuery({
    client,
    query,
    businessContext,
    knownCompetitors,
    competitorAliases,
    runMode = 'standard',
    engineVariant = 'tavily_orchestrated',
    benchmarkSessionId = null,
    discoveryMode = 'brand_aware',
}) {
    const locale = query.locale || 'fr-CA';
    const extractionVersion = getExtractionVersion();
    let queryRun = null;
    let aiResponse = null;
    let analysisResult = null;
    const startedAtMs = nowMs();
    const aiOverrides = resolveAiOverridesForVariant(engineVariant);
    /** Populated once the GEO prompt is built; reused on failure paths for `prompt_payload`. */
    let promptPayloadRow = null;

    try {
        queryRun = await db.createQueryRun({
            client_id: client.id,
            tracked_query_id: query.id,
            query_text: query.query_text,
            provider: 'pending',
            model: 'pending',
            locale,
            status: 'pending',
            run_mode: runMode === 'benchmark' ? 'benchmark' : 'standard',
            engine_variant: engineVariant,
            benchmark_session_id: benchmarkSessionId,
            discovery_mode: discoveryMode,
            response_text: null,
            raw_response_full: null,
            raw_analysis: {},
            parsed_response: {},
            normalized_response: {},
            parse_status: null,
            parse_warnings: [],
            usage_tokens: {},
            extraction_version: extractionVersion,
            target_detection: {},
            retry_count: 0,
        });

        await db.updateQueryRun(queryRun.id, { status: 'running' });

        const promptBuild = buildGeoPromptForMode({
            query: query.query_text,
            mode: discoveryMode,
            businessContext,
            locale,
        });
        const queryMessages = promptBuild.messages;
        promptPayloadRow = {
            query_text: query.query_text,
            discovery_mode: discoveryMode,
            ...promptBuild.metadata,
            query_messages: queryMessages,
        };

        if (runMode === 'benchmark') {
            const benchmarkResult = await runBenchmarkVariant({
                variant: engineVariant,
                messages: queryMessages,
                purpose: 'query',
                maxTokens: 2048,
            });

            if (!benchmarkResult.ok) {
                const latencyMs = nowMs() - startedAtMs;
                const errorMessage = benchmarkResult.error_message || 'Benchmark variant indisponible';
                await db.updateQueryRun(queryRun.id, {
                    provider: benchmarkResult.provider || 'unknown',
                    model: benchmarkResult.model || 'unknown',
                    status: 'failed',
                    error_class: benchmarkResult.error_class || 'variant_unavailable',
                    response_text: null,
                    raw_response_full: null,
                    parse_status: 'parsed_failed',
                    parse_warnings: [errorMessage],
                    latency_ms: latencyMs,
                    prompt_payload: promptPayloadRow,
                    raw_analysis: {
                        benchmark_result: benchmarkResult,
                    },
                    usage_tokens: {},
                });

                return {
                    queryId: query.id,
                    query: query.query_text,
                    runId: queryRun.id,
                    variant: engineVariant,
                    error: errorMessage,
                };
            }

            aiResponse = {
                provider: benchmarkResult.provider,
                model: benchmarkResult.model,
                text: benchmarkResult.text || '',
                usage: benchmarkResult.usage || {},
                sandbox_caveat: benchmarkResult.sandbox_caveat || null,
                cost_estimate_usd: benchmarkResult.cost_estimate_usd ?? null,
            };
        } else {
            const result = await callAiText({
                messages: queryMessages,
                purpose: 'query',
                maxTokens: 2048,
                ...aiOverrides.queryCall,
            });
            aiResponse = {
                provider: result.provider,
                model: result.model || process.env[`${String(result.provider).toUpperCase()}_MODEL_QUERY`] || 'unknown',
                text: result.text || '',
                usage: result.usage || {},
                sandbox_caveat: null,
                cost_estimate_usd: null,
            };
        }

        const analysisMessages = buildGeoQueryAnalysisPrompt(query.query_text, aiResponse.text, client.client_name);
        try {
            analysisResult = await callAiJson({
                messages: analysisMessages,
                purpose: 'query',
                maxTokens: 2048,
                ...aiOverrides.analysisCall,
            });
        } catch (analysisError) {
            console.warn(`[runTrackedQueries] JSON analysis failed for run ${queryRun.id}: ${analysisError.message}`);
            analysisResult = {
                data: {
                    answerability: { text_contains_relevant_recommendations: true, reasoning: 'Fallback text extraction', needs_rephrase: false },
                    mentions: [],
                },
                usage: {},
                provider: aiOverrides.analysisCall?.provider || 'fallback',
                model: 'fallback',
            };
        }

        const normalizedAnalysis = normalizeGeoQueryAnalysis({
            ...analysisResult.data,
            query: query.query_text,
            response_text: aiResponse.text,
        });

        const extraction = buildExtractionArtifacts({
            queryText: query.query_text,
            responseText: aiResponse.text,
            analysis: normalizedAnalysis.data,
            clientName: client.client_name,
            clientDomain: client.website_url || null,
            competitorAliases,
            knownCompetitors,
        });

        const usageTokens = toUsageTotals(aiResponse.usage || {}, analysisResult.usage || {});
        const latencyMs = nowMs() - startedAtMs;
        const measurementOutcome = classifyMeasurementOutcome({
            discoveryMode,
            targetFound: extraction.targetDetection.target_found,
            runSignalTier: extraction.diagnostics.run_signal_tier,
            competitorCount: extraction.counts.competitors,
            totalMentioned: extraction.counts.total,
        });
        const parsedResponse = {
            label: 'Execution GEO - verite capturee complete',
            query: query.query_text,
            discovery_mode: discoveryMode,
            answer_generation_mode: promptPayloadRow?.answer_generation_mode || discoveryMode,
            context_injected: promptPayloadRow?.context_injected === true,
            business_context_used: promptPayloadRow?.business_context_used === true,
            source_grounded: promptPayloadRow?.source_grounded === true,
            sources_provided: promptPayloadRow?.sources_provided || [],
            bias_risk: promptPayloadRow?.bias_risk || null,
            evidence_level: promptPayloadRow?.evidence_level || normalizedAnalysis.data?.evidence_level || null,
            answer_type: promptPayloadRow?.answer_type || null,
            target_brand: promptPayloadRow?.target_brand || client.client_name || null,
            prompt_version: promptPayloadRow?.prompt_version || null,
            prompt_template_id: promptPayloadRow?.prompt_template_id || null,
            extraction_version: extractionVersion,
            visibility_eligible: isVisibilityEligible(discoveryMode),
            measurement_outcome: measurementOutcome,
            target_found: extraction.targetDetection.target_found,
            target_position: extraction.targetDetection.target_position,
            brand_mentioned: normalizedAnalysis.data?.brand_mentioned ?? extraction.targetDetection.target_found,
            brand_position: normalizedAnalysis.data?.brand_position ?? extraction.targetDetection.target_position ?? null,
            competitors_mentioned: normalizedAnalysis.data?.competitors_mentioned || [],
            urls_cited: normalizedAnalysis.data?.urls_cited || [],
            unsupported_claims: normalizedAnalysis.data?.unsupported_claims || [],
            uncertainty_flags: normalizedAnalysis.data?.uncertainty_flags || [],
            hallucination_risk: normalizedAnalysis.data?.hallucination_risk || null,
            total_businesses_mentioned: extraction.counts.total,
            parse_status: extraction.parseStatus,
            run_signal_tier: extraction.diagnostics.run_signal_tier,
            zero_citation_reason: extraction.diagnostics.zero_citation_reason,
            zero_competitor_reason: extraction.diagnostics.zero_competitor_reason,
            operator_reason_codes: extraction.diagnostics.operator_reason_codes || [],
        };
        const reviewContract = buildRunReviewContract({
            clientId: client.id,
            queryRunId: queryRun.id,
            trackedQueryId: query.id,
            queryText: query.query_text,
            createdAt: new Date().toISOString(),
            extraction,
        });

        parsedResponse.review_queue = reviewContract.review_queue;
        const promptMetadata = {
            discovery_mode: promptPayloadRow.discovery_mode,
            answer_generation_mode: promptPayloadRow.answer_generation_mode,
            context_injected: promptPayloadRow.context_injected,
            business_context_used: promptPayloadRow.business_context_used,
            source_grounded: promptPayloadRow.source_grounded,
            sources_provided: promptPayloadRow.sources_provided,
            bias_risk: promptPayloadRow.bias_risk,
            evidence_level: promptPayloadRow.evidence_level,
            answer_type: promptPayloadRow.answer_type,
            target_brand: promptPayloadRow.target_brand,
            prompt_version: promptPayloadRow.prompt_version,
            prompt_template_id: promptPayloadRow.prompt_template_id,
        };

        await db.updateQueryRun(queryRun.id, {
            provider: aiResponse.provider || 'unknown',
            model: aiResponse.model || 'unknown',
            locale,
            response_text: aiResponse.text,
            raw_response_full: aiResponse.text,
            target_found: extraction.targetDetection.target_found,
            target_position: extraction.targetDetection.target_position,
            total_mentioned: extraction.counts.total,
            prompt_payload: promptPayloadRow,
            raw_analysis: {
                prompt_metadata: promptMetadata,
                analysis_data: normalizedAnalysis.data,
                analysis_provider: analysisResult.provider || null,
                analysis_model: analysisResult.model || null,
                normalized_success: normalizedAnalysis.success === true,
                normalized_errors: normalizedAnalysis.errors || null,
                extraction_layers: {
                    literal: extraction.rawLayer,
                    parsed: extraction.parsedLayer,
                    normalized: extraction.normalizedLayer,
                    verified: extraction.verifiedLayer,
                },
                diagnostics: extraction.diagnostics,
                review_contract: reviewContract,
                truth_problems: reviewContract.problems,
                benchmark: {
                    sandbox_caveat: aiResponse.sandbox_caveat || null,
                    cost_estimate_usd: aiResponse.cost_estimate_usd,
                },
            },
            parsed_response: parsedResponse,
            normalized_response: {
                ...extraction.normalizedResponse,
                prompt_metadata: promptMetadata,
                operator_extraction: {
                    brand_mentioned: normalizedAnalysis.data?.brand_mentioned ?? extraction.targetDetection.target_found,
                    brand_position: normalizedAnalysis.data?.brand_position ?? extraction.targetDetection.target_position ?? null,
                    competitors_mentioned: normalizedAnalysis.data?.competitors_mentioned || [],
                    urls_cited: normalizedAnalysis.data?.urls_cited || [],
                    sentiment: normalizedAnalysis.data?.sentiment || 'neutral',
                    evidence_level: normalizedAnalysis.data?.evidence_level || promptPayloadRow?.evidence_level || 'none',
                    claims: normalizedAnalysis.data?.claims || [],
                    unsupported_claims: normalizedAnalysis.data?.unsupported_claims || [],
                    citations: normalizedAnalysis.data?.citations || [],
                    uncertainty_flags: normalizedAnalysis.data?.uncertainty_flags || [],
                    hallucination_risk: normalizedAnalysis.data?.hallucination_risk || null,
                },
                review_summary: reviewContract.summary,
            },
            parse_status: extraction.parseStatus,
            parse_warnings: extraction.parseWarnings,
            parse_confidence: extraction.parseConfidence,
            latency_ms: latencyMs,
            usage_tokens: usageTokens,
            error_class: null,
            extraction_version: extractionVersion,
            run_mode: runMode === 'benchmark' ? 'benchmark' : 'standard',
            engine_variant: engineVariant,
            benchmark_session_id: benchmarkSessionId,
            discovery_mode: discoveryMode,
            target_detection: extraction.targetDetection,
            status: analysisResult.model === 'fallback' ? 'partial' : 'completed',
        });

        const mentionRows = mapMentionsForInsert(queryRun.id, extraction.mentionRows);
        if (mentionRows.length > 0) {
            await db.createQueryMentions(mentionRows);
        } else {
            console.warn(`[runTrackedQueries] Run ${queryRun.id} (${engineVariant}) extracted 0 mentions. Source reason: ${extraction.diagnostics?.zero_citation_reason}, Competitor reason: ${extraction.diagnostics?.zero_competitor_reason}`);
        }

        return {
            queryId: query.id,
            query: query.query_text,
            runId: queryRun.id,
            variant: engineVariant,
            discoveryMode,
            answerGenerationMode: promptPayloadRow?.answer_generation_mode || discoveryMode,
            contextInjected: promptPayloadRow?.context_injected === true,
            biasRisk: promptPayloadRow?.bias_risk || null,
            evidenceLevel: promptPayloadRow?.evidence_level || null,
            visibilityEligible: isVisibilityEligible(discoveryMode),
            measurementOutcome,
            provider: aiResponse.provider,
            model: aiResponse.model,
            targetFound: extraction.targetDetection.target_found,
            targetPosition: extraction.targetDetection.target_position,
            totalMentioned: extraction.counts.total,
            citations: extraction.counts.sources,
            competitors: extraction.counts.competitors,
            parseStatus: extraction.parseStatus,
            parseConfidence: extraction.parseConfidence,
            latencyMs,
            costEstimateUsd: aiResponse.cost_estimate_usd,
        };
    } catch (queryError) {
        const message = queryError?.message || 'Execution run impossible';
        const latencyMs = nowMs() - startedAtMs;
        const errorClass = classifyRunError(message, engineVariant);

        if (queryRun?.id) {
            await db.updateQueryRun(queryRun.id, {
                provider: aiResponse?.provider || 'unknown',
                model: aiResponse?.model || 'unknown',
                response_text: aiResponse?.text || null,
                raw_response_full: aiResponse?.text || null,
                status: 'failed',
                error_class: errorClass,
                parse_status: 'parsed_failed',
                parse_warnings: [message],
                ...(promptPayloadRow ? { prompt_payload: promptPayloadRow } : {}),
                raw_analysis: {
                    error: message,
                    analysis_data: analysisResult?.data || null,
                },
                parsed_response: { error: message },
                normalized_response: {},
                latency_ms: latencyMs,
            });
        }

        return {
            queryId: query.id,
            query: query.query_text,
            runId: queryRun?.id || null,
            variant: engineVariant,
            error: message,
        };
    }
}

export async function runTrackedQueriesForClient({
    clientId,
    trackedQueryId = null,
    performedBy = null,
    actionTypeOverride = null,
    runMode = 'standard',
    benchmarkSessionId = null,
    benchmarkVariants = [],
}) {
    const mode = resolveRunMode(trackedQueryId, runMode);
    const client = await db.getClientById(clientId);

    const sourceQueries = trackedQueryId
        ? await db.getTrackedQueriesAll(clientId)
        : await db.getTrackedQueries(clientId, true);

    const queries = trackedQueryId
        ? sourceQueries.filter((query) => query.id === trackedQueryId)
        : sourceQueries;

    if (trackedQueryId && queries.length === 0) {
        return {
            notFound: true,
            message: 'Prompt suivi introuvable pour ce client.',
            runMode: mode,
            trackedQueryId,
            runs: [],
        };
    }

    if (queries.length === 0) {
        return {
            clientId,
            runMode: mode,
            trackedQueryId,
            totalQueries: 0,
            runs: [],
            message: 'Aucune requete active pour ce client.',
        };
    }

    const competitorAliases = await db.getCompetitorAliases(clientId).catch(() => []);
    const knownCompetitors = normalizeKnownCompetitors(client, competitorAliases);

    const businessContext = {
        name: client.client_name,
        description: getBusinessShortDescription(client.business_details) || client.seo_description || '',
        area: typeof client.address === 'object' ? (client.address?.city || client.address?.region || '') : '',
        services: client.business_details?.services || [],
        known_competitors: knownCompetitors.slice(0, 20),
    };

    const variants = runMode === 'benchmark'
        ? resolveRequestedBenchmarkVariants(benchmarkVariants)
        : [resolveClientGeoEngineVariant(client)];

    const maxRunsPerDay = resolveMaxGeoRunsPerClientPerDay();
    const isMistralVariant = variants.some((variant) => (ENGINE_VARIANTS[variant]?.provider === 'mistral'));
    let cappedQueries = queries;
    let capInfo = null;

    if (runMode !== 'benchmark' && isMistralVariant && maxRunsPerDay > 0) {
        const startOfDayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        const usedRunsToday = await db.countQueryRunsForClientSince(clientId, startOfDayIso).catch(() => 0);
        const remainingRuns = Math.max(0, maxRunsPerDay - usedRunsToday);
        const maxQueriesAllowed = Math.floor(remainingRuns / Math.max(variants.length, 1));
        cappedQueries = queries.slice(0, Math.max(0, maxQueriesAllowed));
        capInfo = {
            max_runs_per_day: maxRunsPerDay,
            used_runs_today: usedRunsToday,
            remaining_runs: remainingRuns,
        };
    }

    const runs = [];
    for (const query of cappedQueries) {
        const discoveryMode = resolveQueryDiscoveryMode(query, client.client_name);
        for (const variant of variants) {
            const run = await executeVariantForQuery({
                client,
                query,
                businessContext,
                knownCompetitors,
                competitorAliases,
                runMode: runMode === 'benchmark' ? 'benchmark' : 'standard',
                engineVariant: variant,
                benchmarkSessionId,
                discoveryMode,
            });
            runs.push(run);
        }
    }

    await db.logAction({
        client_id: clientId,
        action_type: actionTypeOverride || (trackedQueryId ? 'geo_query_run_single' : 'geo_queries_run'),
        details: {
            mode,
            run_mode: runMode === 'benchmark' ? 'benchmark' : 'standard',
            benchmark_session_id: benchmarkSessionId || null,
            variants,
            tracked_query_id: trackedQueryId || null,
            total_queries: cappedQueries.length,
            total_runs: runs.length,
            successful: runs.filter((run) => !run.error).length,
            ...(capInfo ? { cap_info: capInfo } : {}),
        },
        performed_by: performedBy || null,
    });

    return {
        clientId,
        runMode: mode,
        trackedQueryId: trackedQueryId || null,
        benchmarkSessionId: benchmarkSessionId || null,
        variants,
        totalQueries: cappedQueries.length,
        totalRuns: runs.length,
        ...(capInfo ? { capInfo } : {}),
        runs,
    };
}

export async function rerunStoredQueryRun({
    clientId,
    runId,
    performedBy = null,
}) {
    const run = await db.getQueryRunById(runId);
    if (!run || run.client_id !== clientId) {
        throw new Error('Execution introuvable pour ce client.');
    }
    if (!run.tracked_query_id) {
        throw new Error('Impossible de relancer ce run: aucun prompt suivi associe.');
    }

    return runTrackedQueriesForClient({
        clientId,
        trackedQueryId: run.tracked_query_id,
        performedBy,
        actionTypeOverride: 'geo_query_run_rerun',
    });
}

export async function reparseStoredQueryRun({
    clientId,
    runId,
    performedBy = null,
}) {
    const run = await db.getQueryRunById(runId);
    if (!run || run.client_id !== clientId) {
        throw new Error('Execution introuvable pour ce client.');
    }

    const responseText = run.raw_response_full || run.response_text || '';
    if (!responseText.trim()) {
        throw new Error('Aucune reponse brute disponible pour reparser ce run.');
    }

    const client = await db.getClientById(clientId);
    const competitorAliases = await db.getCompetitorAliases(clientId).catch(() => []);
    const knownCompetitors = normalizeKnownCompetitors(client, competitorAliases);
    const extraction = buildExtractionArtifacts({
        queryText: run.query_text,
        responseText,
        analysis: run.raw_analysis?.analysis_data || run.raw_analysis || {},
        clientName: client.client_name,
        clientDomain: client.website_url || null,
        competitorAliases,
        knownCompetitors,
    });
    const reviewContract = buildRunReviewContract({
        clientId,
        queryRunId: runId,
        trackedQueryId: run.tracked_query_id || null,
        queryText: run.query_text,
        createdAt: new Date().toISOString(),
        extraction,
    });

    await db.deleteQueryMentionsByRunId(runId);
    const mentionRows = mapMentionsForInsert(runId, extraction.mentionRows);
    if (mentionRows.length > 0) {
        await db.createQueryMentions(mentionRows);
    }

    await db.updateQueryRun(runId, {
        target_found: extraction.targetDetection.target_found,
        target_position: extraction.targetDetection.target_position,
        total_mentioned: extraction.counts.total,
        parse_status: extraction.parseStatus,
        parse_warnings: extraction.parseWarnings,
        parse_confidence: extraction.parseConfidence,
        extraction_version: extraction.extractionVersion,
        target_detection: extraction.targetDetection,
        parsed_response: {
            query: run.query_text,
            target_found: extraction.targetDetection.target_found,
            target_position: extraction.targetDetection.target_position,
            total_businesses_mentioned: extraction.counts.total,
            parse_status: extraction.parseStatus,
            reparsed_at: new Date().toISOString(),
            run_signal_tier: extraction.diagnostics.run_signal_tier,
            zero_citation_reason: extraction.diagnostics.zero_citation_reason,
            zero_competitor_reason: extraction.diagnostics.zero_competitor_reason,
            operator_reason_codes: extraction.diagnostics.operator_reason_codes || [],
        },
        raw_analysis: {
            ...(run.raw_analysis || {}),
            extraction_layers: {
                literal: extraction.rawLayer,
                parsed: extraction.parsedLayer,
                normalized: extraction.normalizedLayer,
                verified: extraction.verifiedLayer,
            },
            diagnostics: extraction.diagnostics,
            review_contract: reviewContract,
            truth_problems: reviewContract.problems,
        },
        normalized_response: {
            ...extraction.normalizedResponse,
            review_summary: reviewContract.summary,
        },
        status: run.status,
    });

    await db.logAction({
        client_id: clientId,
        action_type: 'geo_query_reparse',
        details: {
            run_id: runId,
            parse_status: extraction.parseStatus,
            mention_count: extraction.counts.total,
            source_count: extraction.counts.sources,
            competitor_count: extraction.counts.competitors,
        },
        performed_by: performedBy || null,
    });

    return {
        runId,
        parseStatus: extraction.parseStatus,
        parseWarnings: extraction.parseWarnings,
        counts: extraction.counts,
    };
}
