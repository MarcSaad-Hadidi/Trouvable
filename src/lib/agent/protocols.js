/**
 * AGENT advanced protocols — Phase 3.
 *
 * Pure derivation module. No IO. Consumes the last `client_site_audits` row
 * (`extracted_data`) and produces a report with 4 protocol dimensions and a
 * global protocols score (0–100). Score is NEVER persisted — computed on read.
 *
 * Dimension weights (sum = 1.0):
 *   llms_txt         0.35   — canonical AI content manifest
 *   ai_discovery     0.20   — /.well-known/ai.txt + ai/*.json endpoints
 *   schema_entity    0.25   — Organization / LocalBusiness / FAQ schema
 *   crawler_access   0.20   — robots.txt posture for AI crawlers
 *
 * Guardrail: without at least one observed signal (llms.txt found, any AI
 * discovery endpoint responding, any schema detected, or crawler_access data
 * available) the global score is capped at 40 so declared-but-unverified
 * protocol posture cannot inflate the bonus.
 */

export const PROTOCOL_DIMENSION_WEIGHTS = Object.freeze({
    llms_txt: 0.35,
    ai_discovery: 0.20,
    schema_entity: 0.25,
    crawler_access: 0.20,
});

const DIMENSION_LABELS = Object.freeze({
    llms_txt: 'llms.txt',
    ai_discovery: 'AI discovery endpoints',
    schema_entity: 'Schéma d’entité',
    crawler_access: 'Accès crawler IA',
});

const FRESHNESS_CALCULATED_HOURS = 24 * 60; // ≤ 60j
const FRESHNESS_STALE_HOURS = 24 * 180;    // ≤ 180j

function clamp(value, min = 0, max = 100) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function hoursSince(iso) {
    if (!iso) return null;
    const parsed = new Date(iso).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.floor((Date.now() - parsed) / 3600000);
}

function deriveReliability(audit) {
    if (!audit || !audit.created_at) return 'unavailable';
    const hours = hoursSince(audit.created_at);
    if (hours === null) return 'unavailable';
    if (hours <= FRESHNESS_CALCULATED_HOURS) return 'calculated';
    if (hours <= FRESHNESS_STALE_HOURS) return 'stale';
    return 'low';
}

function deriveDimensionStatus(score) {
    if (!Number.isFinite(score)) return 'absent';
    if (score >= 70) return 'couvert';
    if (score >= 40) return 'partiel';
    if (score > 0) return 'faible';
    return 'absent';
}

function readLayered(audit) {
    return audit?.extracted_data?.layered_v1 || null;
}

function readExpert(audit) {
    return readLayered(audit)?.site_level_expert || null;
}

// ──────────────────────────────────────────────────────────────
// Dimension: llms.txt
// ──────────────────────────────────────────────────────────────

