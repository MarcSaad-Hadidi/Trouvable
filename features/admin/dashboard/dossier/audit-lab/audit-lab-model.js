/**
 * Pure selectors / view-models for the operator Audit Lab page.
 *
 * This module is the single place where we reconcile the stable persisted
 * audit columns with the newer `extracted_data.layered_v1` structure so the
 * UI renders consistently during migration (layered pipeline may be off,
 * shadowed, or freshly rolled out against historical rows).
 *
 * The golden rule is: the Trouvable product truth lives in the persisted
 * columns (`seo_score`, `geo_score`, `geo_breakdown.overall.hybrid_score`,
 * `issues`, `strengths`). Layer 1 and Layer 2 outputs are diagnostic only.
 */

import { finiteNumberOrNull } from '@/lib/numbers';

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

const asNumber = finiteNumberOrNull;

/**
 * Authoritative Trouvable final score (stable product truth).
 * Falls back to persisted scoring breakdown, then to raw `seo_score` so the
 * hero always has something meaningful.
 */
export function getFinalStableScores(audit) {
    if (!audit) return { finalScore: null, seoScore: null, geoScore: null, deterministicScore: null, hybridScore: null, llmStatus: null };

    const seoScore = asNumber(audit.seo_score);
    const geoScore = asNumber(audit.geo_score);
    const hybridScore = asNumber(audit?.geo_breakdown?.overall?.hybrid_score);
    const deterministicScore = asNumber(audit?.geo_breakdown?.overall?.deterministic_score);
    const llmStatus = audit?.geo_breakdown?.overall?.llm_status || audit?.geo_breakdown?.ai_analysis?.status || null;

    const finalScore = hybridScore ?? deterministicScore ?? geoScore ?? seoScore;

    return {
        finalScore,
        seoScore,
        geoScore,
        deterministicScore,
        hybridScore,
        llmStatus,
    };
}

export function getDimensions(audit) {
    const geoDims = toArray(audit?.geo_breakdown?.dimensions);
    if (geoDims.length > 0) return geoDims;
    return toArray(audit?.seo_breakdown?.dimensions);
}

/**
 * SEO vs GEO bucket mapping for the dimensions produced by `scoreAuditV2`.
 *
 * Regroupement retenu pour la lecture opérateur :
 *   - bucket SEO  : lisibilité technique + complétude d'identité détectable.
 *     (indexabilité, métadonnées, contenu rendu, identité business observable)
 *   - bucket GEO  : réponse IA + ancrage local + preuves de confiance.
 *     (answerability IA, signaux locaux, trust stack, contenu citable)
 *
 * Ce n'est pas une invention : chaque clé existe déjà dans `DIMENSION_META`
 * de `lib/audit/score-meta.js`. Cette fonction ne fait que les étiqueter pour
 * l'UI sans toucher au backend de scoring.
 */
const DIMENSION_BUCKETS = {
    technical_seo: 'seo',
    identity_completeness: 'seo',
    local_readiness: 'geo',
    ai_answerability: 'geo',
    trust_signals: 'geo',
};

export function getDimensionBucket(dimensionKey) {
    return DIMENSION_BUCKETS[String(dimensionKey || '').toLowerCase()] || null;
}

const DIMENSION_FR = {
    technical_seo: {
        label: 'SEO technique',
        short: 'Lisibilité technique',
        description: 'Indexabilité, métadonnées, structure on-page et couverture du crawl.',
    },
    identity_completeness: {
        label: 'Identité complète',
        short: 'Identité business détectable',
        description: 'Nom d\u2019entreprise, téléphones, email, profils sociaux et pages identité.',
    },
    local_readiness: {
        label: 'Ancrage local / GEO',
        short: 'Présence locale',
        description: 'Schéma LocalBusiness, empreinte géographique, pages de zones servies.',
    },
    ai_answerability: {
        label: 'Réponse IA',
        short: 'Lisibilité par les IA',
        description: 'Contenu extractible, FAQ, blocs citables, accès des crawlers IA.',
    },
    trust_signals: {
        label: 'Signaux de confiance',
        short: 'Preuves sociales',
        description: 'Avis, mentions, preuves publiques et signaux de crédibilité.',
    },
};

export function dimensionFrMeta(key) {
    const lower = String(key || '').toLowerCase();
    return DIMENSION_FR[lower] || null;
}

/**
 * View-model "Lecture SEO vs GEO" — Section B.
 *
 * Répartit les 5 dimensions de scoring en deux colonnes éditorialement
 * cohérentes (cf. `DIMENSION_BUCKETS`) et calcule, pour chaque colonne :
 *   - le score agrégé (moyenne pondérée par la pertinence « high » des
 *     dimensions encore applicables — les dimensions « not applicable »
 *     sont exclues pour ne pas pénaliser un profil de site à tort) ;
 *   - les points forts rattachés (via `strength.dimension`) ;
 *   - les points faibles rattachés (via `issue.dimension`).
 *
 * Ne fabrique aucune donnée : tout provient de `score_dimensions`, `issues`,
 * `strengths` tels que produits par `scoreAuditV2`.
 */
