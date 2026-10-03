import 'server-only';

import {
    TRUTH_ENGINE_VERSION,
    defaultReviewStatusForTruthClass,
    normalizeConfidenceBand,
    normalizeReviewStatus,
    normalizeTruthClass,
    slugifyTruthKey,
} from '@/lib/truth/definitions';

const PROBLEM_TYPE_META = {
    missing_faq_for_intent: {
        title: 'FAQ structuree insuffisante pour l’intention',
        description: 'Le run suggere que la reponse manque de support FAQ structure pour cette intention.',
        family: 'content',
        impact: 'answerability',
        surface: 'query_run',
        truth_class: 'inferred',
    },
    target_never_found: {
        title: 'Cible jamais trouvee sur la requete',
        description: 'La cible n’est pas retrouvee de maniere fiable sur une serie de runs consecutifs.',
        family: 'query_coverage',
        impact: 'recommendability',
        surface: 'query_set',
        truth_class: 'observed',
    },
    weak_local_clarity: {
        title: 'Clarte locale insuffisante',
        description: 'Le run signale une clarte locale trop faible dans la reponse ou le positionnement.',
        family: 'locality',
        impact: 'recommendability',
        surface: 'query_run',
        truth_class: 'inferred',
    },
    schema_missing_or_incoherent: {
        title: 'Schema manquant ou incoherent',
        description: 'Le run remonte un signal schema.org faible ou incoherent.',
        family: 'schema',
        impact: 'discoverability',
        surface: 'site',
        truth_class: 'inferred',
    },
    job_audit_flaky: {
        title: 'Job audit instable',
        description: 'Le job de rafraichissement audit presente des echecs ou retries repetes.',
        family: 'operations',
        impact: 'operability',
        surface: 'continuous_job',
        truth_class: 'observed',
    },
    job_prompt_rerun_inactive: {
        title: 'Job prompts inactif ou stale',
        description: 'Le job de rerun des prompts est inactif ou trop ancien.',
        family: 'operations',
        impact: 'operability',
        surface: 'continuous_job',
        truth_class: 'observed',
    },
    visibility_declining: {
        title: 'Visibilite en baisse',
        description: 'Le centre d’action signale une degradation recente de la visibilite.',
        family: 'operations',
        impact: 'operability',
        surface: 'query_set',
        truth_class: 'derived',
    },
    ai_crawlers_blocked: {
        title: 'Crawlers IA bloques',
        description: 'Des crawlers IA critiques sont bloques et reduisent la visibilite answer-engine.',
        family: 'content',
        impact: 'answerability',
        surface: 'site',
        truth_class: 'observed',
    },
    llms_txt_missing: {
        title: 'llms.txt manquant',
        description: 'Le site ne publie pas encore de fichier llms.txt exploitable.',
        family: 'content',
        impact: 'answerability',
        surface: 'site',
        truth_class: 'observed',
    },
};

function getProblemMeta(type) {
    return PROBLEM_TYPE_META[type] || {
        title: 'Element a revoir',
        description: 'Un element operateur demande une verification humaine.',
        family: 'operations',
        impact: 'operability',
        surface: 'site',
        truth_class: 'uncertain',
    };
}

function buildDedupeKey(parts = []) {
    return slugifyTruthKey(parts.filter(Boolean).join('_')) || 'review_item';
}

function buildStatusFromReviewStatus(reviewStatus) {
    if (reviewStatus === 'reviewed_confirmed') return 'resolved';
    if (reviewStatus === 'reviewed_rejected') return 'ignored';
    return 'open';
}

function mapOpportunitySourceToTruthClass(source) {
    if (source === 'observed') return 'observed';
    if (source === 'inferred') return 'inferred';
    if (source === 'recommended') return 'recommended';
    return 'uncertain';
}

function mapRemediationStatusToReviewStatus(status) {
    if (status === 'approved' || status === 'applied') return 'reviewed_confirmed';
    if (status === 'discarded') return 'reviewed_rejected';
    return 'needs_review';
}

function mapOpportunityStatusToReviewStatus(status, truthClass) {
    if (status === 'done') return 'reviewed_confirmed';
    if (status === 'dismissed') return 'reviewed_rejected';
    return defaultReviewStatusForTruthClass(truthClass);
}

