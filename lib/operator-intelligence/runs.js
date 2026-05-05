import 'server-only';

import * as db from '@/lib/db';
import { getDiscoveryModeMeta, getTrackedQueryCategoryMeta, isVisibilityEligible } from '@/lib/operator-intelligence/prompt-taxonomy';
import { getProvenanceMeta } from '@/lib/operator-intelligence/provenance';
import { createRunStatusCounts, normalizeRunParseStatus } from '@/lib/operator-intelligence/run-lifecycle';
import { getAdminSupabase } from '@/lib/supabase-admin';

function buildGroupedMentions(mentions = []) {
    const targetMentions = [];
    const competitorMentions = [];
    const nonTargetMentions = [];
    const sourceMentions = [];

    for (const mention of mentions || []) {
        const type = mention.entity_type || 'business';
        if (type === 'source') {
            sourceMentions.push(mention);
            continue;
        }
        if (type === 'competitor') {
            competitorMentions.push(mention);
            continue;
        }
        if (mention.is_target === true) {
            targetMentions.push(mention);
            continue;
        }
        nonTargetMentions.push(mention);
    }

    return {
        targetMentions,
        competitorMentions,
        nonTargetMentions,
        sourceMentions,
    };
}

function buildRunSummary(run, trackedQuery, mentions = []) {
    const grouped = buildGroupedMentions(mentions);
    const queryText = run.query_text || trackedQuery?.query_text || 'Prompt suivi';
    const parseStatus = normalizeRunParseStatus(run);
    const discoveryMode = run.discovery_mode || run.parsed_response?.discovery_mode || trackedQuery?.discovery_mode || 'brand_aware';
    const promptMetadata = run.parsed_response || run.prompt_payload || {};
    const discoveryModeMeta = getDiscoveryModeMeta(discoveryMode);
    return {
        id: run.id,
        tracked_query_id: run.tracked_query_id,
        query_text: queryText,
        category: getTrackedQueryCategoryMeta(trackedQuery?.category || trackedQuery?.query_type, queryText).label,
        provider: run.provider,
        model: run.model,
        run_mode: run.run_mode || 'standard',
        engine_variant: run.engine_variant || 'tavily_orchestrated',
        discovery_mode: discoveryMode,
        discovery_mode_label: discoveryModeMeta.label,
        answer_generation_mode: promptMetadata.answer_generation_mode || discoveryMode,
        context_injected: promptMetadata.context_injected === true || discoveryModeMeta.bias_risk === 'context_injected',
        source_grounded: promptMetadata.source_grounded === true || discoveryModeMeta.bias_risk === 'source_grounded',
        evidence_level: promptMetadata.evidence_level || discoveryModeMeta.evidence_level,
        bias_risk: promptMetadata.bias_risk || discoveryModeMeta.bias_risk,
        answer_type: promptMetadata.answer_type || discoveryModeMeta.answer_type,
        prompt_version: promptMetadata.prompt_version || run.prompt_payload?.prompt_version || null,
        prompt_template_id: promptMetadata.prompt_template_id || run.prompt_payload?.prompt_template_id || null,
        visibility_eligible: isVisibilityEligible(discoveryMode),
        status: run.status,
        parse_status: parseStatus,
        parse_confidence: run.parse_confidence ?? null,
        latency_ms: run.latency_ms ?? null,
        target_found: run.target_found === true,
        target_position: run.target_position ?? null,
        total_mentioned: run.total_mentioned ?? 0,
        created_at: run.created_at,
        mention_counts: {
            target: grouped.targetMentions.length,
            competitors: grouped.competitorMentions.length,
            non_target: grouped.nonTargetMentions.length,
            sources: grouped.sourceMentions.length,
        },
        run_signal_tier: run.parsed_response?.run_signal_tier || run.raw_analysis?.diagnostics?.run_signal_tier || null,
        source_hosts_preview: [...new Set(grouped.sourceMentions.map((item) => item.normalized_domain || item.business_name).filter(Boolean))].slice(0, 4),
    };
}