export function getSeoGeoBucketsViewModel(audit) {
    const dimensions = getDimensions(audit);
    const issues = toArray(audit?.issues);
    const strengths = toArray(audit?.strengths);

    const byKey = new Map(dimensions.map((dim) => [String(dim.key || dim.id || '').toLowerCase(), dim]));

    function bucketSummary(bucketName) {
        const bucketDimensions = Object.entries(DIMENSION_BUCKETS)
            .filter(([, b]) => b === bucketName)
            .map(([key]) => ({ key, dimension: byKey.get(key) || null, meta: dimensionFrMeta(key) }));

        const applicableScores = bucketDimensions
            .map((entry) => (entry.dimension && Number.isFinite(entry.dimension.score) && entry.dimension.applicability !== 'N/A' ? entry.dimension.score : null))
            .filter((score) => score !== null);
        const bucketScore = applicableScores.length > 0
            ? Math.round(applicableScores.reduce((acc, score) => acc + score, 0) / applicableScores.length)
            : null;

        const keys = bucketDimensions.map((entry) => entry.key);
        const bucketIssues = issues.filter((issue) => keys.includes(String(issue?.dimension || '').toLowerCase()));
        const bucketStrengths = strengths.filter((strength) => keys.includes(String(strength?.dimension || '').toLowerCase()));

        // Synthesize corrective points when the bucket is below the "near-perfect"
        // threshold. This fixes the historical incoherence where SEO/GEO could be
        // < 100 but "Points à corriger" was empty because no issue was dimension-tagged.
        const SYNTH_THRESHOLD = 95;
        const needsSynthesis = bucketScore !== null && bucketScore !== undefined && bucketScore < SYNTH_THRESHOLD;
        const synthesized = needsSynthesis
            ? getSeoGeoBucketSynthesis(audit, bucketName, bucketIssues, bucketDimensions)
            : [];

        // Merge explicit issues with synthesized points, keeping explicit first,
        // capped to a readable length.
        const correctivePoints = [
            ...bucketIssues.map((issue) => ({
                id: issue.id || issue.title,
                title: issue.title || issue.description || 'Point à corriger',
                description: issue.description || issue.recommended_fix || '',
                severity: issue.severity || issue.priority || 'medium',
                source: 'issue',
            })),
            ...synthesized,
        ].slice(0, 6);

        return {
            bucket: bucketName,
            score: bucketScore,
            dimensions: bucketDimensions,
            issues: bucketIssues,
            strengths: bucketStrengths,
            synthesized,
            correctivePoints,
            synthesisApplied: needsSynthesis && bucketIssues.length === 0 && synthesized.length > 0,
        };
    }

    return {
        hasAny: dimensions.length > 0,
        dimensions,
        seo: bucketSummary('seo'),
        geo: bucketSummary('geo'),
    };
}

export function getClassification(audit) {
    return audit?.geo_breakdown?.site_classification
        || audit?.seo_breakdown?.site_classification
        || audit?.extracted_data?.layered_v1?.classification
        || null;
}

/**
 * Layer 1 view-model. Merges the always-populated scanner block
 * (`extracted_data.layered_v1_layer1`) with the assembled canonical block
 * (`extracted_data.layered_v1`) when available. Tolerates either being absent.
 */
export function getLayer1ViewModel(audit) {
    const extracted = audit?.extracted_data || {};
    const scannerBlock = extracted.layered_v1_layer1 || null;
    const canonical = extracted.layered_v1 || null;

    const crawlMetadata = canonical?.crawl_metadata || scannerBlock?.crawl_metadata || null;
    const renderMetadata = canonical?.render_metadata || null;
    const renderStats = extracted.render_stats || null;
    const siteLevelRawScores = canonical?.site_level_raw_scores || scannerBlock?.site_level_raw_scores || null;
    const pageLevelChecks = canonical?.page_level_checks?.length
        ? canonical.page_level_checks
        : toArray(scannerBlock?.page_level_checks);
    const pageArtifacts = toArray(canonical?.page_artifacts);
    const scannedPages = toArray(audit?.scanned_pages);

    const hasAny = Boolean(
        crawlMetadata
        || renderStats
        || siteLevelRawScores
        || pageLevelChecks.length
        || pageArtifacts.length
        || scannedPages.length,
    );

    return {
        hasAny,
        crawlMetadata,
        renderMetadata,
        renderStats,
        siteLevelRawScores,
        pageLevelChecks,
        pageArtifacts,
        scannedPages,
    };
}

/**
 * Group page-level checks for the operator view.
 *
 * The Layer 1 scanner emits entries of the shape:
 *   { page_url, page_type, render_mode, checks: [
 *       { check_id, category, status: 'pass'|'warn'|'fail'|'skip', evidence, weight, data }
 *   ] }
 *
 * We flatten per page, compute aggregate counts and derive a single page-level
 * status so the UI can render trustworthy totals and a deterministic filter.
 *
 *   - 'problem'  : at least one failing check
 *   - 'watch'    : no failing checks but at least one warning
 *   - 'ok'       : only passing / skipped checks
 *   - 'unknown'  : no usable check statuses (malformed page entry)
 */
export function groupPageChecksByUrl(pageEntries) {
    const groups = [];

    for (const entry of toArray(pageEntries)) {
        const url = entry?.page_url || entry?.url || '—';
        const rawChecks = toArray(entry?.checks);

        let pass = 0;
        let warn = 0;
        let fail = 0;
        let skip = 0;
        let unknown = 0;

        for (const check of rawChecks) {
            const status = String(check?.status || '').toLowerCase();
            if (status === 'pass') pass += 1;
            else if (status === 'warn') warn += 1;
            else if (status === 'fail') fail += 1;
            else if (status === 'skip') skip += 1;
            else unknown += 1;
        }

        let pageStatus = 'unknown';
        if (fail > 0) pageStatus = 'problem';
        else if (warn > 0) pageStatus = 'watch';
        else if (pass > 0) pageStatus = 'ok';

        groups.push({
            url,
            pageType: entry?.page_type || null,
            renderMode: entry?.render_mode || null,
            checks: rawChecks,
            pass,
            warn,
            fail,
            skip,
            unknown,
            total: rawChecks.length,
            pageStatus,
        });
    }

    const rank = { problem: 3, watch: 2, ok: 1, unknown: 0 };
    groups.sort((a, b) => {
        const r = (rank[b.pageStatus] ?? 0) - (rank[a.pageStatus] ?? 0);
        if (r !== 0) return r;
        if (b.fail !== a.fail) return b.fail - a.fail;
        if (b.warn !== a.warn) return b.warn - a.warn;
        return a.url.localeCompare(b.url);
    });

    return groups;
}