function mapMergeStatusToReviewStatus(status) {
    if (status === 'applied') return 'reviewed_confirmed';
    if (status === 'rejected') return 'reviewed_rejected';
    return 'needs_review';
}

export function normalizeProblemForReview(problem = {}, context = {}) {
    const meta = getProblemMeta(problem.type);
    const truthClass = normalizeTruthClass(problem.truth_class || meta.truth_class, meta.truth_class);
    const confidence = normalizeConfidenceBand(problem.confidence, truthClass === 'observed' ? 'high' : 'medium');
    const reviewStatus = normalizeReviewStatus(problem.review_status, defaultReviewStatusForTruthClass(truthClass));
    const queryRunId = context.queryRunId || problem.context?.query_run_id || problem.affected_entity?.query_run_id || null;
    const trackedQueryId = context.trackedQueryId || problem.context?.tracked_query_id || problem.affected_entity?.tracked_query_id || null;
    const auditId = context.auditId || problem.context?.audit_id || problem.affected_entity?.audit_id || null;
    const sourceType = context.sourceType || (problem.source === 'geo_runs' ? 'query_run_diagnostic' : problem.source === 'audit' ? 'audit_rule' : 'operator_signal');
    const sourceTable = context.sourceTable || (problem.source === 'geo_runs' ? 'query_runs' : problem.source === 'audit' ? 'client_site_audits' : 'operator_review');
    const title = problem.title || meta.title;
    const description = problem.description || meta.description;
    const evidenceSummary = problem.evidence_summary || problem.context?.evidence_summary || '';
    const recommendedFix = problem.recommended_fix || problem.context?.recommended_fix || '';
    const dedupeKey = problem.dedupe_key || buildDedupeKey([
        'problem',
        problem.type,
        trackedQueryId,
        queryRunId,
        auditId,
        context.clientId || problem.clientId,
    ]);

    return {
        id: problem.id,
        item_type: 'problem',
        type: problem.type,
        title,
        description,
        family: problem.family || meta.family,
        severity: problem.severity || 'medium',
        impact: problem.impact || meta.impact,
        surface: problem.surface || meta.surface,
        truth_class: truthClass,
        confidence,
        review_status: reviewStatus,
        provenance: truthClass,
        provenance_entries: [
            {
                source_type: sourceType,
                source_table: sourceTable,
                truth_class: truthClass,
                confidence,
                query_run_id: queryRunId,
                tracked_query_id: trackedQueryId,
                audit_id: auditId,
            },
        ],
        evidence_summary: evidenceSummary,
        recommended_fix: recommendedFix,
        dedupe_key: dedupeKey,
        status: problem.status || buildStatusFromReviewStatus(reviewStatus),
        created_at: context.createdAt || problem.detectedAt || problem.created_at || new Date().toISOString(),
        affected_entity: {
            entity_type: context.entityType || meta.surface,
            client_id: context.clientId || problem.clientId || problem.affected_entity?.client_id || null,
            query_run_id: queryRunId,
            tracked_query_id: trackedQueryId,
            audit_id: auditId,
            source_url: context.sourceUrl || problem.affected_entity?.source_url || null,
        },
        metadata: {
            truth_engine_version: TRUTH_ENGINE_VERSION,
            source: problem.source || context.source || null,
            query_text: context.queryText || problem.context?.query_text || null,
        },
    };
}

export function normalizeOpportunityReviewItem(row = {}) {
    const truthClass = normalizeTruthClass(row.truth_class || mapOpportunitySourceToTruthClass(row.source), 'uncertain');
    const confidence = normalizeConfidenceBand(row.confidence, row.priority === 'high' ? 'high' : row.priority === 'low' ? 'low' : 'medium');
    const reviewStatus = normalizeReviewStatus(row.review_status, mapOpportunityStatusToReviewStatus(row.status, truthClass));

    return {
        id: row.id,
        item_type: 'opportunity',
        type: row.type || `opportunity_${slugifyTruthKey(row.category || 'general')}`,
        title: row.title || 'Opportunite',
        description: row.description || row.title || 'Opportunite operateur',
        family: row.family || row.category || 'operations',
        severity: row.priority || 'medium',
        impact: row.impact || 'operability',
        surface: row.surface || 'site',
        truth_class: truthClass,
        confidence,
        review_status: reviewStatus,
        provenance: truthClass,
        provenance_entries: [
            {
                source_type: 'opportunity_row',
                source_table: 'opportunities',
                truth_class: truthClass,
                confidence,
                audit_id: row.audit_id || null,
            },
        ],
        evidence_summary: row.evidence_summary || '',
        recommended_fix: row.recommended_fix || '',
        dedupe_key: row.dedupe_key || buildDedupeKey(['opportunity', row.category, row.source, row.title]),
        status: row.status || 'open',
        created_at: row.created_at || new Date().toISOString(),
        affected_entity: {
            entity_type: 'site',
            client_id: row.client_id || null,
            audit_id: row.audit_id || null,
        },
        metadata: {
            truth_engine_version: TRUTH_ENGINE_VERSION,
            source: row.source || null,
        },
    };
}