function buildLlmsTxtDimension({ expert }) {
    const deep = expert?.llms_txt_deep || null;
    const evidence = [];
    const gaps = [];
    let observed = false;
    let score = 0;

    if (deep?.details?.found) {
        observed = true;
        score = clamp(Number(deep?.score) || 0);
        const sections = deep.details.sections_detected || {};
        const sectionCount = Object.values(sections).filter(Boolean).length;
        evidence.push(`llms.txt détecté (${deep.details.h2_count || 0} sections, ${deep.details.internal_links || 0} liens internes).`);
        if (deep.details.full_variant_found) evidence.push('llms-full.txt également servi.');
        if (sectionCount >= 3) evidence.push(`${sectionCount} sections recommandées couvertes.`);
        else gaps.push('Moins de 3 sections standard (overview / products / docs / contact / policies).');

        if (Array.isArray(deep.details.red_flags) && deep.details.red_flags.length > 0) {
            gaps.push(`Signaux rouges : ${deep.details.red_flags.join(', ')}.`);
        }
        if (deep.details.internal_links === 0) gaps.push('Aucun lien interne dans llms.txt.');
    } else {
        gaps.push('llms.txt absent — créer /llms.txt avec un `# Brand` et des sections.');
    }

    const finalScore = observed ? score : clamp(Math.min(score, 40));
    return {
        key: 'llms_txt',
        label: DIMENSION_LABELS.llms_txt,
        weight: PROTOCOL_DIMENSION_WEIGHTS.llms_txt,
        score: finalScore,
        status: deriveDimensionStatus(finalScore),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: AI discovery endpoints
// ──────────────────────────────────────────────────────────────

function buildAiDiscoveryDimension({ expert }) {
    const discovery = expert?.ai_discovery_endpoints || null;
    const evidence = [];
    const gaps = [];
    let observed = false;
    let score = 0;

    if (!discovery) {
        gaps.push('Audit layer 2 non exécuté — aucun endpoint AI observé.');
        return {
            key: 'ai_discovery',
            label: DIMENSION_LABELS.ai_discovery,
            weight: PROTOCOL_DIMENSION_WEIGHTS.ai_discovery,
            score: 0,
            status: 'absent',
            evidence,
            gaps,
            topFix: gaps[0] || null,
        };
    }

    const endpoints = toArray(discovery.endpoints);
    const foundCount = endpoints.filter((ep) => ep.found === true).length;
    observed = foundCount > 0 || endpoints.length > 0;
    score = clamp(Number(discovery.score) || 0);

    if (foundCount === 0) {
        gaps.push('Aucun endpoint AI discovery détecté (/.well-known/ai.txt, /ai/summary.json, …).');
    } else {
        evidence.push(`${foundCount} endpoint(s) AI discovery détecté(s).`);
    }

    const invalidJson = endpoints.filter((ep) => ep.found && /\.json$/.test(ep.url) && ep.parse_ok === false);
    if (invalidJson.length > 0) {
        gaps.push(`${invalidJson.length} endpoint(s) JSON invalide(s).`);
    }

    const missingAiTxt = !endpoints.some((ep) => (ep.key === 'ai_well_known' || ep.key === 'ai_legacy') && ep.found);
    if (missingAiTxt) gaps.push('/.well-known/ai.txt absent — politique d’accès IA non déclarée.');

    const finalScore = observed ? score : clamp(Math.min(score, 40));
    return {
        key: 'ai_discovery',
        label: DIMENSION_LABELS.ai_discovery,
        weight: PROTOCOL_DIMENSION_WEIGHTS.ai_discovery,
        score: finalScore,
        status: deriveDimensionStatus(finalScore),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: schema / entity
// ──────────────────────────────────────────────────────────────

function buildSchemaEntityDimension({ extracted, expert }) {
    const brand = expert?.brand_entity || null;
    const hasOrg = extracted?.has_organization_schema === true || brand?.details?.has_organization_schema === true;
    const hasLocal = extracted?.has_local_business_schema === true || brand?.details?.has_local_business_schema === true;
    const hasFaq = extracted?.has_faq_schema === true;
    const evidence = [];
    const gaps = [];
    let score = 0;
    let observed = false;

    if (hasOrg || hasLocal) {
        score += 40;
        observed = true;
        evidence.push(hasLocal ? 'Schema LocalBusiness détecté.' : 'Schema Organization détecté.');
        if (hasOrg && hasLocal) {
            score += 10;
            evidence.push('Organization + LocalBusiness simultanés (posture complète).');
        }
    } else {
        gaps.push('Aucun schema Organization / LocalBusiness détecté.');
    }

    if (hasFaq) {
        score += 30;
        observed = true;
        evidence.push('Schema FAQ détecté.');
    } else {
        gaps.push('Schema FAQ absent — ajouter FAQPage pour les questions fréquentes.');
    }

    const schemaEntities = toArray(extracted?.schema_entities);
    if (schemaEntities.length >= 3) {
        score += 15;
        observed = true;
        evidence.push(`${schemaEntities.length} entités structurées détectées.`);
    } else if (schemaEntities.length > 0) {
        score += 8;
        observed = true;
    } else {
        gaps.push('Peu d’entités structurées détectées sur le site.');
    }

    const brandScore = Number(brand?.score);
    if (Number.isFinite(brandScore) && brandScore > 0) {
        score += 5;
        observed = true;
    }

    score = clamp(score);
    const finalScore = observed ? score : clamp(Math.min(score, 40));
    return {
        key: 'schema_entity',
        label: DIMENSION_LABELS.schema_entity,
        weight: PROTOCOL_DIMENSION_WEIGHTS.schema_entity,
        score: finalScore,
        status: deriveDimensionStatus(finalScore),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Dimension: crawler access
// ──────────────────────────────────────────────────────────────

function buildCrawlerAccessDimension({ layered }) {
    const subsystem = layered?.subsystem_scores || null;
    const rawScore = Number(subsystem?.crawler_access_score);
    const evidence = [];
    const gaps = [];
    let observed = false;

    if (Number.isFinite(rawScore)) {
        observed = true;
        if (rawScore >= 90) evidence.push('Aucun crawler IA critique bloqué dans robots.txt.');
        else if (rawScore >= 70) evidence.push('robots.txt majoritairement ouvert aux crawlers IA.');
        else if (rawScore >= 40) gaps.push('robots.txt limite partiellement les crawlers IA critiques.');
        else gaps.push('robots.txt bloque des crawlers IA critiques (GPTBot, ClaudeBot, Google-Extended, PerplexityBot).');
    } else {
        gaps.push('Score crawler access indisponible — audit trop ancien ou erreur de fetch.');
    }

    const finalScore = observed ? clamp(rawScore) : 0;
    return {
        key: 'crawler_access',
        label: DIMENSION_LABELS.crawler_access,
        weight: PROTOCOL_DIMENSION_WEIGHTS.crawler_access,
        score: finalScore,
        status: deriveDimensionStatus(finalScore),
        evidence,
        gaps,
        topFix: gaps[0] || null,
    };
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

function buildEmptyReport(reason) {
    return {
        available: false,
        reliability: 'unavailable',
        summary: { globalScore: null, globalStatus: 'unavailable' },
        dimensions: [],
        topFixes: [],
        topStrengths: [],
        emptyState: {
            title: 'Protocoles AGENT indisponibles',
            description: reason,
        },
    };
}

const PRIORITY_BY_DIMENSION = Object.freeze({
    llms_txt: 'high',
    schema_entity: 'high',
    crawler_access: 'medium',
    ai_discovery: 'low',
});

function collectTopFixes(dimensions, limit = 3) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return dimensions
        .filter((dim) => dim.score < 60 && dim.topFix)
        .sort((a, b) => {
            const pa = priorityOrder[PRIORITY_BY_DIMENSION[a.key]] ?? 9;
            const pb = priorityOrder[PRIORITY_BY_DIMENSION[b.key]] ?? 9;
            if (pa !== pb) return pa - pb;
            return a.score - b.score;
        })
        .slice(0, limit)
        .map((dim) => ({
            dimensionKey: dim.key,
            dimensionLabel: dim.label,
            priority: PRIORITY_BY_DIMENSION[dim.key] || 'low',
            message: dim.topFix,
        }));
}

function collectTopStrengths(dimensions, limit = 3) {
    return dimensions
        .filter((dim) => dim.score >= 70 && dim.evidence.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((dim) => ({
            dimensionKey: dim.key,
            dimensionLabel: dim.label,
            message: dim.evidence[0],
            score: dim.score,
        }));
}

export function buildProtocolsReport({ audit = null } = {}) {
    if (!audit) {
        return buildEmptyReport('Aucun audit disponible. Lancez un audit pour activer l’analyse des protocoles.');
    }
    if (audit?.scan_status && audit.scan_status === 'failed') {
        return buildEmptyReport('Le dernier audit a échoué. Relancez un audit pour activer les protocoles.');
    }

    const extracted = audit.extracted_data || {};
    const layered = readLayered(audit);
    const expert = readExpert(audit);

    const dimensions = [
        buildLlmsTxtDimension({ expert }),
        buildAiDiscoveryDimension({ expert }),
        buildSchemaEntityDimension({ extracted, expert }),
        buildCrawlerAccessDimension({ layered }),
    ];

    const weightSum = dimensions.reduce((acc, dim) => acc + dim.weight, 0);
    const weighted = dimensions.reduce((acc, dim) => acc + dim.score * dim.weight, 0);
    const rawGlobal = weightSum > 0 ? weighted / weightSum : null;

    const anyObserved = dimensions.some((dim) => dim.score > 0);
    const globalScore = rawGlobal === null
        ? null
        : Math.round(anyObserved ? rawGlobal : Math.min(rawGlobal, 40));

    const globalStatus = globalScore === null
        ? 'unavailable'
        : globalScore >= 70
            ? 'couvert'
            : globalScore >= 40
                ? 'partiel'
                : 'bloqué';

    return {
        available: true,
        reliability: deriveReliability(audit),
        summary: {
            globalScore,
            globalStatus,
            auditFreshnessHours: hoursSince(audit.created_at),
            auditCreatedAt: audit.created_at || null,
            coveredDimensions: dimensions.filter((d) => d.score >= 70).length,
            totalDimensions: dimensions.length,
        },
        dimensions,
        topFixes: collectTopFixes(dimensions),
        topStrengths: collectTopStrengths(dimensions),
        emptyState: null,
    };
}

/**
 * Convert a full protocols report into the `{ score, reliability }` shape
 * consumed by `computeAgentScore`. Returns null if unavailable so the score
 * module treats it as a missing input (and renormalizes the weights).
 */
export function deriveProtocolsInput(report) {
    if (!report || report.available === false) return null;
    const score = report?.summary?.globalScore;
    if (!Number.isFinite(score)) return null;
    return {
        score,
        reliability: report.reliability || 'calculated',
    };
}

export const __internal__ = {
    clamp,
    deriveReliability,
    deriveDimensionStatus,
    collectTopFixes,
    buildLlmsTxtDimension,
    buildAiDiscoveryDimension,
    buildSchemaEntityDimension,
    buildCrawlerAccessDimension,
};