/**
 * Aggregate check totals by `category` (as emitted by the Layer 1 registry
 * — typically `technical`, `content`, `ai_readiness`, `geo`, `trust`).
 *
 * Returns, for each category seen in the page groups:
 *   - cumulative pass/warn/fail/skip/total
 *   - a short list of the most impactful check IDs (sorted by failures then
 *     warnings) so the operator can jump straight to "what's broken where"
 *     without reading every single page.
 *
 * Does not invent categories: only what the scan actually emitted.
 */
export function aggregateChecksByCategory(pageGroups) {
    const byCategory = new Map();

    for (const group of toArray(pageGroups)) {
        for (const check of toArray(group.checks)) {
            const category = String(check?.category || 'other').toLowerCase();
            const checkId = String(check?.check_id || check?.id || 'unknown');
            const status = String(check?.status || '').toLowerCase();

            if (!byCategory.has(category)) {
                byCategory.set(category, {
                    category,
                    pass: 0, warn: 0, fail: 0, skip: 0, unknown: 0, total: 0,
                    byCheckId: new Map(),
                });
            }
            const bucket = byCategory.get(category);
            bucket.total += 1;
            if (status === 'pass') bucket.pass += 1;
            else if (status === 'warn') bucket.warn += 1;
            else if (status === 'fail') bucket.fail += 1;
            else if (status === 'skip') bucket.skip += 1;
            else bucket.unknown += 1;

            if (!bucket.byCheckId.has(checkId)) {
                bucket.byCheckId.set(checkId, { pass: 0, warn: 0, fail: 0, skip: 0, total: 0 });
            }
            const perCheck = bucket.byCheckId.get(checkId);
            perCheck.total += 1;
            if (status === 'pass') perCheck.pass += 1;
            else if (status === 'warn') perCheck.warn += 1;
            else if (status === 'fail') perCheck.fail += 1;
            else if (status === 'skip') perCheck.skip += 1;
        }
    }

    const result = [];
    for (const bucket of byCategory.values()) {
        const topIssues = Array.from(bucket.byCheckId.entries())
            .map(([checkId, counts]) => ({ checkId, ...counts }))
            .filter((entry) => entry.fail > 0 || entry.warn > 0)
            .sort((a, b) => (b.fail - a.fail) || (b.warn - a.warn))
            .slice(0, 3);

        const { byCheckId: _discard, ...rest } = bucket;
        void _discard;
        result.push({ ...rest, topIssues });
    }

    // Order: most broken categories first, then by total activity.
    result.sort((a, b) => (b.fail - a.fail) || (b.warn - a.warn) || (b.total - a.total));
    return result;
}

/**
 * Aggregate totals across page groups (count of pages per status + cumulative
 * check totals). Used to render trustworthy summary cards in Section 4.
 */
export function summarizePageGroups(groups) {
    const totals = {
        pages: { problem: 0, watch: 0, ok: 0, unknown: 0, total: 0 },
        checks: { pass: 0, warn: 0, fail: 0, skip: 0, unknown: 0, total: 0 },
    };

    for (const group of toArray(groups)) {
        totals.pages.total += 1;
        totals.pages[group.pageStatus] = (totals.pages[group.pageStatus] || 0) + 1;
        totals.checks.pass += group.pass;
        totals.checks.warn += group.warn;
        totals.checks.fail += group.fail;
        totals.checks.skip += group.skip;
        totals.checks.unknown += group.unknown;
        totals.checks.total += group.total;
    }

    return totals;
}

/**
 * Layer 2 view-model. Only available when the canonical layered object has
 * been persisted (not the case in shadow mode or on legacy audits).
 */
export function getLayer2ViewModel(audit) {
    const canonical = audit?.extracted_data?.layered_v1 || null;
    const expert = canonical?.site_level_expert || null;
    const summary = canonical?.subsystem_scores?.layer2_expert_summary || null;

    const modules = expert
        ? [
            { key: 'llms_txt_deep', label: 'llms.txt (validation profonde)', data: expert.llms_txt_deep },
            { key: 'ai_discovery_endpoints', label: 'Endpoints de découverte IA', data: expert.ai_discovery_endpoints },
            { key: 'brand_entity', label: 'Marque / entité', data: expert.brand_entity },
            { key: 'trust_stack', label: 'Signaux de confiance', data: expert.trust_stack },
            { key: 'negative_signals', label: 'Signaux négatifs', data: expert.negative_signals },
        ].filter((m) => m.data)
        : [];

    return {
        hasAny: modules.length > 0 || Boolean(summary),
        summary,
        modules,
    };
}

/**
 * Canonical Layer 3 / 4 view-model (normalized evidence, classification,
 * final Trouvable score, dashboard reporting fields).
 */
