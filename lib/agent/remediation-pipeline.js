const PROVENANCE_META = Object.freeze({
    observed: {
        key: 'observed',
        label: 'Observé',
        shortLabel: 'Observé',
        description: 'Observé directement dans les données du mandat.',
        tone: 'emerald',
    },
    derived: {
        key: 'derived',
        label: 'Dérivé',
        shortLabel: 'Dérivé',
        description: 'Calculé de façon déterministe à partir des signaux observés.',
        tone: 'violet',
    },
    inferred: {
        key: 'inferred',
        label: 'Inféré',
        shortLabel: 'Inféré',
        description: 'Inféré depuis les signaux disponibles.',
        tone: 'amber',
    },
});

function getProvenanceMeta(value) {
    return PROVENANCE_META[value] || PROVENANCE_META.derived;
}

const PRIORITY_ORDER = Object.freeze({ high: 0, medium: 1, low: 2 });
const STATUS_ORDER = Object.freeze({
    open: 0,
    in_progress: 1,
    needs_review: 2,
    pending: 3,
    draft: 4,
    done: 5,
    dismissed: 6,
});
const SOURCE_ORDER = Object.freeze({
    opportunity: 0,
    readiness: 1,
    actionability: 2,
    protocols: 3,
    visibility: 4,
    review: 5,
    score_guardrail: 6,
});

const SUBSCORE_KEYS = ['visibility', 'readiness', 'actionability', 'advanced_protocols'];
const SUBSCORE_LABELS = Object.freeze({
    visibility: 'Visibilité',
    readiness: 'Préparation',
    actionability: 'Actionnabilité',
    advanced_protocols: 'Protocoles',
});

const ACTIONABILITY_PRIORITY_BY_DIMENSION = Object.freeze({
    offer_clarity: 'high',
    contact_booking: 'high',
    local_coverage: 'medium',
    trust_proof: 'medium',
    content_actionability: 'low',
});

const PROTOCOL_PRIORITY_BY_DIMENSION = Object.freeze({
    llms_txt: 'high',
    schema_entity: 'high',
    crawler_access: 'medium',
    ai_discovery: 'low',
});

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function safeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizePriority(value) {
    const normalized = safeText(value).toLowerCase();
    if (normalized === 'high') return 'high';
    if (normalized === 'low') return 'low';
    return 'medium';
}

function normalizeStatus(value) {
    const normalized = safeText(value).toLowerCase();
    if (['in_progress', 'in progress', 'en_cours', 'en cours'].includes(normalized)) return 'in_progress';
    if (['needs_review', 'review', 'to_review', 'pending', 'draft'].includes(normalized)) return 'needs_review';
    if (['done', 'resolved', 'closed'].includes(normalized)) return 'done';
    if (['dismissed', 'ignored', 'rejected'].includes(normalized)) return 'dismissed';
    return 'open';
}

function statusRank(status) {
    return STATUS_ORDER[status] ?? 99;
}

function priorityRank(priority) {
    return PRIORITY_ORDER[priority] ?? 99;
}

function sourceRank(source) {
    return SOURCE_ORDER[source] ?? 99;
}

function priorityFromScore(score) {
    if (!isFiniteNumber(score)) return 'high';
    if (score < 40) return 'high';
    if (score < 75) return 'medium';
    return 'low';
}

function priorityFromReadinessStatus(status) {
    const normalized = safeText(status).toLowerCase();
    if (normalized.includes('bloqu') || normalized === 'absent') return 'high';
    if (normalized.includes('partiel') || normalized.includes('confirmer')) return 'medium';
    return 'low';
}