export function normalizeMergeSuggestionReviewItem(row = {}) {
    const truthClass = normalizeTruthClass(mapOpportunitySourceToTruthClass(row.source), 'inferred');
    const confidence = normalizeConfidenceBand(row.confidence, 'medium');
    const reviewStatus = normalizeReviewStatus(row.review_status, mapMergeStatusToReviewStatus(row.status));

    return {
        id: row.id,
        item_type: 'merge_suggestion',
        type: `merge_${slugifyTruthKey(row.field_name || 'field')}`,
        title: `Fusion suggeree: ${row.field_name || 'champ'}`,
        description: row.rationale || `Suggestion de mise a jour pour ${row.field_name || 'ce champ'}.`,
        family: 'identity',
        severity: confidence === 'high' ? 'high' : confidence === 'low' ? 'low' : 'medium',
        impact: 'operability',
        surface: 'profile',
        truth_class: truthClass,
        confidence,
        review_status: reviewStatus,
        provenance: truthClass,
        provenance_entries: [
            {
                source_type: 'merge_suggestion',
                source_table: 'merge_suggestions',
                truth_class: truthClass,
                confidence,
                audit_id: row.audit_id || null,
                field_name: row.field_name || null,
            },
        ],
        evidence_summary: row.current_value ? `Valeur actuelle: ${String(row.current_value).slice(0, 200)}` : '',
        recommended_fix: row.rationale || '',
        dedupe_key: buildDedupeKey(['merge', row.field_name, row.audit_id, row.client_id]),
        status: row.status || 'pending',
        created_at: row.created_at || new Date().toISOString(),
        affected_entity: {
            entity_type: 'profile',
            client_id: row.client_id || null,
            audit_id: row.audit_id || null,
        },
        metadata: {
            truth_engine_version: TRUTH_ENGINE_VERSION,
            source: row.source || null,
            field_name: row.field_name || null,
            suggested_value: row.suggested_value || null,
        },
    };
}

export function normalizeRemediationSuggestionReviewItem(row = {}) {
    const meta = getProblemMeta(row.problem_type);
    const truthClass = normalizeTruthClass('recommended', 'recommended');
    const reviewStatus = normalizeReviewStatus(row.review_status, mapRemediationStatusToReviewStatus(row.status));

    return {
        id: row.id,
        item_type: 'remediation_suggestion',
        type: row.problem_type || 'remediation_suggestion',
        title: meta.title,
        description: meta.description,
        family: meta.family,
        severity: row.severity || 'medium',
        impact: meta.impact,
        surface: meta.surface,
        truth_class: truthClass,
        confidence: normalizeConfidenceBand(row.confidence, 'medium'),
        review_status: reviewStatus,
        provenance: truthClass,
        provenance_entries: [
            {
                source_type: 'remediation_suggestion',
                source_table: 'remediation_suggestions',
                truth_class: truthClass,
                confidence: 'medium',
                problem_type: row.problem_type || null,
            },
        ],
        evidence_summary: '',
        recommended_fix: row.ai_output || '',
        dedupe_key: buildDedupeKey(['remediation', row.problem_type, row.client_id]),
        status: row.status || 'draft',
        created_at: row.created_at || new Date().toISOString(),
        affected_entity: {
            entity_type: meta.surface,
            client_id: row.client_id || null,
            audit_id: null,
        },
        metadata: {
            truth_engine_version: TRUTH_ENGINE_VERSION,
            problem_source: row.problem_source || null,
        },
    };
}