export function getCanonicalViewModel(audit) {
    const canonical = audit?.extracted_data?.layered_v1 || null;
    if (!canonical) return { hasAny: false, canonical: null };

    return {
        hasAny: true,
        canonical,
        schema: canonical.__schema || null,
        target: canonical.target || null,
        classification: canonical.classification || null,
        normalizedEvidence: canonical.normalized_evidence || null,
        finalScore: canonical.final_trouvable_score || null,
        dashboardReportingFields: canonical.dashboard_reporting_fields || null,
        recommendations: canonical.recommendations || null,
        subsystemScores: canonical.subsystem_scores || null,
    };
}

/**
 * Benchmark / debug view-model. Combines persisted metadata (version, status)
 * with whatever `debug_benchmark` was stored on the canonical object.
 */
export function getBenchmarkViewModel(audit) {
    const canonical = audit?.extracted_data?.layered_v1 || null;
    const debug = canonical?.debug_benchmark || null;

    return {
        auditId: audit?.id || null,
        auditVersion: audit?.audit_version || null,
        scanStatus: audit?.scan_status || null,
        createdAt: audit?.created_at || null,
        errorMessage: audit?.error_message || null,
        sourceUrl: audit?.source_url || null,
        resolvedUrl: audit?.resolved_url || null,
        timings: debug?.timings || null,
        engineId: debug?.single_engine_id || null,
        hasCanonical: Boolean(canonical),
    };
}

export function formatMs(value) {
    const num = asNumber(value);
    if (num === null) return '—';
    if (num < 1000) return `${Math.round(num)} ms`;
    return `${(num / 1000).toFixed(2)} s`;
}

export function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return String(iso);
    }
}

/**
 * Construit un "snapshot de comparaison" à partir d'un audit persisté.
 *
 * Produit le même squelette de données que le payload renvoyé par
 * `POST /api/admin/audits/compare` (cf. `auditSiteForCompare`) de sorte que
 * la page de comparaison dédiée puisse afficher les deux cotés ("audit
 * actuel" vs "audit précédent" vs "benchmark dry-run") dans un composant
 * unique, sans logique conditionnelle d'affichage.
 */
export function buildCompareSnapshotFromAudit(audit, { label = null } = {}) {
    if (!audit) return null;
    const scores = getFinalStableScores(audit);
    const dimensions = getDimensions(audit).map((dim) => ({
        key: String(dim.key || dim.id || '').toLowerCase(),
        score: Number.isFinite(dim.score) ? dim.score : null,
        applicability: dim.applicability || null,
    }));
    const classification = getClassification(audit);
    const layer1 = audit?.extracted_data?.layered_v1_layer1?.site_level_raw_scores
        || audit?.extracted_data?.layered_v1?.site_level_raw_scores
        || null;
    const layer2Summary = audit?.geo_breakdown?.subsystem_scores?.layer2_expert_summary
        || audit?.extracted_data?.layered_v1?.subsystem_scores?.layer2_expert_summary
        || null;
    const scannedPages = toArray(audit?.scanned_pages);

    return {
        url: audit?.source_url || audit?.resolved_url || null,
        resolvedUrl: audit?.resolved_url || audit?.source_url || null,
        label: label || null,
        auditId: audit?.id || null,
        createdAt: audit?.created_at || null,
        durationMs: null,
        success: true,
        pagesScanned: scannedPages.length,
        pagesSuccessful: scannedPages.filter((page) => page?.success).length,
        classification: classification
            ? {
                type: classification.type || null,
                label: classification.label || null,
                confidence: classification.confidence || null,
            }
            : null,
        scores: {
            finalScore: scores.finalScore,
            seoScore: scores.seoScore,
            geoScore: scores.geoScore,
            deterministicScore: scores.deterministicScore,
        },
        dimensions,
        layer1: layer1
            ? {
                overall: layer1.overall ?? null,
                categories: layer1.categories || {},
                totals: layer1.totals || null,
            }
            : null,
        layer2: layer2Summary
            ? {
                summary_score: layer2Summary.summary_score ?? null,
                finding_counts: layer2Summary.finding_counts || null,
            }
            : null,
        issues: toArray(audit?.issues).slice(0, 8).map((issue) => ({
            id: issue.id || issue.code || null,
            title: issue.title || issue.message || null,
            severity: issue.severity || issue.priority || null,
            category: issue.category || null,
            dimension: issue.dimension || null,
        })),
        strengths: toArray(audit?.strengths).slice(0, 6).map((strength) => ({
            id: strength.id || strength.code || null,
            title: strength.title || strength.message || null,
            category: strength.category || null,
            dimension: strength.dimension || null,
        })),
    };
}

export function scoreToneClass(score) {
    const value = asNumber(score);
    if (value === null) return 'text-white/30';
    if (value >= 80) return 'text-emerald-300';
    if (value >= 60) return 'text-violet-300';
    if (value >= 40) return 'text-amber-200';
    return 'text-red-300';
}

/* =========================================================================
 * PROBLEM MODEL — unified severity hierarchy (blocking / important / watch)
 *
 * Ce module résout l'incohérence historique où la section "Problèmes
 * prioritaires" pouvait afficher « Aucun problème majeur » alors que le
 * reste de la page remonte encore des échecs techniques Layer 1 ou des
 * dimensions basses.
 *
 * Règle produit :
 *   - bloquant  : issue critical/high + échec Layer 1 de poids fort
 *   - important : issue medium + warn/fail Layer 1 sur un check majeur
 *   - à surveiller : issue low + warn Layer 1 sur un check secondaire
 *
 * Le score de la Section A ne peut être incohérent avec ce modèle : si une
 * dimension est à < 80, au moins un problème de catégorie "important" doit
 * apparaître (soit via issue tagguée, soit via synthèse Layer 1).
 * ========================================================================= */

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function severityToSlot(severity) {
    const key = String(severity || '').toLowerCase();
    if (key === 'critical' || key === 'high') return 'blocking';
    if (key === 'medium' || key === 'warn' || key === 'warning') return 'important';
    if (key === 'low' || key === 'info') return 'watch';
    return 'watch';
}