function compareFixes(a, b) {
    const pa = priorityRank(a.priority);
    const pb = priorityRank(b.priority);
    if (pa !== pb) return pa - pb;

    const sa = statusRank(a.status);
    const sb = statusRank(b.status);
    if (sa !== sb) return sa - sb;

    const sourceA = sourceRank(a.source);
    const sourceB = sourceRank(b.source);
    if (sourceA !== sourceB) return sourceA - sourceB;

    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

function normalizeFixItem(item = {}) {
    const linkedSubscores = Array.isArray(item.linkedSubscores)
        ? [...new Set(item.linkedSubscores.filter(Boolean))]
        : [];
    const category = safeText(item.category);
    const title = safeText(item.title) || 'Action à traiter';
    const fallbackKey = safeText(item.dedupeKey) || `${safeText(item.source || 'fix')}|${title.toLowerCase()}|${category.toLowerCase()}`;
    const fallbackId = `fix-${fallbackKey.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'item'}`;

    return {
        id: item.id || fallbackId,
        dedupeKey: fallbackKey,
        title,
        description: safeText(item.description) || null,
        category: category || 'agent',
        priority: normalizePriority(item.priority),
        status: normalizeStatus(item.status),
        source: safeText(item.source) || 'score_guardrail',
        created_at: item.created_at || null,
        provenance: item.provenance || getProvenanceMeta('derived'),
        linkedSubscores,
        dimensionKey: item.dimensionKey || null,
    };
}

function mergeFixes(existing, candidate) {
    const winner = compareFixes(existing, candidate) <= 0 ? existing : candidate;
    const other = winner === existing ? candidate : existing;

    return {
        ...winner,
        linkedSubscores: [...new Set([...(existing.linkedSubscores || []), ...(candidate.linkedSubscores || [])])],
        description: winner.description || other.description || null,
        provenance: winner.provenance || other.provenance || getProvenanceMeta('derived'),
        created_at: winner.created_at || other.created_at || null,
    };
}

function dedupeFixes(items = []) {
    const map = new Map();
    for (const raw of items) {
        const item = normalizeFixItem(raw);
        const key = item.dedupeKey;
        if (!map.has(key)) {
            map.set(key, item);
            continue;
        }
        map.set(key, mergeFixes(map.get(key), item));
    }
    return [...map.values()];
}

function mapReliabilityToProvenance(reliability) {
    const normalized = safeText(reliability).toLowerCase();
    if (['measured', 'observed'].includes(normalized)) return getProvenanceMeta('observed');
    if (normalized === 'inferred') return getProvenanceMeta('inferred');
    return getProvenanceMeta('derived');
}

function mapTruthClassToProvenance(truthClass) {
    const normalized = safeText(truthClass).toLowerCase();
    if (normalized === 'observed') return getProvenanceMeta('observed');
    if (normalized === 'inferred') return getProvenanceMeta('inferred');
    return getProvenanceMeta('derived');
}

function buildOpportunityFixes(opportunitySlice) {
    const active = [
        ...(opportunitySlice?.byStatus?.open || []),
        ...(opportunitySlice?.byStatus?.in_progress || []),
    ];

    return active.map((item, index) => ({
        id: `opportunity-${item.id || index}`,
        dedupeKey: `opportunity:${item.id || item.title || index}`,
        title: item.title || 'Opportunité à traiter',
        description: item.description || item.evidence_summary || item.recommended_fix || null,
        category: item.category || 'opportunité',
        priority: normalizePriority(item.priority),
        status: normalizeStatus(item.status),
        source: 'opportunity',
        created_at: item.created_at || null,
        provenance: item.provenance || mapTruthClassToProvenance(item.truth_class),
        linkedSubscores: [],
    }));
}

function buildReadinessFixes(readinessSlice) {
    const blockers = (readinessSlice?.topBlockers || [])
        .filter((item) => {
            const status = safeText(item?.status).toLowerCase();
            const title = safeText(item?.title).toLowerCase();
            return status !== 'couvert' && !title.includes('aucun blocage majeur');
        })
        .map((item, index) => ({
            id: `readiness-blocker-${index}`,
            dedupeKey: `readiness-blocker:${safeText(item.title).toLowerCase()}`,
            title: item.title || 'Blocage de préparation',
            description: item.detail || null,
            category: 'préparation',
            priority: priorityFromReadinessStatus(item.status),
            status: 'open',
            source: 'readiness',
            provenance: mapReliabilityToProvenance(item.reliability),
            linkedSubscores: ['readiness'],
        }));

    const recommendations = (readinessSlice?.recommendations || [])
        .filter((item) => !/aucun correctif prioritaire/i.test(safeText(item?.title)))
        .map((item, index) => ({
            id: `readiness-reco-${index}`,
            dedupeKey: `readiness-reco:${safeText(item.title).toLowerCase()}`,
            title: item.title || 'Recommandation de préparation',
            description: item.description || item.evidence || null,
            category: 'préparation',
            priority: /bloqu|critique/i.test(`${item.title || ''} ${item.description || ''}`) ? 'high' : 'medium',
            status: 'open',
            source: 'readiness',
            provenance: mapReliabilityToProvenance(item.reliability),
            linkedSubscores: ['readiness'],
        }));

    return [...blockers, ...recommendations];
}

function buildActionabilityFixes(report) {
    if (!report || report.available === false) return [];

    const fixesFromReport = (report.topFixes || []).map((item, index) => ({
        id: `actionability-top-${index}`,
        dedupeKey: `actionability-top:${item.dimensionKey || index}`,
        title: item.message || `Corriger ${item.dimensionLabel || 'la dimension'}`,
        description: item.dimensionLabel ? `Dimension: ${item.dimensionLabel}` : null,
        category: 'actionnabilité',
        priority: normalizePriority(item.priority || ACTIONABILITY_PRIORITY_BY_DIMENSION[item.dimensionKey]),
        status: 'open',
        source: 'actionability',
        provenance: mapReliabilityToProvenance(report.reliability),
        linkedSubscores: ['actionability'],
        dimensionKey: item.dimensionKey || null,
    }));

    const dimensionFixes = (report.dimensions || [])
        .filter((dimension) => safeText(dimension?.status).toLowerCase() !== 'couvert' && safeText(dimension?.topFix))
        .map((dimension) => ({
            id: `actionability-dimension-${dimension.key}`,
            dedupeKey: `actionability-dimension:${dimension.key}`,
            title: dimension.topFix,
            description: dimension.label ? `Dimension: ${dimension.label}` : null,
            category: 'actionnabilité',
            priority: normalizePriority(ACTIONABILITY_PRIORITY_BY_DIMENSION[dimension.key] || priorityFromScore(dimension.score)),
            status: 'open',
            source: 'actionability',
            provenance: mapReliabilityToProvenance(report.reliability),
            linkedSubscores: ['actionability'],
            dimensionKey: dimension.key || null,
        }));

    if (fixesFromReport.length > 0 || dimensionFixes.length > 0) {
        return [...fixesFromReport, ...dimensionFixes];
    }

    const weakest = [...(report.dimensions || [])]
        .filter((dimension) => isFiniteNumber(dimension?.score) && dimension.score < 100)
        .sort((a, b) => a.score - b.score)[0];

    if (!weakest) return [];
    const fallbackMessage = safeText(weakest.gaps?.[0]) || safeText(weakest.summary) || null;
    if (!fallbackMessage) return [];

    return [{
        id: `actionability-fallback-${weakest.key || 'global'}`,
        dedupeKey: `actionability-fallback:${weakest.key || 'global'}`,
        title: fallbackMessage,
        description: weakest.label ? `Dimension: ${weakest.label}` : null,
        category: 'actionnabilité',
        priority: priorityFromScore(weakest.score),
        status: 'open',
        source: 'actionability',
        provenance: mapReliabilityToProvenance(report.reliability),
        linkedSubscores: ['actionability'],
        dimensionKey: weakest.key || null,
    }];
}

function buildProtocolsFixes(report) {
    if (!report || report.available === false) return [];

    const fixesFromReport = (report.topFixes || []).map((item, index) => ({
        id: `protocols-top-${index}`,
        dedupeKey: `protocols-top:${item.dimensionKey || index}`,
        title: item.message || `Corriger ${item.dimensionLabel || 'la dimension'}`,
        description: item.dimensionLabel ? `Dimension: ${item.dimensionLabel}` : null,
        category: 'protocoles',
        priority: normalizePriority(item.priority || PROTOCOL_PRIORITY_BY_DIMENSION[item.dimensionKey]),
        status: 'open',
        source: 'protocols',
        provenance: mapReliabilityToProvenance(report.reliability),
        linkedSubscores: ['advanced_protocols'],
        dimensionKey: item.dimensionKey || null,
    }));

    const dimensionFixes = (report.dimensions || [])
        .filter((dimension) => safeText(dimension?.status).toLowerCase() !== 'couvert' && safeText(dimension?.topFix))
        .map((dimension) => ({
            id: `protocols-dimension-${dimension.key}`,
            dedupeKey: `protocols-dimension:${dimension.key}`,
            title: dimension.topFix,
            description: dimension.label ? `Dimension: ${dimension.label}` : null,
            category: 'protocoles',
            priority: normalizePriority(PROTOCOL_PRIORITY_BY_DIMENSION[dimension.key] || priorityFromScore(dimension.score)),
            status: 'open',
            source: 'protocols',
            provenance: mapReliabilityToProvenance(report.reliability),
            linkedSubscores: ['advanced_protocols'],
            dimensionKey: dimension.key || null,
        }));

    if (fixesFromReport.length > 0 || dimensionFixes.length > 0) {
        return [...fixesFromReport, ...dimensionFixes];
    }

    const weakest = [...(report.dimensions || [])]
        .filter((dimension) => isFiniteNumber(dimension?.score) && dimension.score < 100)
        .sort((a, b) => a.score - b.score)[0];

    if (!weakest) return [];
    const fallbackMessage = safeText(weakest.gaps?.[0]) || safeText(weakest.summary) || null;
    if (!fallbackMessage) return [];

    return [{
        id: `protocols-fallback-${weakest.key || 'global'}`,
        dedupeKey: `protocols-fallback:${weakest.key || 'global'}`,
        title: fallbackMessage,
        description: weakest.label ? `Dimension: ${weakest.label}` : null,
        category: 'protocoles',
        priority: priorityFromScore(weakest.score),
        status: 'open',
        source: 'protocols',
        provenance: mapReliabilityToProvenance(report.reliability),
        linkedSubscores: ['advanced_protocols'],
        dimensionKey: weakest.key || null,
    }];
}

function buildVisibilityFixes({ overviewSlice, score }) {
    const kpis = overviewSlice?.kpis || {};
    const trackedPromptsTotal = Number(kpis.trackedPromptsTotal || 0);
    const completedRunsTotal = Number(kpis.completedRunsTotal || 0);
    const mentionRate = isFiniteNumber(kpis.mentionRatePercent) ? kpis.mentionRatePercent : null;
    const visibilityProxy = isFiniteNumber(kpis.visibilityProxyPercent) ? kpis.visibilityProxyPercent : null;
    const citationCoverage = isFiniteNumber(kpis.citationCoveragePercent) ? kpis.citationCoveragePercent : null;
    const visibilityScore = score?.subscores?.visibility?.score;
    const fixes = [];

    if (trackedPromptsTotal === 0) {
        fixes.push({
            id: 'visibility-no-prompts',
            dedupeKey: 'visibility:no-prompts',
            title: 'Configurer des prompts suivis',
            description: 'Aucun prompt actif n’est suivi, la visibilité AGENT ne peut pas être mesurée.',
            category: 'visibilité',
            priority: 'high',
            status: 'open',
            source: 'visibility',
            provenance: getProvenanceMeta('observed'),
            linkedSubscores: ['visibility'],
        });
    } else if (completedRunsTotal === 0) {
        fixes.push({
            id: 'visibility-no-runs',
            dedupeKey: 'visibility:no-runs',
            title: 'Lancer des exécutions GEO sur les prompts actifs',
            description: 'Des prompts existent, mais aucune exécution complétée ne permet de calculer la visibilité réelle.',
            category: 'visibilité',
            priority: 'high',
            status: 'open',
            source: 'visibility',
            provenance: getProvenanceMeta('observed'),
            linkedSubscores: ['visibility'],
        });
    }

    const metrics = [
        {
            key: 'mention_rate',
            label: 'taux de mention',
            value: mentionRate,
            title: 'Améliorer le taux de mention de la cible',
            detail: mentionRate === null || mentionRate === undefined ? 'Aucune mesure de mention disponible.' : `Valeur actuelle: ${Math.round(mentionRate)}%.`,
        },
        {
            key: 'visibility_proxy',
            label: 'proxy de visibilité',
            value: visibilityProxy,
            title: 'Réduire l’écart de visibilité concurrentielle',
            detail: visibilityProxy === null || visibilityProxy === undefined ? 'Le proxy de visibilité est indisponible.' : `Valeur actuelle: ${Math.round(visibilityProxy)}%.`,
        },
        {
            key: 'citation_coverage',
            label: 'couverture des citations',
            value: citationCoverage,
            title: 'Augmenter la couverture de citations traçables',
            detail: citationCoverage === null || citationCoverage === undefined ? 'La couverture de citations est indisponible.' : `Valeur actuelle: ${Math.round(citationCoverage)}%.`,
        },
    ];

    const weakest = metrics
        .filter((item) => item.value === null || item.value === undefined || item.value < 100)
        .sort((a, b) => {
            const av = isFiniteNumber(a.value) ? a.value : -1;
            const bv = isFiniteNumber(b.value) ? b.value : -1;
            return av - bv;
        })[0];

    if (weakest) {
        fixes.push({
            id: `visibility-weak-${weakest.key}`,
            dedupeKey: `visibility-weak:${weakest.key}`,
            title: weakest.title,
            description: weakest.detail,
            category: 'visibilité',
            priority: priorityFromScore(weakest.value),
            status: 'open',
            source: 'visibility',
            provenance: getProvenanceMeta(isFiniteNumber(weakest.value) ? 'observed' : 'derived'),
            linkedSubscores: ['visibility'],
        });
    } else if (isFiniteNumber(visibilityScore) && visibilityScore < 100) {
        fixes.push({
            id: 'visibility-score-gap',
            dedupeKey: 'visibility:score-gap',
            title: 'Combler l’écart de visibilité AGENT',
            description: `Sous-score visibilité à ${visibilityScore}/100.`,
            category: 'visibilité',
            priority: priorityFromScore(visibilityScore),
            status: 'open',
            source: 'visibility',
            provenance: getProvenanceMeta('derived'),
            linkedSubscores: ['visibility'],
        });
    }

    return fixes;
}

function buildReviewFixes(opportunitySlice) {
    return (opportunitySlice?.reviewQueue || [])
        .slice(0, 8)
        .map((item, index) => ({
            id: `review-${item.id || index}`,
            dedupeKey: `review:${item.id || item.title || index}`,
            title: item.title || 'Élément à réviser',
            description: item.recommended_fix || item.evidence_summary || item.description || null,
            category: item.family || item.category || 'revue',
            priority: normalizePriority(item.severity || item.priority),
            status: 'needs_review',
            source: 'review',
            created_at: item.created_at || null,
            provenance: mapTruthClassToProvenance(item.truth_class),
            linkedSubscores: [],
        }));
}

function buildSubscoreGuardrailFixes(score, existingItems) {
    const coverage = new Set();
    for (const item of existingItems || []) {
        for (const key of item.linkedSubscores || []) {
            coverage.add(key);
        }
    }

    const guardrails = [];
    for (const key of SUBSCORE_KEYS) {
        const entry = score?.subscores?.[key];
        const currentScore = entry?.score;
        const missingScore = !isFiniteNumber(currentScore);
        const nonPerfectScore = isFiniteNumber(currentScore) && currentScore < 100;
        const needsFix = missingScore || nonPerfectScore;
        if (!needsFix || coverage.has(key)) continue;

        const label = SUBSCORE_LABELS[key] || key;
        const message = safeText(entry?.reason)
            || (missingScore
                ? `Le sous-score ${label} n’est pas calculable avec les données disponibles.`
                : `Le sous-score ${label} est à ${currentScore}/100.`);

        guardrails.push({
            id: `subscore-guardrail-${key}`,
            dedupeKey: `subscore-guardrail:${key}`,
            title: `Corriger l’écart ${label.toLowerCase()}`,
            description: message,
            category: 'cohérence AGENT',
            priority: missingScore ? 'high' : priorityFromScore(currentScore),
            status: 'open',
            source: 'score_guardrail',
            provenance: getProvenanceMeta('derived'),
            linkedSubscores: [key],
        });
    }

    return guardrails;
}

function countByPriority(items = []) {
    const byPriority = { high: 0, medium: 0, low: 0 };
    for (const item of items) {
        const key = normalizePriority(item.priority);
        byPriority[key] += 1;
    }
    return byPriority;
}

function countBySource(items = []) {
    const sourceCounts = {};
    for (const item of items) {
        const key = item.source || 'unknown';
        sourceCounts[key] = (sourceCounts[key] || 0) + 1;
    }
    return sourceCounts;
}

function collectSubscoreGaps(score) {
    return SUBSCORE_KEYS
        .map((key) => {
            const entry = score?.subscores?.[key];
            const value = entry?.score;
            if (isFiniteNumber(value) && value >= 100) return null;
            return {
                key,
                label: SUBSCORE_LABELS[key] || key,
                score: isFiniteNumber(value) ? value : null,
                reason: safeText(entry?.reason) || null,
            };
        })
        .filter(Boolean);
}

function computeCoverage(score, fixes = []) {
    const subscoreGaps = collectSubscoreGaps(score);
    const covered = new Set();
    for (const fix of fixes) {
        for (const key of fix.linkedSubscores || []) {
            covered.add(key);
        }
    }
    const uncoveredSubscores = subscoreGaps
        .filter((gap) => !covered.has(gap.key))
        .map((gap) => gap.key);

    return {
        hasKnownGaps: subscoreGaps.length > 0,
        subscoreGaps,
        uncoveredSubscores,
    };
}

export function buildAgentRemediationPipeline({
    opportunitySlice = null,
    readinessSlice = null,
    actionabilityReport = null,
    protocolsReport = null,
    overviewSlice = null,
    score = null,
} = {}) {
    const seedFixes = [
        ...buildOpportunityFixes(opportunitySlice),
        ...buildReadinessFixes(readinessSlice),
        ...buildActionabilityFixes(actionabilityReport),
        ...buildProtocolsFixes(protocolsReport),
        ...buildVisibilityFixes({ overviewSlice, score }),
        ...buildReviewFixes(opportunitySlice),
    ];

    const deduped = dedupeFixes(seedFixes);
    const guardrails = buildSubscoreGuardrailFixes(score, deduped);
    const allItems = dedupeFixes([...deduped, ...guardrails]).sort(compareFixes);

    const actionable = allItems.filter((item) => !['done', 'dismissed'].includes(item.status));
    const activeStatuses = actionable.filter((item) => ['open', 'in_progress'].includes(item.status));
    const byPriority = countByPriority(actionable);
    const bySource = countBySource(actionable);
    const coverage = computeCoverage(score, actionable);

    return {
        items: allItems,
        topFixes: actionable.slice(0, 12),
        byPriority,
        bySource,
        summary: {
            total: actionable.length,
            open: activeStatuses.filter((item) => item.status === 'open').length,
            inProgress: activeStatuses.filter((item) => item.status === 'in_progress').length,
            reviewQueue: actionable.filter((item) => item.status === 'needs_review').length,
            highPriorityOpen: activeStatuses.filter((item) => item.priority === 'high').length,
            derivedOpen: activeStatuses.filter((item) => item.source !== 'opportunity').length,
        },
        coverage,
    };
}

export function buildAgentFixesEmptyState({ opportunitySlice = null, remediation = null } = {}) {
    const hasFixes = Boolean(remediation?.topFixes?.length);
    if (hasFixes) return null;

    if (!opportunitySlice && !(remediation?.coverage?.hasKnownGaps)) {
        return {
            title: 'Correctifs d’exécution indisponibles',
            description: 'La file de remédiation n’est pas disponible pour ce mandat.',
        };
    }

    if (remediation?.coverage?.hasKnownGaps) {
        return {
            title: 'Correctifs en attente de synchronisation',
            description:
                'Des écarts sont détectés mais aucune action n’a encore été matérialisée. '
                + 'La remontée des problèmes vers la remédiation doit être vérifiée.',
        };
    }

    return {
        title: 'Aucun correctif prioritaire',
        description:
            'Aucune action ouverte, en cours ou en revue n’est détectée dans la fenêtre courante. '
            + 'Le pipeline est cohérent avec les signaux disponibles.',
    };
}

export function buildAgentMajorBlockers({ readinessSlice = null, remediation = null, limit = 4 } = {}) {
    const blockers = [];

    for (const item of readinessSlice?.topBlockers || []) {
        const status = safeText(item?.status).toLowerCase();
        const title = safeText(item?.title).toLowerCase();
        if (status === 'couvert' || title.includes('aucun blocage majeur')) continue;

        blockers.push({
            title: item.title || 'Blocage',
            detail: item.detail || null,
            status: item.status || 'bloqué',
            reliability: item.reliability || 'derived',
            source: 'readiness',
        });
    }

    for (const item of remediation?.topFixes || []) {
        if (item.priority !== 'high') continue;
        blockers.push({
            title: item.title,
            detail: item.description || null,
            status: 'bloqué',
            reliability: item.provenance?.key || 'derived',
            source: item.source,
        });
    }

    const deduped = [];
    const seen = new Set();
    for (const item of blockers) {
        const key = `${safeText(item.title).toLowerCase()}|${safeText(item.detail).toLowerCase()}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
        if (deduped.length >= limit) break;
    }

    if (deduped.length > 0) return deduped;

    return [{
        title: 'Aucun blocage majeur',
        detail: 'Les signaux observés ne montrent pas de blocage critique à traiter immédiatement.',
        status: 'couvert',
        reliability: 'calculated',
        source: 'derived',
    }];
}