export async function getRunsSlice(clientId) {
    const supabase = getAdminSupabase();
    const [runs, trackedQueries] = await Promise.all([
        db.getQueryRunsHistory(clientId, 250),
        db.getTrackedQueriesAll(clientId),
    ]);

    const runIds = (runs || []).map((run) => run.id);
    let mentionRows = [];
    if (runIds.length > 0) {
        const { data, error } = await supabase
            .from('query_mentions')
            .select('query_run_id, business_name, entity_type, is_target, position, mention_kind, normalized_domain, confidence')
            .in('query_run_id', runIds);
        if (error) throw new Error(`[OperatorIntelligence/runs] mentions: ${error.message}`);
        mentionRows = data || [];
    }

    const mentionsByRunId = new Map();
    for (const mention of mentionRows) {
        if (!mentionsByRunId.has(mention.query_run_id)) mentionsByRunId.set(mention.query_run_id, []);
        mentionsByRunId.get(mention.query_run_id).push(mention);
    }

    const trackedQueriesById = new Map((trackedQueries || []).map((query) => [query.id, query]));
    const latestByPrompt = new Map();
    const statusCounts = createRunStatusCounts();
    const parseCounts = { parsed_success: 0, parsed_partial: 0, parsed_failed: 0 };
    const providerCounts = new Map();

    const history = (runs || []).map((run) => {
        const parseStatus = normalizeRunParseStatus(run);
        if (statusCounts[run.status] !== undefined) {
            statusCounts[run.status] += 1;
        }
        if (parseStatus && parseCounts[parseStatus] !== undefined) {
            parseCounts[parseStatus] += 1;
        }

        const providerKey = `${run.provider || 'unknown'} · ${run.model || 'unknown'}`;
        providerCounts.set(providerKey, (providerCounts.get(providerKey) || 0) + 1);

        if (run.tracked_query_id && !latestByPrompt.has(run.tracked_query_id)) {
            latestByPrompt.set(run.tracked_query_id, run);
        }

        return buildRunSummary(run, trackedQueriesById.get(run.tracked_query_id), mentionsByRunId.get(run.id) || []);
    });

    const latestPerPrompt = (trackedQueries || []).map((query) => {
        const run = latestByPrompt.get(query.id) || null;
        return {
            id: query.id,
            query_text: query.query_text,
            category: getTrackedQueryCategoryMeta(query.category || query.query_type, query.query_text).label,
            locale: query.locale || 'fr-CA',
            is_active: query.is_active !== false,
            latest_run: run ? buildRunSummary(run, query, mentionsByRunId.get(run.id) || []) : null,
        };
    });

    return {
        provenance: {
            observation: getProvenanceMeta('observed'),
            summary: getProvenanceMeta('derived'),
        },
        summary: {
            total: history.length,
            statusCounts,
            parseCounts,
            topProvidersModels: [...providerCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([label, count]) => ({ label, count })),
        },
        latestPerPrompt,
        history,
        emptyState: {
            noRuns: {
                title: 'Aucune execution pour le moment',
                description: 'Lancez les prompts suivis pour generer des observations de visibilite, citations et concurrents.',
            },
        },
    };
}

import { ENGINE_VARIANTS } from '@/lib/queries/engine-variants';