function layer1StatusToSlot(status, weight) {
    const s = String(status || '').toLowerCase();
    const w = asNumber(weight) || 1;
    if (s === 'fail') return w >= 2 ? 'blocking' : 'important';
    if (s === 'warn') return w >= 2 ? 'important' : 'watch';
    return null;
}

function normalizeIssueForModel(issue, index) {
    const severity = String(issue?.priority || issue?.severity || 'medium').toLowerCase();
    return {
        source: 'issue',
        id: issue?.id || `issue-${index}`,
        title: issue?.title || issue?.description || 'Problème',
        description: issue?.description || issue?.title || '',
        severity,
        slot: severityToSlot(severity),
        category: issue?.category || null,
        dimension: issue?.dimension || null,
        recommendedFix: issue?.recommended_fix || null,
        evidenceSummary: issue?.evidence_summary || null,
        evidenceStatus: issue?.evidence_status || null,
        provenance: issue?.provenance || 'observed',
    };
}

/**
 * Derive synthesized problems from Layer 1 raw checks that don't already
 * surface via `audit.issues`. Avoids double-counting: if an issue already
 * mentions the same check category + status, the Layer 1 version is skipped.
 */
function deriveLayer1Problems(audit, alreadyCoveredKeys) {
    const layer1 = getLayer1ViewModel(audit);
    if (!layer1.hasAny) return [];

    const perCheck = new Map();
    for (const page of toArray(layer1.pageLevelChecks)) {
        for (const check of toArray(page?.checks)) {
            const status = String(check?.status || '').toLowerCase();
            if (status !== 'fail' && status !== 'warn') continue;

            const checkId = String(check?.check_id || check?.id || 'unknown');
            const existing = perCheck.get(checkId) || {
                checkId,
                category: String(check?.category || 'other').toLowerCase(),
                weight: asNumber(check?.weight) || 1,
                fail: 0,
                warn: 0,
                evidenceSamples: [],
            };
            if (status === 'fail') existing.fail += 1;
            if (status === 'warn') existing.warn += 1;
            if (check?.evidence && existing.evidenceSamples.length < 2) {
                existing.evidenceSamples.push(String(check.evidence).slice(0, 160));
            }
            perCheck.set(checkId, existing);
        }
    }

    const problems = [];
    for (const entry of perCheck.values()) {
        if (alreadyCoveredKeys.has(entry.checkId)) continue;
        const dominantStatus = entry.fail > 0 ? 'fail' : 'warn';
        const slot = layer1StatusToSlot(dominantStatus, entry.weight);
        if (!slot) continue;

        problems.push({
            source: 'layer1',
            id: `layer1:${entry.checkId}`,
            title: `Check technique « ${entry.checkId} » en échec`,
            description: entry.evidenceSamples[0] || `${entry.fail} échec(s), ${entry.warn} avertissement(s) relevés pendant le scan.`,
            severity: dominantStatus === 'fail' ? (entry.weight >= 2 ? 'high' : 'medium') : 'low',
            slot,
            category: entry.category,
            dimension: null,
            checkId: entry.checkId,
            failCount: entry.fail,
            warnCount: entry.warn,
            weight: entry.weight,
            provenance: 'layer1',
        });
    }
    return problems;
}

/**
 * Returns the unified problem model used by the main audit page and the
 * comparison page. Guarantees coherence between the headline message and
 * what the rest of the page actually shows.
 */
export function getUnifiedProblemModel(audit) {
    if (!audit) {
        return {
            hasAny: false,
            blocking: [],
            important: [],
            watch: [],
            headline: 'Aucun audit à analyser',
            subheadline: 'Lancez un audit pour générer la lecture des problèmes.',
            totals: { blocking: 0, important: 0, watch: 0, total: 0 },
        };
    }

    const issues = toArray(audit?.issues).map(normalizeIssueForModel);

    const alreadyCoveredKeys = new Set(
        issues
            .map((issue) => String(issue.id || issue.title || '').toLowerCase())
            .concat(issues.map((issue) => String(issue.category || '').toLowerCase())),
    );

    const layer1Problems = deriveLayer1Problems(audit, alreadyCoveredKeys);

    const merged = [...issues, ...layer1Problems].sort((a, b) => {
        const slotOrder = { blocking: 0, important: 1, watch: 2 };
        const slotDiff = (slotOrder[a.slot] ?? 3) - (slotOrder[b.slot] ?? 3);
        if (slotDiff !== 0) return slotDiff;
        const rankA = SEVERITY_RANK[a.severity] ?? 5;
        const rankB = SEVERITY_RANK[b.severity] ?? 5;
        return rankA - rankB;
    });

    const blocking = merged.filter((p) => p.slot === 'blocking');
    const important = merged.filter((p) => p.slot === 'important');
    const watch = merged.filter((p) => p.slot === 'watch');

    let headline;
    let subheadline;

    if (blocking.length > 0) {
        headline = `${blocking.length} problème${blocking.length > 1 ? 's' : ''} bloquant${blocking.length > 1 ? 's' : ''}`;
        subheadline = `${important.length} important${important.length > 1 ? 's' : ''} · ${watch.length} à surveiller`;
    } else if (important.length > 0) {
        headline = 'Aucun problème bloquant';
        subheadline = `${important.length} problème${important.length > 1 ? 's' : ''} important${important.length > 1 ? 's' : ''} à traiter · ${watch.length} à surveiller`;
    } else if (watch.length > 0) {
        headline = 'Aucun problème bloquant';
        subheadline = `${watch.length} signal${watch.length > 1 ? 'aux' : ''} à surveiller`;
    } else {
        headline = 'Aucun problème majeur détecté';
        subheadline = 'Le dernier audit ne remonte ni blocage, ni problème important, ni signal à surveiller.';
    }

    return {
        hasAny: merged.length > 0,
        blocking,
        important,
        watch,
        all: merged,
        headline,
        subheadline,
        totals: {
            blocking: blocking.length,
            important: important.length,
            watch: watch.length,
            total: merged.length,
        },
    };
}

