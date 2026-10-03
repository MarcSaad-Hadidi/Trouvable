import crypto from 'node:crypto';

import {
    TRUTH_ENGINE_VERSION,
    defaultReviewStatusForTruthClass,
    normalizeConfidenceBand,
    normalizeReviewStatus,
    normalizeTruthClass,
    slugifyTruthKey,
    uniqueTruthyStrings,
} from './definitions';

const DIMENSION_TO_FAMILY = {
    technical_seo: 'technical_seo',
    local_readiness: 'locality',
    ai_answerability: 'content',
    trust_signals: 'trust',
    identity_completeness: 'identity',
};

const CATEGORY_TO_IMPACT = {
    technical: 'discoverability',
    geo: 'recommendability',
    content: 'answerability',
    trust: 'credibility',
    seo: 'conversion',
};

const DIMENSION_TO_SURFACE = {
    technical_seo: 'site',
    local_readiness: 'profile',
    ai_answerability: 'site',
    trust_signals: 'site',
    identity_completeness: 'profile',
};

function normalizeSeverity(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'critical') return 'critical';
    if (normalized === 'high') return 'high';
    if (normalized === 'low') return 'low';
    return 'medium';
}

function determineTruthClass(issue = {}) {
    const explicit = normalizeTruthClass(issue.truth_class || issue.provenance, 'uncertain');
    if (issue.evidence_status === 'weak_evidence' && explicit === 'observed') return 'uncertain';
    return explicit;
}

function determineConfidence(issue = {}, truthClass = 'uncertain') {
    if (issue.confidence !== null && issue.confidence !== undefined) return normalizeConfidenceBand(issue.confidence);
    if (truthClass === 'observed') return issue.evidence_status === 'weak_evidence' ? 'medium' : 'high';
    if (truthClass === 'derived') return 'medium';
    if (truthClass === 'inferred') return 'medium';
    if (truthClass === 'recommended') return 'medium';
    return 'low';
}

function determineFixability(issue = {}, truthClass = 'uncertain') {
    if (truthClass === 'uncertain') return 'operator_only';
    const haystack = `${issue?.title || ''} ${issue?.description || ''} ${issue?.recommended_fix || ''}`.toLowerCase();
    if (/https|title|description|canonical|faq|schema|contact|email|phone|social/.test(haystack)) return 'quick_win';
    if (/crawl|hydration|render|routing|service-area|service area|landing/.test(haystack)) return 'heavy_lift';
    if (!issue?.recommended_fix) return 'non_actionable';
    return 'standard';
}

function buildEvidence(issue = {}) {
    const evidence = [];
    if (issue.evidence_summary) {
        evidence.push({
            summary: issue.evidence_summary,
            status: issue.evidence_status || 'detected',
        });
    }
    return evidence;
}

function buildProvenanceEntries(issue = {}, truthClass = 'uncertain', confidence = 'medium', context = {}) {
    const entries = [
        {
            source_type: 'audit_rule',
            source_table: 'client_site_audits',
            truth_class: truthClass,
            confidence,
            category: issue.category || null,
            dimension: issue.dimension || null,
            audit_id: context.auditId || null,
            source_url: context.sourceUrl || null,
        },
    ];

    if (issue.evidence_summary) {
        entries.push({
            source_type: 'audit_evidence',
            truth_class: truthClass,
            confidence,
            summary: issue.evidence_summary,
            status: issue.evidence_status || 'detected',
        });
    }

    return entries;
}

function buildType(issue = {}) {
    const base = slugifyTruthKey(`${issue.dimension || issue.category || 'audit'}_${issue.title || issue.description || 'issue'}`);
    return base || 'audit_issue';
}

function buildDedupeKey({ family, type, surface, title }) {
    return slugifyTruthKey([family, type, surface, title].filter(Boolean).join('_')) || 'problem';
}

function buildStableId({ auditId, dedupeKey, title }) {
    const raw = `${auditId || 'no-audit'}:${dedupeKey}:${title || 'problem'}`;
    return `problem_${crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12)}`;
}

export function normalizeAuditProblem(issue = {}, context = {}) {
    const truthClass = determineTruthClass(issue);
    const confidence = determineConfidence(issue, truthClass);
    const family = DIMENSION_TO_FAMILY[issue.dimension] || 'operations';
    const surface = DIMENSION_TO_SURFACE[issue.dimension] || 'site';
    const impact = CATEGORY_TO_IMPACT[issue.category] || 'operability';
    const type = buildType(issue);
    const title = issue.title || issue.description || 'Point a corriger';
    const severity = normalizeSeverity(issue.severity || issue.priority);
    const reviewStatus = normalizeReviewStatus(issue.review_status, defaultReviewStatusForTruthClass(truthClass));
    const dedupeKey = buildDedupeKey({ family, type, surface, title });

    return {
        id: issue.id || buildStableId({ auditId: context.auditId, dedupeKey, title }),
        title,
        description: issue.description || issue.title || 'Point a corriger',
        type,
        family,
        severity,
        priority: issue.priority || severity,
        impact,
        surface,
        truth_class: truthClass,
        confidence,
        review_status: reviewStatus,
        provenance: truthClass,
        provenance_entries: buildProvenanceEntries(issue, truthClass, confidence, context),
        evidence: buildEvidence(issue),
        evidence_status: issue.evidence_status || null,
        evidence_summary: issue.evidence_summary || '',
        recommended_fix: issue.recommended_fix || '',
        recommended_fixability: determineFixability(issue, truthClass),
        affected_entity: {
            entity_type: 'site',
            client_id: context.clientId || null,
            audit_id: context.auditId || null,
            source_url: context.sourceUrl || null,
        },
        affected_scope: issue.dimension || issue.category || 'sitewide',
        dedupe_key: dedupeKey,
        category: issue.category || 'seo',
        dimension: issue.dimension || null,
        metadata: {
            truth_engine_version: TRUTH_ENGINE_VERSION,
            legacy_provenance: issue.provenance || null,
            legacy_severity: issue.severity || null,
            legacy_priority: issue.priority || null,
            evidence_tokens: uniqueTruthyStrings([issue.evidence_summary]).length,
        },
    };
}

export function normalizeAuditProblems(issues = [], context = {}) {
    return (Array.isArray(issues) ? issues : []).map((issue) => normalizeAuditProblem(issue, context));
}