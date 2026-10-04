import { finiteNumberOrNull } from '../numbers.js';

/**
 * KPI Core — Pure derivation functions.
 * No DB access, no side effects. Every function is independently testable.
 */

export function kpi(value, sourceType, confidence, warnings = []) {
    return { value, sourceType, confidence, warnings, status: value === null ? 'unavailable' : 'available' };
}

/**
 * Shared entity bucketing — single loop, reusable everywhere.
 */
export function bucketMentionsByType(mentionRows) {
    const sources = [];
    const competitors = [];
    const generics = [];
    const targets = [];

    for (const m of mentionRows || []) {
        const et = m.entity_type || 'business';
        if (et === 'source') {
            sources.push(m);
        } else if (et === 'competitor') {
            competitors.push(m);
        } else if (m.is_target === true) {
            targets.push(m);
        } else if (et === 'generic_mention' || et === 'business') {
            generics.push(m);
        }
    }

    return { sources, competitors, generics, targets };
}

export function deriveAuditMetrics(latestAudit) {
    if (!latestAudit) {
        return {
            seoScore: kpi(null, 'observed', 'low', ['Aucun audit disponible.']),
            geoScore: kpi(null, 'observed', 'low', ['Aucun audit disponible.']),
            lastAuditAt: kpi(null, 'observed', 'low'),
            strengths: [],
            issues: [],
            llmStatus: 'none',
        };
    }

    const llmStatus =
        latestAudit.seo_breakdown?.overall?.llm_status || latestAudit.geo_breakdown?.overall?.llm_status || 'unknown';

    const warnings = [];
    if (llmStatus === 'failed') warnings.push('Analyse LLM indisponible, score déterministe uniquement.');
    if (llmStatus === 'skipped') warnings.push('Analyse LLM non exécutée.');

    return {
        seoScore: kpi(
            finiteNumberOrNull(latestAudit.seo_score),
            'observed',
            finiteNumberOrNull(latestAudit.seo_score) !== null ? 'high' : 'low',
            warnings,
        ),
        geoScore: kpi(
            finiteNumberOrNull(latestAudit.geo_score),
            'observed',
            finiteNumberOrNull(latestAudit.geo_score) !== null ? 'high' : 'low',
            warnings,
        ),
        lastAuditAt: kpi(latestAudit.created_at ?? null, 'observed', 'high'),
        strengths: latestAudit.strengths || [],
        issues: latestAudit.issues || [],
        llmStatus,
    };
}

export function deriveRunMetrics(completedRuns, { totalQueryRuns = 0, brandRecommendations = 0 } = {}) {
    const tq = totalQueryRuns;
    const br = brandRecommendations;

    const visibilityProxyPercent =
        typeof tq === 'number' && typeof br === 'number' && tq > 0 ? Math.round((br / tq) * 100) : null;
    const reliability = tq >= 10 ? 'high' : tq >= 5 ? 'medium' : tq > 0 ? 'low' : null;

    const runsByProvider = {};
    const modelAgg = new Map();
    let parseConfidenceSum = 0;
    let parseConfidenceCount = 0;
    let parseFailedCount = 0;

    for (const r of completedRuns || []) {
        const pk = r.provider || 'unknown';
        runsByProvider[pk] = (runsByProvider[pk] || 0) + 1;

        const mk = `${r.provider || 'unknown'}|||${r.model || 'unknown'}`;
        if (!modelAgg.has(mk)) {
            modelAgg.set(mk, {
                provider: r.provider || 'unknown',
                model: r.model || 'unknown',
                runs: 0,
                targetFound: 0,
                sources: 0,
            });
        }
        const row = modelAgg.get(mk);
        row.runs += 1;
        if (r.target_found) row.targetFound += 1;

        if (typeof r.parse_confidence === 'number' && Number.isFinite(r.parse_confidence)) {
            parseConfidenceSum += r.parse_confidence;
            parseConfidenceCount += 1;
        }
        if (r.parse_status === 'parsed_failed' || r.parse_status === 'error') {
            parseFailedCount += 1;
        }
    }

    const modelPerformance = [...modelAgg.values()]
        .map((row) => ({
            ...row,
            targetRatePercent: row.runs > 0 ? Math.round((row.targetFound / row.runs) * 100) : 0,
        }))
        .sort((a, b) => b.runs - a.runs);

    const avgParseConfidence =
        parseConfidenceCount > 0 ? Math.round((parseConfidenceSum / parseConfidenceCount) * 100) / 100 : null;

    const totalCompleted = (completedRuns || []).length;
    const parseFailureRate = totalCompleted > 0 ? Math.round((parseFailedCount / totalCompleted) * 100) : null;

    return {
        totalQueryRuns: kpi(tq, 'observed', 'high'),
        visibilityProxyPercent: kpi(
            visibilityProxyPercent,
            'derived',
            reliability || 'low',
            tq < 5 && tq > 0 ? ['Proxy basé sur un volume insuffisant.'] : [],
        ),
        visibilityProxyReliability: reliability,
        runsByProvider,
        modelPerformance,
        sampleSizeWarning: tq > 0 && tq < 5,
        avgParseConfidence: kpi(avgParseConfidence, 'derived', parseConfidenceCount >= 5 ? 'high' : 'low'),
        parseFailureRate: kpi(parseFailureRate, 'derived', totalCompleted >= 5 ? 'high' : 'low'),
    };
}