/* =========================================================================
 * SEO / GEO bucket — synthesized corrective points
 *
 * Le backend ne tague pas toujours `issue.dimension`. Quand un bucket est
 * bas (< 80) mais que les issues tagguées sur ses dimensions sont vides,
 * l'UI ne doit plus afficher "Aucun problème à corriger". On synthétise
 * alors depuis :
 *   - la dimension la plus basse dans le bucket,
 *   - les checks Layer 1 fail/warn de catégorie correspondante,
 *   - les findings Layer 2 mappés au bucket,
 *   - les signaux manquants (influence items non observés).
 * ========================================================================= */

const LAYER1_CATEGORY_TO_BUCKET = {
    technical: 'seo',
    content: 'seo',
    ai_readiness: 'geo',
    geo: 'geo',
    trust: 'geo',
};

const LAYER2_MODULE_TO_BUCKET = {
    llms_txt_deep: 'geo',
    ai_discovery_endpoints: 'geo',
    brand_entity: 'seo',
    trust_stack: 'geo',
    negative_signals: 'seo',
};

export function getSeoGeoBucketSynthesis(audit, bucketName, explicitIssues, dimensions) {
    const synthesized = [];

    const applicableDims = dimensions
        .filter((entry) => entry.dimension && typeof entry.dimension.score === 'number' && entry.dimension.applicability !== 'N/A')
        .map((entry) => ({ key: entry.key, score: entry.dimension.score, label: entry.meta?.label || entry.key }))
        .sort((a, b) => a.score - b.score);

    const weakestDim = applicableDims[0];
    if (weakestDim && weakestDim.score < 80) {
        synthesized.push({
            id: `synth:dim:${weakestDim.key}`,
            title: `« ${weakestDim.label} » à ${weakestDim.score}/100`,
            description: `Cette dimension contribue à tirer le bucket vers le bas. Les contrôles techniques et les signaux attendus pour « ${weakestDim.label} » ne sont pas tous réunis.`,
            severity: weakestDim.score < 50 ? 'high' : 'medium',
            source: 'dimension',
            dimensionKey: weakestDim.key,
        });
    }

    const layer1 = getLayer1ViewModel(audit);
    const relevantLayer1 = new Map();
    for (const page of toArray(layer1.pageLevelChecks)) {
        for (const check of toArray(page?.checks)) {
            const status = String(check?.status || '').toLowerCase();
            if (status !== 'fail' && status !== 'warn') continue;
            const category = String(check?.category || 'other').toLowerCase();
            if (LAYER1_CATEGORY_TO_BUCKET[category] !== bucketName) continue;

            const checkId = String(check?.check_id || check?.id || 'unknown');
            const existing = relevantLayer1.get(checkId) || { checkId, category, fail: 0, warn: 0, evidence: null };
            if (status === 'fail') existing.fail += 1;
            if (status === 'warn') existing.warn += 1;
            if (!existing.evidence && check?.evidence) existing.evidence = String(check.evidence).slice(0, 160);
            relevantLayer1.set(checkId, existing);
        }
    }

    const sortedLayer1 = Array.from(relevantLayer1.values())
        .sort((a, b) => (b.fail - a.fail) || (b.warn - a.warn))
        .slice(0, 3);
    for (const check of sortedLayer1) {
        synthesized.push({
            id: `synth:layer1:${check.checkId}`,
            title: `Contrôle technique « ${check.checkId} » ${check.fail > 0 ? 'en échec' : 'à surveiller'}`,
            description: check.evidence || `${check.fail} échec(s), ${check.warn} avertissement(s) détectés pendant le scan.`,
            severity: check.fail > 0 ? 'medium' : 'low',
            source: 'layer1',
        });
    }

    const layer2 = getLayer2ViewModel(audit);
    if (layer2.hasAny) {
        for (const expertModule of layer2.modules) {
            if (LAYER2_MODULE_TO_BUCKET[expertModule.key] !== bucketName) continue;
            const data = expertModule.data || {};
            const issues = toArray(data.issues || data.findings).slice(0, 2);
            for (const finding of issues) {
                synthesized.push({
                    id: `synth:layer2:${expertModule.key}:${finding.id || finding.code || finding.title || Math.random().toString(36).slice(2, 8)}`,
                    title: finding.title || finding.message || `Finding expert — ${expertModule.label}`,
                    description: finding.detail || finding.description || `Signal expert détecté sur « ${expertModule.label} ».`,
                    severity: String(finding.severity || 'medium').toLowerCase(),
                    source: 'layer2',
                });
            }
        }
    }

    const explicitTitleKeys = new Set(explicitIssues.map((i) => String(i.title || '').toLowerCase()));
    return synthesized.filter((item) => !explicitTitleKeys.has(String(item.title).toLowerCase()));
}