export async function getRunInspectorSlice(clientId, runId) {
    const run = await db.getQueryRunById(runId);
    if (!run || run.client_id !== clientId) {
        throw new Error('Execution introuvable pour ce client.');
    }

    const mentions = await db.getQueryRunMentions(runId);
    const grouped = buildGroupedMentions(mentions);
    const diagnostics = {
        ...(run.raw_analysis?.diagnostics || {}),
    };
    const parseWarnings = Array.isArray(run.parse_warnings) ? run.parse_warnings : [];

    const engineVariant = run.engine_variant || 'tavily_orchestrated';
    const variantMeta = ENGINE_VARIANTS[engineVariant] || {};

    const promptPayload = run.prompt_payload && typeof run.prompt_payload === 'object' && Object.keys(run.prompt_payload).length > 0
        ? run.prompt_payload
        : (run.raw_analysis?.prompt_payload || {});
    const discoveryMode = run.discovery_mode || run.parsed_response?.discovery_mode || promptPayload.discovery_mode || 'brand_aware';
    const promptMetadata = run.parsed_response || promptPayload || {};
    const discoveryModeMeta = getDiscoveryModeMeta(discoveryMode);
    const reviewContract = run.raw_analysis?.review_contract || {
        problems: Array.isArray(run.raw_analysis?.truth_problems) ? run.raw_analysis.truth_problems : [],
        summary: run.normalized_response?.review_summary || null,
        review_queue: run.parsed_response?.review_queue || [],
    };

    return {
        provenance: {
            observation: getProvenanceMeta('observed'),
            summary: getProvenanceMeta('derived'),
        },
        run: {
            id: run.id,
            query_text: run.query_text || run.tracked_queries?.query_text || 'Prompt suivi',
            provider: run.provider,
            model: run.model,
            status: run.status,
            run_mode: run.run_mode || 'standard',
            engine_variant: engineVariant,
            engine_variant_label: variantMeta.label || engineVariant,
            web_enabled: variantMeta.web_enabled ?? false,
            discovery_mode: discoveryMode,
            discovery_mode_label: discoveryModeMeta.label,
            answer_generation_mode: promptMetadata.answer_generation_mode || promptPayload.answer_generation_mode || discoveryMode,
            context_injected: promptMetadata.context_injected === true || promptPayload.context_injected === true || discoveryModeMeta.bias_risk === 'context_injected',
            business_context_used: promptMetadata.business_context_used === true || promptPayload.business_context_used === true || discoveryModeMeta.bias_risk === 'context_injected',
            source_grounded: promptMetadata.source_grounded === true || promptPayload.source_grounded === true || discoveryModeMeta.bias_risk === 'source_grounded',
            evidence_level: promptMetadata.evidence_level || promptPayload.evidence_level || discoveryModeMeta.evidence_level,
            bias_risk: promptMetadata.bias_risk || promptPayload.bias_risk || discoveryModeMeta.bias_risk,
            answer_type: promptMetadata.answer_type || promptPayload.answer_type || discoveryModeMeta.answer_type,
            prompt_version: promptMetadata.prompt_version || promptPayload.prompt_version || null,
            prompt_template_id: promptMetadata.prompt_template_id || promptPayload.prompt_template_id || null,
            sources_provided: promptMetadata.sources_provided || promptPayload.sources_provided || [],
            visibility_eligible: isVisibilityEligible(discoveryMode),
            locale: run.locale || run.tracked_queries?.locale || 'fr-CA',
            created_at: run.created_at,
            target_found: run.target_found === true,
            target_position: run.target_position ?? null,
            total_mentioned: run.total_mentioned ?? 0,
            parse_status: normalizeRunParseStatus(run),
            parse_confidence: run.parse_confidence ?? null,
            parse_warnings: parseWarnings,
            latency_ms: run.latency_ms ?? null,
            usage_tokens: run.usage_tokens || {},
            error_class: run.error_class || null,
            retry_count: run.retry_count ?? 0,
            extraction_version: run.extraction_version || 'v2',
            prompt_payload: promptPayload,
            raw_response_full: run.raw_response_full || run.response_text || '',
            normalized_response: run.normalized_response || {},
            parsed_response: run.parsed_response || {},
            target_detection: run.target_detection || {},
            review_summary: reviewContract.summary || null,
        },
        citations: grouped.sourceMentions.map((mention) => ({
            host: mention.normalized_domain || mention.business_name,
            mentioned_url: mention.mentioned_url || null,
            source_type: mention.source_type || null,
            confidence: mention.source_confidence ?? mention.confidence ?? null,
            mention_kind: mention.mention_kind || 'mentioned',
            verified_status: mention.verified_status || 'mentioned',
            evidence_span: mention.source_evidence_span || mention.evidence_span || mention.context || null,
        })),
        competitors: grouped.competitorMentions.map((mention) => ({
            name: mention.normalized_label || mention.business_name,
            confidence: mention.confidence ?? null,
            mention_kind: mention.mention_kind || 'mentioned',
            first_position: mention.first_position ?? mention.position ?? null,
            recommendation_strength: mention.recommendation_strength || null,
            co_occurs_with_target: mention.co_occurs_with_target === true,
            evidence_span: mention.evidence_span || mention.context || null,
        })),
        businesses: grouped.targetMentions.map((mention) => ({
            name: mention.normalized_label || mention.business_name,
            position: mention.position ?? null,
            confidence: mention.confidence ?? null,
            is_target: mention.is_target === true,
            evidence_span: mention.evidence_span || mention.context || null,
        })),
        nonTargets: grouped.nonTargetMentions.map((mention) => ({
            name: mention.normalized_label || mention.business_name,
            position: mention.position ?? null,
            confidence: mention.confidence ?? null,
            evidence_span: mention.evidence_span || mention.context || null,
        })),
        diagnostics: {
            zero_citation_reason: diagnostics.zero_citation_reason || (grouped.sourceMentions.length === 0 ? 'no_source_detected' : null),
            zero_competitor_reason: diagnostics.zero_competitor_reason || (grouped.competitorMentions.length === 0 ? 'no_competitor_detected' : null),
            run_signal_tier: diagnostics.run_signal_tier || run.parsed_response?.run_signal_tier || null,
            evidence_level: promptMetadata.evidence_level || promptPayload.evidence_level || discoveryModeMeta.evidence_level,
            insufficient_evidence: grouped.sourceMentions.length === 0 && ['none', 'weak'].includes(promptMetadata.evidence_level || promptPayload.evidence_level || discoveryModeMeta.evidence_level),
            operator_reason_codes: Array.isArray(diagnostics.operator_reason_codes) ? diagnostics.operator_reason_codes : (run.parsed_response?.operator_reason_codes || []),
            entity_breakdown: diagnostics.entity_breakdown || null,
        },
        review: reviewContract,
    };
}