export function deriveMentionMetrics(mentionRows, completedRuns = []) {
    const {
        sources: sourceBucket,
        competitors: competitorBucket,
        generics: genericBucket,
        targets: targetBucket,
    } = bucketMentionsByType(mentionRows);

    const confirmedCompetitors = competitorBucket.length;
    const genericMentions = genericBucket.length;
    const sourceMentions = sourceBucket.length;
    const brandTargetMentions = targetBucket.length;

    let externalSources = 0;
    const sourceHosts = new Map();
    const sourceMentionsByDay = new Map();
    const runsWithSource = new Set();

    for (const m of sourceBucket) {
        if (m.source_type !== 'client_own') externalSources += 1;
        if (m.query_run_id) runsWithSource.add(m.query_run_id);
        if (m.created_at) {
            const d = String(m.created_at).slice(0, 10);
            sourceMentionsByDay.set(d, (sourceMentionsByDay.get(d) || 0) + 1);
        }
        const host = (m.normalized_domain || m.business_name || '').replace(/^https?:\/\//, '').split('/')[0];
        if (host) sourceHosts.set(host, (sourceHosts.get(host) || 0) + 1);
    }

    const confirmedCompetitorNames = new Map();
    for (const m of competitorBucket) {
        const name = m.normalized_label || m.business_name || 'Inconnu';
        confirmedCompetitorNames.set(name, (confirmedCompetitorNames.get(name) || 0) + 1);
    }

    const genericMentionNames = new Map();
    for (const m of genericBucket) {
        const name = m.normalized_label || m.business_name || 'Inconnu';
        genericMentionNames.set(name, (genericMentionNames.get(name) || 0) + 1);
    }

    const totalRuns = completedRuns.length;
    const runsWithSourceCount = runsWithSource.size;
    const citationCoverage = totalRuns > 0 ? Math.round((runsWithSourceCount / totalRuns) * 100) : null;
    const avgSourcePerRun = totalRuns > 0 ? Math.round((externalSources / totalRuns) * 10) / 10 : null;
    const citationReliability = totalRuns >= 10 ? 'high' : totalRuns >= 5 ? 'medium' : totalRuns > 0 ? 'low' : null;

    const topSources = [...sourceHosts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([host, count]) => ({ host, count }));

    const topCompetitors = [...confirmedCompetitorNames.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([name, count]) => ({ name, count }));

    const topGenericMentions = [...genericMentionNames.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

    const sourceMentionsTimeline = [...sourceMentionsByDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

    return {
        confirmedCompetitorMentions: kpi(confirmedCompetitors, 'observed', 'high'),
        genericMentions: kpi(
            genericMentions,
            'observed',
            'medium',
            genericMentions > 0 ? ['Mentions non confirmées comme concurrents.'] : [],
        ),
        sourceMentions: kpi(sourceMentions, 'observed', 'high'),
        externalSourceMentions: kpi(externalSources, 'derived', 'high'),
        brandTargetMentions: kpi(brandTargetMentions, 'observed', 'high'),
        uniqueSourceHosts: sourceHosts.size,
        topSources,
        topCompetitors,
        topGenericMentions,
        sourceMentionsTimeline,
        runsWithSourceCitation: runsWithSourceCount,
        citationCoveragePercent: kpi(
            citationCoverage,
            'derived',
            citationReliability || 'low',
            totalRuns > 0 && totalRuns < 5 ? ['Volume insuffisant pour une couverture fiable.'] : [],
        ),
        avgSourceMentionsPerRun: kpi(avgSourcePerRun, 'derived', citationReliability || 'low'),
    };
}

export function derivePromptMetrics(trackedQueries, lastRunMap) {
    const total = (trackedQueries || []).length;
    let withTargetFound = 0;
    let withRunNoTarget = 0;
    let noRunYet = 0;

    for (const t of trackedQueries || []) {
        const lr = lastRunMap instanceof Map ? lastRunMap.get(t.id) : null;
        if (!lr) noRunYet += 1;
        else if (lr.target_found) withTargetFound += 1;
        else withRunNoTarget += 1;
    }

    const mentionRate = total > 0 ? Math.round((withTargetFound / total) * 100) : null;

    return {
        total: kpi(total, 'observed', 'high'),
        active: (trackedQueries || []).filter((t) => t.is_active !== false).length,
        withTargetFound,
        withRunNoTarget,
        noRunYet,
        mentionRatePercent: kpi(
            mentionRate,
            'derived',
            total >= 5 ? 'medium' : 'low',
            total > 0 && total < 5 ? ['Faible nombre de prompts suivis.'] : [],
        ),
    };
}

export function buildGeoKpiSnapshot({
    audit,
    runs,
    mentions,
    prompts,
    counts,
    lastRunAt,
    citationDiagnosticHistogram = null,
}) {
    const guardrails = computeGuardrails({ audit, runs, mentions, prompts, citationDiagnosticHistogram });

    return { audit, runs, mentions, prompts, counts, lastRunAt, guardrails };
}

/**
 * Agrège zero_citation_reason sur les runs récents (raw_analysis.diagnostics).
 * @param {Array<{ raw_analysis?: object }>} runRows
 */
export function deriveCitationDiagnosticHistogram(runRows = []) {
    const counts = {};
    for (const row of runRows || []) {
        const reason = row?.raw_analysis?.diagnostics?.zero_citation_reason;
        if (!reason) continue;
        counts[reason] = (counts[reason] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
        counts,
        dominant: sorted[0]?.[0] || null,
        dominantCount: sorted[0]?.[1] || 0,
        sampleWithReason: sorted.reduce((acc, [, n]) => acc + n, 0),
    };
}

export function computeGuardrails({ audit, runs, mentions, prompts, citationDiagnosticHistogram = null }) {
    const warnings = [];
    const tq = runs?.totalQueryRuns?.value ?? null;

    if (tq === 0) {
        warnings.push({
            code: 'NO_RUNS',
            message: 'Aucune exécution complétée. Lancez les prompts suivis.',
            severity: 'info',
        });
    } else if (tq !== null && tq < 5) {
        warnings.push({
            code: 'LOW_SAMPLE_SIZE',
            message: `Seulement ${tq} exécution(s), les tendances ne sont pas fiables.`,
            severity: 'warning',
        });
    }

    const extSrcVal = mentions?.externalSourceMentions?.value ?? null;
    if (tq > 0 && extSrcVal === 0) {
        let detail =
            'Le produit ne matérialise une “citation” que lorsqu’une URL externe apparaît dans la réponse brute. Si le modèle répond sans liens, la couverture citation reste à 0 même si le run est “terminé”.';
        const dom = citationDiagnosticHistogram?.dominant;
        const domCount = citationDiagnosticHistogram?.dominantCount ?? 0;
        const sample = citationDiagnosticHistogram?.sampleWithReason ?? 0;
        if (dom && domCount >= 2 && sample >= Math.min(3, tq)) {
            if (dom === 'non_grounded_lane') {
                detail +=
                    ' Sur les runs récents, la cause dominante ressemble à une réponse sans liens / non ancrée web.';
            } else if (dom === 'no_source_detected') {
                detail += ' Sur les runs récents, la cause dominante est l’absence d’URL exploitable dans le texte.';
            }
        }
        warnings.push({
            code: 'NO_SOURCES',
            message: `Aucune citation source externe capturée sur ${tq} exécution(s). ${detail}`,
            severity: 'warning',
        });
    }

    const cc = mentions?.confirmedCompetitorMentions?.value ?? null;
    const gm = mentions?.genericMentions?.value ?? null;
    if (tq >= 5 && cc === 0 && gm > 3) {
        warnings.push({
            code: 'UNCONFIRMED_COMPETITORS',
            message: `${gm} mentions génériques non confirmées. Ajoutez des concurrents connus au profil.`,
            severity: 'warning',
        });
    }

    if (audit?.llmStatus === 'failed') {
        warnings.push({
            code: 'LLM_DEGRADED',
            message: 'Analyse LLM en échec, scores déterministes uniquement.',
            severity: 'warning',
        });
    }

    if (
        [audit?.seoScore?.value, audit?.geoScore?.value].every((value) => value === null || value === undefined) &&
        audit?.seoScore?.warnings?.includes('Aucun audit disponible.')
    ) {
        warnings.push({
            code: 'NO_AUDIT',
            message: 'Aucun audit. Lancez un audit pour obtenir les scores.',
            severity: 'info',
        });
    }

    const promptTotal = prompts?.total?.value ?? null;
    if (promptTotal === 0) {
        warnings.push({
            code: 'NO_PROMPTS',
            message: 'Aucun prompt suivi. Ajoutez des prompts pour alimenter le moteur.',
            severity: 'info',
        });
    }

    const avgPc = runs?.avgParseConfidence?.value;
    if (typeof avgPc === 'number' && avgPc < 0.5) {
        warnings.push({
            code: 'LOW_PARSE_CONFIDENCE',
            message: `Confiance d'extraction moyenne faible (${avgPc}). Les données extraites sont peu fiables.`,
            severity: 'warning',
        });
    }

    const failRate = runs?.parseFailureRate?.value;
    if (typeof failRate === 'number' && failRate > 30) {
        warnings.push({
            code: 'HIGH_PARSE_FAILURE',
            message: `${failRate}% des exécutions ont échoué au parsing. Vérifiez la qualité des réponses.`,
            severity: 'warning',
        });
    }

    return warnings;
}

export function enrichModelPerformanceWithSources(modelPerformance, mentionRows, completedRuns) {
    const runById = new Map((completedRuns || []).map((r) => [r.id, r]));
    const sourcesByModel = new Map();

    for (const m of mentionRows || []) {
        if (m.entity_type !== 'source') continue;
        const run = runById.get(m.query_run_id);
        if (!run) continue;
        const key = `${run.provider || 'unknown'}|||${run.model || 'unknown'}`;
        sourcesByModel.set(key, (sourcesByModel.get(key) || 0) + 1);
    }

    return (modelPerformance || []).map((row) => {
        const key = `${row.provider}|||${row.model}`;
        return { ...row, sources: sourcesByModel.get(key) || 0 };
    });
}

export function flattenSnapshotToLegacy(snapshot, latestAuditRow) {
    const { audit, runs, mentions, prompts, counts, lastRunAt, guardrails } = snapshot;

    return {
        status: snapshot.status ?? 'available',
        sources: snapshot.sources ?? {},
        errors: snapshot.errors ?? [],
        latestAudit: latestAuditRow || null,
        lastAuditAt: audit?.lastAuditAt?.value ?? null,
        lastGeoRunAt: lastRunAt ?? null,
        openOpportunities: counts?.openOpportunities ?? null,
        pendingMerge: counts?.pendingMerge ?? null,
        activeTrackedQueries: counts?.activeTrackedQueries ?? null,
        totalTrackedQueries: counts?.totalTrackedQueries ?? null,
        totalQueryRuns: runs?.totalQueryRuns?.value ?? null,
        brandRecommendationRuns: counts?.brandRecommendations ?? null,
        competitorMentions: mentions?.confirmedCompetitorMentions?.value ?? null,
        genericMentions: mentions?.genericMentions?.value ?? null,
        sourceMentions: mentions?.sourceMentions?.value ?? null,
        externalSourceMentions: mentions?.externalSourceMentions?.value ?? null,
        uniqueSourceHosts: mentions?.uniqueSourceHosts ?? null,
        brandTargetMentions: mentions?.brandTargetMentions?.value ?? null,
        topSources: mentions?.topSources ?? null,
        sourceMentionsTimeline: mentions?.sourceMentionsTimeline ?? null,
        runsByProvider: runs?.runsByProvider ?? null,
        visibilityProxyPercent: runs?.visibilityProxyPercent?.value ?? null,
        visibilityProxyReliability: runs?.visibilityProxyReliability ?? null,
        avgSourceMentionsPerRun: mentions?.avgSourceMentionsPerRun?.value ?? null,
        runsWithSourceCitation: mentions?.runsWithSourceCitation ?? null,
        citationCoveragePercent: mentions?.citationCoveragePercent?.value ?? null,
        trackedPromptStats: {
            total: prompts?.total?.value ?? null,
            withTargetFound: prompts?.withTargetFound ?? null,
            withRunNoTarget: prompts?.withRunNoTarget ?? null,
            noRunYet: prompts?.noRunYet ?? null,
            mentionRatePercent: prompts?.mentionRatePercent?.value ?? null,
        },
        modelPerformance: runs?.modelPerformance ?? null,
        avgParseConfidence: runs?.avgParseConfidence?.value ?? null,
        parseFailureRate: runs?.parseFailureRate?.value ?? null,
        strengths: audit?.strengths ?? null,
        issues: audit?.issues ?? null,
        seoScore: audit?.seoScore?.value ?? null,
        geoScore: audit?.geoScore?.value ?? null,
        guardrails: guardrails ?? null,
    };
}

export function buildLastRunMap(completedRuns) {
    const map = new Map();
    const sorted = [...(completedRuns || [])].sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
    );
    for (const r of sorted) {
        if (r.tracked_query_id && !map.has(r.tracked_query_id)) {
            map.set(r.tracked_query_id, r);
        }
    }
    return map;
}