/* =========================================================================
 * OPPORTUNITY MODEL — classify observed strengths into actionable buckets
 *
 * Le backend fournit des `strengths` (ce que l'audit a positivement observé)
 * et des `issues` (ce qui manque). Pour être actionnable côté opérateur, on
 * regroupe ce matériel en 5 familles :
 *   - quick_wins  : correctifs à faible effort / fort impact
 *   - seo         : pousser le socle SEO (dimensions technical/identity)
 *   - geo         : pousser la réponse IA et l'ancrage local
 *   - content     : blocs citables / extractabilité
 *   - trust       : preuves sociales, signaux de confiance
 *
 * Chaque carte indique pourquoi c'est une opportunité, l'action à mener,
 * l'impact attendu et l'effort estimé.
 * ========================================================================= */

const CATEGORY_TO_FAMILY = {
    technical: 'seo',
    seo: 'seo',
    content: 'content',
    ai_readiness: 'geo',
    ai: 'geo',
    geo: 'geo',
    local: 'geo',
    trust: 'trust',
};

const DIMENSION_TO_FAMILY = {
    technical_seo: 'seo',
    identity_completeness: 'seo',
    local_readiness: 'geo',
    ai_answerability: 'geo',
    trust_signals: 'trust',
};

function guessEffort(entry) {
    const title = String(entry.title || '').toLowerCase();
    if (title.includes('title') || title.includes('meta') || title.includes('canonical') || title.includes('robots')) return 'faible';
    if (title.includes('schema') || title.includes('faq') || title.includes('json-ld')) return 'moyen';
    if (title.includes('contenu') || title.includes('page') || title.includes('service')) return 'élevé';
    return 'moyen';
}

function guessImpactForFamily(family, effort) {
    if (family === 'quick_wins') return 'fort';
    if (effort === 'faible') return 'moyen';
    if (effort === 'élevé') return 'fort';
    return 'moyen';
}

function opportunityFamilyFromRaw(raw) {
    const dim = String(raw.dimension || '').toLowerCase();
    if (DIMENSION_TO_FAMILY[dim]) return DIMENSION_TO_FAMILY[dim];
    const cat = String(raw.category || '').toLowerCase();
    if (CATEGORY_TO_FAMILY[cat]) return CATEGORY_TO_FAMILY[cat];
    return 'seo';
}

export function getOpportunityModel(audit) {
    if (!audit) {
        return { hasAny: false, families: [], totals: { total: 0 } };
    }

    const issues = toArray(audit?.issues);
    const strengths = toArray(audit?.strengths);

    const opportunities = [];

    // Quick wins = issues with low effort + remediable (title, meta, canonical, schema).
    for (const issue of issues) {
        const title = String(issue?.title || issue?.description || '').toLowerCase();
        const priority = String(issue?.priority || issue?.severity || 'medium').toLowerCase();
        const effort = guessEffort(issue);
        const isQuickWin =
            effort === 'faible'
            && (priority === 'high' || priority === 'medium')
            && (title.includes('title') || title.includes('meta') || title.includes('canonical') || title.includes('robots') || title.includes('h1'));

        const family = isQuickWin ? 'quick_wins' : opportunityFamilyFromRaw(issue);
        opportunities.push({
            kind: 'gap',
            family,
            title: issue.title || issue.description || 'Opportunité d\'amélioration',
            detected: issue.evidence_summary || issue.description || 'Signal manquant ou incomplet détecté.',
            why: issue.description || 'Ce signal manque aujourd\'hui et limite la lecture par les moteurs & IA.',
            action: issue.recommended_fix || 'À corriger dans la prochaine itération on-page.',
            expectedImpact: guessImpactForFamily(family, effort),
            effort,
            priority,
            dimension: issue.dimension || null,
            provenance: issue.provenance || 'observed',
        });
    }

    // Strengths → confirmations that can be pushed further.
    for (const strength of strengths) {
        const family = opportunityFamilyFromRaw(strength);
        const actionByFamily = {
            seo: 'Capitaliser : étendre ce signal aux pages clés pour consolider le socle SEO.',
            geo: 'Capitaliser : transformer en bloc citable / FAQ / schéma structuré pour accélérer la réponse IA.',
            content: 'Capitaliser : rédiger des blocs jumeaux (FAQ, listicles, HowTo) sur les intentions voisines.',
            trust: 'Capitaliser : exposer cette preuve plus haut (homepage, pages services).',
            quick_wins: 'Confirmer la persistance du signal et passer au gain suivant.',
        };
        opportunities.push({
            kind: 'lever',
            family,
            title: strength.title || 'Signal positif observé',
            detected: strength.evidence_summary || strength.description || 'Preuve observée côté scan.',
            why: `Un signal exploitable existe déjà — il peut être amplifié pour pousser ${family === 'geo' ? 'la lecture IA' : family === 'trust' ? 'la confiance' : 'le score'} plus haut.`,
            action: actionByFamily[family] || actionByFamily.seo,
            expectedImpact: 'moyen',
            effort: 'moyen',
            priority: 'medium',
            dimension: strength.dimension || null,
            provenance: strength.provenance || 'observed',
        });
    }

    const FAMILY_META = [
        {
            key: 'quick_wins',
            label: 'Gains rapides',
            description: 'Correctifs à faible effort et impact mesurable sur le score.',
            accent: 'border-emerald-400/25 bg-emerald-500/[0.04]',
            accentText: 'text-emerald-300',
        },
        {
            key: 'seo',
            label: 'Opportunités SEO',
            description: 'Consolidation du socle organique : lisibilité technique & identité.',
            accent: 'border-sky-400/25 bg-sky-500/[0.03]',
            accentText: 'text-sky-300',
        },
        {
            key: 'geo',
            label: 'Opportunités GEO / IA',
            description: 'Réponse IA, ancrage local et signaux de découverte.',
            accent: 'border-violet-400/25 bg-violet-500/[0.04]',
            accentText: 'text-violet-300',
        },
        {
            key: 'content',
            label: 'Contenu & citation',
            description: 'Blocs prêts à citer, pages à enrichir, extractabilité.',
            accent: 'border-amber-400/20 bg-amber-500/[0.03]',
            accentText: 'text-amber-300',
        },
        {
            key: 'trust',
            label: 'Confiance & entité',
            description: 'Preuves sociales, avis, entité de marque, crédibilité.',
            accent: 'border-rose-400/20 bg-rose-500/[0.03]',
            accentText: 'text-rose-300',
        },
    ];

    const families = FAMILY_META.map((meta) => ({
        ...meta,
        items: opportunities
            .filter((o) => o.family === meta.key)
            .sort((a, b) => {
                const ka = SEVERITY_RANK[a.priority] ?? 5;
                const kb = SEVERITY_RANK[b.priority] ?? 5;
                return ka - kb;
            }),
    })).filter((family) => family.items.length > 0);

    return {
        hasAny: opportunities.length > 0,
        families,
        totals: { total: opportunities.length },
    };
}

/* =========================================================================
 * CITABILITY MODEL — from passive display to rewrite priorities
 *
 * Opérateurs veulent savoir :
 *   - quels blocs sont prêts à être cités ?
 *   - quels blocs faut-il réécrire en priorité ?
 *   - pourquoi ces blocs sont faibles (quel sous-score tire vers le bas) ?
 *   - quel type de réécriture ferait monter le score ?
 * ========================================================================= */

const SUBSCORE_LABELS = {
    specificity: 'spécificité',
    self_containment: 'autonomie',
    answer_density: 'densité de réponse',
    factual_density: 'densité factuelle',
};

const REWRITE_HINTS = {
    specificity: 'Ajouter des chiffres, noms propres et termes métier concrets.',
    self_containment: 'Rendre le bloc auto-suffisant — éviter les pronoms et les renvois implicites à d\'autres paragraphes.',
    answer_density: 'Formuler une réponse directe à une question claire dès la première phrase.',
    factual_density: 'Enrichir de faits vérifiables : dates, lieux, labels, chiffres, sources.',
};

function identifyWeakestSubScore(block) {
    const sub = block?.sub_scores || {};
    const entries = Object.entries(sub).filter(([, v]) => Number.isFinite(v));
    if (entries.length === 0) return null;
    entries.sort((a, b) => a[1] - b[1]);
    const [key, value] = entries[0];
    return { key, value, label: SUBSCORE_LABELS[key] || key, hint: REWRITE_HINTS[key] || null };
}

export function getCitabilityActionableModel(audit) {
    if (!audit) return { hasAny: false };

    const pageSummaries = toArray(audit?.extracted_data?.page_summaries);
    const allBlocks = [];
    for (const page of pageSummaries) {
        for (const block of toArray(page?.citability?.top_blocks)) {
            if (block && Number.isFinite(block.citability_score)) {
                allBlocks.push({ ...block, page_url: block.page_url || page.url || null });
            }
        }
    }

    if (allBlocks.length === 0) {
        return {
            hasAny: false,
            allBlocks: [],
            ready: [],
            close: [],
            rewrite: [],
            pages: [],
            stats: { totalBlocks: 0 },
        };
    }

    const ready = allBlocks
        .filter((b) => b.citability_score >= 60)
        .sort((a, b) => b.citability_score - a.citability_score)
        .slice(0, 5);

    const close = allBlocks
        .filter((b) => b.citability_score >= 40 && b.citability_score < 60)
        .sort((a, b) => b.citability_score - a.citability_score)
        .slice(0, 5)
        .map((block) => ({ ...block, _weakest: identifyWeakestSubScore(block) }));

    const rewrite = allBlocks
        .filter((b) => b.citability_score < 40)
        .sort((a, b) => a.citability_score - b.citability_score)
        .slice(0, 5)
        .map((block) => ({ ...block, _weakest: identifyWeakestSubScore(block) }));

    // Page-level ranking: pages with the most weak blocks and low page_score.
    const pageMap = new Map();
    for (const page of pageSummaries) {
        const cit = page?.citability;
        if (!cit) continue;
        pageMap.set(page.url, {
            url: page.url,
            pageScore: cit.page_score ?? null,
            totalBlocks: cit.block_count || 0,
            highBlocks: cit.high_citability_count || 0,
            lowBlocks: cit.low_citability_count || 0,
        });
    }

    const pages = Array.from(pageMap.values())
        .sort((a, b) => (b.lowBlocks - a.lowBlocks) || ((a.pageScore ?? 100) - (b.pageScore ?? 100)))
        .slice(0, 4);

    const scores = allBlocks.map((b) => b.citability_score).filter((n) => Number.isFinite(n));
    const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;

    return {
        hasAny: true,
        allBlocks,
        ready,
        close,
        rewrite,
        pages,
        stats: {
            totalBlocks: allBlocks.length,
            readyCount: ready.length,
            closeCount: close.length,
            rewriteCount: rewrite.length,
            avgScore: avg,
        },
    };
}
