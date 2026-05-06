function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatDateTime(value) {
    if (!value) return 'Indisponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Indisponible';
    return parsed.toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatShortDate(value) {
    if (!value) return 'Indisponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Indisponible';
    return parsed.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
}

function formatRelativeTime(value) {
    if (!value) return 'Indisponible';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Indisponible';
    const diff = Date.now() - parsed.getTime();
    if (diff < 0) return formatDateTime(value);
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}j`;
    return formatDateTime(value);
}

function scoreStatus(score) {
    if (!isFiniteNumber(score)) return 'unavailable';
    if (score >= 75) return 'ok';
    if (score >= 55) return 'warning';
    return 'critical';
}

function labelForStatus(status) {
    if (status === 'ok') return 'Sain';
    if (status === 'warning') return 'Attention';
    if (status === 'critical') return 'Critique';
    return 'Indisponible';
}

function toneRank(status) {
    if (status === 'critical') return 3;
    if (status === 'warning') return 2;
    if (status === 'ok') return 1;
    return 0;
}

function getBasePaths(clientId) {
    if (!clientId) {
        return {
            clientBase: '/admin/clients',
            geoBase: '/admin/clients',
            seoBase: '/admin/clients',
            dossierBase: '/admin/clients',
        };
    }

    const clientBase = `/admin/clients/${clientId}`;
    return {
        clientBase,
        geoBase: `${clientBase}/geo`,
        seoBase: `${clientBase}/seo`,
        dossierBase: `${clientBase}/dossier`,
    };
}

function getRunStatus({ completedRunsTotal, trackedPromptsTotal, latestRunAt, parseFailureRate }) {
    if ((completedRunsTotal ?? 0) === 0 && (trackedPromptsTotal ?? 0) > 0) return 'critical';
    if ((completedRunsTotal ?? 0) === 0) return 'unavailable';

    const hoursSinceRun = latestRunAt
        ? Math.floor((Date.now() - new Date(latestRunAt).getTime()) / 3600000)
        : null;
    const parseRate = Number(parseFailureRate ?? 0);

    if ((hoursSinceRun !== null && hoursSinceRun > 72) || parseRate > 15) return 'critical';
    if ((hoursSinceRun !== null && hoursSinceRun > 24) || parseRate > 5) return 'warning';
    return 'ok';
}

function getAuditStatus(lastAuditAt, score) {
    if (!lastAuditAt && !isFiniteNumber(score)) return 'unavailable';
    const hoursSinceAudit = lastAuditAt
        ? Math.floor((Date.now() - new Date(lastAuditAt).getTime()) / 3600000)
        : null;
    if (hoursSinceAudit !== null && hoursSinceAudit > 24 * 60) return 'critical';
    if (hoursSinceAudit !== null && hoursSinceAudit > 24 * 30) return 'warning';
    return scoreStatus(score) === 'critical' ? 'warning' : 'ok';
}

function getGeoStatus(geoScore, mentionRatePercent, reliability) {
    if (!isFiniteNumber(geoScore) && !isFiniteNumber(mentionRatePercent)) return 'unavailable';
    if (reliability === 'low' || reliability === 'insufficient_data') return 'warning';
    if (isFiniteNumber(mentionRatePercent) && mentionRatePercent < 20) return 'critical';
    if (isFiniteNumber(mentionRatePercent) && mentionRatePercent < 40) return 'warning';
    return scoreStatus(geoScore);
}

function getGlobalStatus({ criticalWarnings, activeWarnings, noRunsYet, trackedPromptsTotal, runStatus, seoStatus, geoStatus }) {
    if (criticalWarnings.length > 0) {
        return {
            tone: 'critical',
            label: 'Mandat sous contrainte',
            summary: `${criticalWarnings.length} alerte${criticalWarnings.length > 1 ? 's' : ''} critique${criticalWarnings.length > 1 ? 's' : ''} demandent une action immédiate.`,
        };
    }

    if (noRunsYet && trackedPromptsTotal > 0) {
        return {
            tone: 'critical',
            label: 'Signal GEO absent',
            summary: 'Des prompts sont suivis mais aucun run n’a encore alimenté le poste de pilotage.',
        };
    }

    if (runStatus === 'critical' || seoStatus === 'critical' || geoStatus === 'critical') {
        return {
            tone: 'critical',
            label: 'Mandat à stabiliser',
            summary: 'Un signal cœur du mandat est dégradé et mérite une reprise rapide.',
        };
    }

    if (activeWarnings.length > 0 || runStatus === 'warning' || seoStatus === 'warning' || geoStatus === 'warning') {
        return {
            tone: 'warning',
            label: 'Mandat sous surveillance',
            summary: 'Le mandat avance, mais plusieurs signaux doivent être consolidés pour rester fiables.',
        };
    }

    return {
        tone: 'ok',
        label: 'Mandat en contrôle',
        summary: 'Les signaux principaux sont disponibles et aucun blocage majeur ne remonte dans la synthèse.',
    };
}

function toProviderLabel(item) {
    const provider = item?.provider || item?.source || null;
    const model = item?.model || null;
    if (provider && model) return `${provider} · ${model}`;
    return model || provider || 'Signal disponible';
}

function toSeriesColor(label) {
    if (label === 'SEO') return '#4ade80';
    if (label === 'GEO') return '#a78bfa';
    return '#60a5fa';
}

function buildTrend(recentAudits = [], recentQueryRuns = []) {
    const auditEntries = (recentAudits || [])
        .filter((entry) => entry?.created_at)
        .map((entry) => ({
            key: new Date(entry.created_at).toISOString().slice(0, 10),
            label: formatShortDate(entry.created_at),
            seo: isFiniteNumber(entry.seo_score) ? clamp(entry.seo_score, 0, 100) : null,
            geo: isFiniteNumber(entry.geo_score) ? clamp(entry.geo_score, 0, 100) : null,
        }));

    const runBuckets = new Map();
    for (const run of recentQueryRuns || []) {
        if (!run?.created_at) continue;
        const key = new Date(run.created_at).toISOString().slice(0, 10);
        const bucket = runBuckets.get(key) || { total: 0, hits: 0, label: formatShortDate(run.created_at) };
        bucket.total += 1;
        bucket.hits += run.target_found ? 1 : 0;
        runBuckets.set(key, bucket);
    }

    const dayKeys = Array.from(new Set([
        ...auditEntries.map((entry) => entry.key),
        ...runBuckets.keys(),
    ])).sort((left, right) => left.localeCompare(right));

    if (dayKeys.length < 2) {
        return {
            state: 'empty',
            title: 'Évolution du mandat',
            description: 'Pas assez d’historique observé pour tracer une évolution SEO, GEO ou visibilité.',
            labels: [],
            series: [],
        };
    }

    const labels = dayKeys.map((key) => {
        const fromAudit = auditEntries.find((entry) => entry.key === key)?.label;
        const fromRun = runBuckets.get(key)?.label;
        return fromAudit || fromRun || key;
    });

    const seoValues = dayKeys.map((key) => auditEntries.find((entry) => entry.key === key)?.seo ?? null);
    const geoValues = dayKeys.map((key) => auditEntries.find((entry) => entry.key === key)?.geo ?? null);
    const visibilityValues = dayKeys.map((key) => {
        const bucket = runBuckets.get(key);
        if (!bucket || bucket.total === 0) return null;
        return Math.round((bucket.hits / bucket.total) * 100);
    });

    const series = [
        { id: 'seo', label: 'SEO', color: toSeriesColor('SEO'), values: seoValues },
        { id: 'geo', label: 'GEO', color: toSeriesColor('GEO'), values: geoValues },
        { id: 'visibility', label: 'Visibilité', color: toSeriesColor('Visibilité'), values: visibilityValues },
    ].filter((entry) => entry.values.some((value) => isFiniteNumber(value)));

    if (series.length === 0 || series.every((entry) => entry.values.filter((value) => isFiniteNumber(value)).length < 2)) {
        return {
            state: 'empty',
            title: 'Évolution du mandat',
            description: 'Les historiques disponibles sont trop courts pour montrer une tendance lisible.',
            labels: [],
            series: [],
        };
    }

    return {
        state: 'ready',
        title: 'Évolution du mandat',
        description: 'Agrégation des audits observés et de la visibilité issue des runs GEO récents.',
        labels,
        series,
    };
}

function buildTimeline(recentActivity = [], geoBase, seoBase, dossierBase) {
    const items = (recentActivity || []).map((item) => {
        let href;
        if (item.type === 'audit') href = `${seoBase}/health`;
        else if (String(item.type).includes('tracked_query')) href = `${geoBase}/prompts`;
        else if (String(item.type).includes('publication')) href = `${dossierBase}/settings`;
        else href = `${geoBase}/runs`;

        return {
            id: item.id,
            title: item.title || 'Activité observée',
            description: item.description || 'Événement récent disponible dans le journal.',
            timestamp: item.created_at || null,
            relativeTime: formatRelativeTime(item.created_at),
            href,
            tone: item.type === 'audit' ? 'info' : 'neutral',
            provenanceLabel: item.provenance?.shortLabel || item.provenance?.label || 'Observé',
        };
    });

    return {
        title: 'Activité récente',
        description: 'Audits terminés, runs et actions opérateur observées dans le mandat.',
        items,
        empty: {
            title: 'Aucune activité récente partageable',
            description: 'Les audits, runs et changements opérateur visibles apparaîtront ici dès qu’ils seront observés.',
        },
    };
}

function buildEvidence({ guardrails, opportunities, sources, competitors, visibility, geoBase, seoBase }) {
    const items = [];

    for (const guardrail of guardrails || []) {
        items.push({
            id: `guardrail-${items.length}`,
            title: guardrail.message,
            summary: 'Preuve directement remontée par les garde-fous du workspace overview.',
            detail: 'Alerte observée dans la synthèse opérateur. Ouvrir le centre d’alertes pour inspecter le signal complet.',
            href: `${geoBase}/alerts`,
            tone: guardrail.severity === 'critical' || guardrail.severity === 'error' ? 'critical' : 'warning',
            meta: 'Observed',
        });
    }

    for (const opportunity of (opportunities?.openItems || []).slice(0, 2)) {
        items.push({
            id: opportunity.id || `opportunity-${items.length}`,
            title: opportunity.title,
            summary: opportunity.description || 'Opportunité ouverte dans la file priorisée.',
            detail: `Source ${opportunity.provenance?.shortLabel || opportunity.provenance?.label || 'disponible'} · priorité ${opportunity.priority || 'n.d.'}.`,
            href: `${geoBase}/opportunities`,
            tone: opportunity.priority === 'high' ? 'warning' : 'neutral',
            meta: opportunity.provenance?.shortLabel || opportunity.provenance?.label || 'Observed',
        });
    }

    const topHost = sources?.topHosts?.[0];
    if (topHost?.host) {
        items.push({
            id: 'host-top',
            title: `Source dominante: ${topHost.host}`,
            summary: 'Le slice overview expose déjà le principal hôte cité dans les réponses observées.',
            detail: `${topHost.count ?? 0} mention(s) source observée(s) sur la fenêtre récente.`,
            href: `${geoBase}/signals`,
            tone: 'info',
            meta: 'Observed',
        });
    }

    const topCompetitor = competitors?.topCompetitors?.[0];
    if (topCompetitor?.name) {
        items.push({
            id: 'competitor-top',
            title: `Concurrent dominant: ${topCompetitor.name}`,
            summary: 'Le workspace overview remonte déjà le concurrent le plus visible dans les mentions observées.',
            detail: `${topCompetitor.count ?? 0} apparition(s) recensée(s) dans la synthèse.`,
            href: `${geoBase}/signals?focus=competitors`,
            tone: 'warning',
            meta: 'Observed',
        });
    }

    const topModel = visibility?.topProvidersModels?.[0];
    if (topModel) {
        items.push({
            id: 'model-top',
            title: `Moteur dominant: ${toProviderLabel(topModel)}`,
            summary: 'Le workspace overview expose déjà les modèles les plus utilisés et leur taux de présence de marque.',
            detail: `${topModel.totalRuns ?? 0} run(s) · ${topModel.targetFoundRatePercent ?? 'n.d.'}% de détection.`,
            href: `${geoBase}/models`,
            tone: 'info',
            meta: 'Derived',
        });
    }

    if (!items.length) {
        items.push({
            id: 'evidence-empty',
            title: 'Aucune preuve détaillée disponible',
            summary: 'La synthèse overview ne remonte pas encore assez de détails pour peupler le panneau de preuve.',
            detail: 'Les prochaines alertes, opportunités observées et historiques de runs viendront enrichir cette zone.',
            href: `${seoBase}/health`,
            tone: 'neutral',
            meta: 'Unavailable',
        });
    }

    return {
        title: 'Zone de preuve',
        description: 'Les détails observés restent accessibles à la demande pour garder la page principale lisible.',
        items,
    };
}

function buildPriorityActions({ criticalWarnings, activeWarnings, noRunsYet, trackedPromptsTotal, parseFailureRate, visibilityReliability, opportunities, geoBase, seoBase, workspace }) {
    const actions = [];

    if ((criticalWarnings || []).length > 0) {
        actions.push({
            id: 'critical-guardrails',
            weight: 100,
            tone: 'critical',
            title: 'Traiter les alertes critiques du moteur',
            impact: 'Bloque la fiabilité du mandat si laissé en attente.',
            proof: `${criticalWarnings.length} alerte${criticalWarnings.length > 1 ? 's' : ''} critique${criticalWarnings.length > 1 ? 's' : ''} dans le workspace overview.`,
            href: `${geoBase}/alerts`,
        });
    }

    if (noRunsYet && trackedPromptsTotal > 0) {
        actions.push({
            id: 'first-runs',
            weight: 95,
            tone: 'critical',
            title: 'Lancer les premières exécutions suivies',
            impact: 'Sans run, aucun signal GEO ne peut guider la priorisation.',
            proof: `${trackedPromptsTotal} prompt(s) suivi(s), 0 run terminé dans la synthèse actuelle.`,
            href: `${geoBase}/prompts`,
        });
    }

    if (Number(parseFailureRate ?? 0) > 5) {
        actions.push({
            id: 'parse-quality',
            weight: 82,
            tone: 'warning',
            title: 'Réduire les échecs d’analyse des runs',
            impact: 'Les preuves remontées par le moteur deviennent moins fiables.',
            proof: `${parseFailureRate}% d’échec d’analyse signalé sur les runs observés.`,
            href: `${geoBase}/runs`,
        });
    }

    if (visibilityReliability === 'low' || visibilityReliability === 'insufficient_data') {
        actions.push({
            id: 'visibility-signal',
            weight: 76,
            tone: 'warning',
            title: 'Renforcer le signal de visibilité',
            impact: 'Les comparaisons restent indicatives tant que le signal est trop faible.',
            proof: `Fiabilité de visibilité ${visibilityReliability === 'insufficient_data' ? 'insuffisante' : 'faible'} dans le workspace overview.`,
            href: `${geoBase}/signals`,
        });
    }

    for (const opportunity of (opportunities?.openItems || []).slice(0, 3)) {
        actions.push({
            id: opportunity.id || `opportunity-${actions.length}`,
            weight: opportunity.priority === 'high' ? 80 : 60,
            tone: opportunity.priority === 'high' ? 'warning' : 'neutral',
            title: opportunity.title,
            impact: opportunity.description || 'Action déjà priorisée dans la file opportunités.',
            proof: `Opportunité ${opportunity.priority || 'active'} remontée par la synthèse opérateur.`,
            href: `${geoBase}/opportunities`,
        });
    }

    if ((activeWarnings || []).length > 0) {
        actions.push({
            id: 'seo-watch',
            weight: 58,
            tone: 'warning',
            title: 'Stabiliser les signaux SEO liés au mandat',
            impact: 'Les warnings actifs peuvent freiner la lecture fiable du mandat.',
            proof: `${activeWarnings.length} warning(s) actif(s) dans les garde-fous observés.`,
            href: `${seoBase}/health`,
        });
    }

    if (workspace?.latestAuditAt) {
        actions.push({
            id: 'audit-review',
            weight: 45,
            tone: 'info',
            title: 'Revoir les preuves du dernier audit',
            impact: 'Permet de relier les scores aux constats SEO / GEO les plus récents.',
            proof: `Dernier audit observé le ${formatDateTime(workspace.latestAuditAt)}.`,
            href: `${seoBase}/health`,
        });
    }

    const seen = new Set();
    return actions
        .sort((left, right) => right.weight - left.weight)
        .filter((item) => {
            if (seen.has(item.title)) return false;
            seen.add(item.title);
            return true;
        })
        .slice(0, 3);
}

function buildRiskItems({ seoScore, geoScore, mentionRatePercent, visibilityReliability, trackedPromptsTotal, completedRunsTotal, latestRunAt, parseFailureRate, lastAuditAt, geoBase, seoBase, dossierBase }) {
    const seo = scoreStatus(seoScore);
    const geo = getGeoStatus(geoScore, mentionRatePercent, visibilityReliability);
    const runs = getRunStatus({
        completedRunsTotal,
        trackedPromptsTotal,
        latestRunAt,
        parseFailureRate,
    });

    return [
        {
            id: 'seo',
            label: 'SEO',
            status: seo,
            statusLabel: labelForStatus(seo),
            metric: isFiniteNumber(seoScore) ? `${Math.round(seoScore)}/100` : 'n.d.',
            detail: lastAuditAt ? `Dernier audit ${formatRelativeTime(lastAuditAt)}` : 'Aucun audit récent exposé',
            href: `${seoBase}/health`,
        },
        {
            id: 'geo',
            label: 'GEO',
            status: geo,
            statusLabel: labelForStatus(geo),
            metric: isFiniteNumber(mentionRatePercent) ? `${Math.round(mentionRatePercent)}%` : (isFiniteNumber(geoScore) ? `${Math.round(geoScore)}/100` : 'n.d.'),
            detail: visibilityReliability ? `Fiabilité ${visibilityReliability}` : 'Fiabilité non exposée',
            href: `${geoBase}/signals`,
        },
        {
            id: 'social',
            label: 'Social / Community',
            status: 'unavailable',
            statusLabel: 'Indisponible',
            metric: 'n.d.',
            detail: 'Le slice overview ne remonte pas encore la santé community détaillée.',
            href: `${geoBase}/social`,
        },
        {
            id: 'connectors',
            label: 'Connecteurs',
            status: 'unavailable',
            statusLabel: 'Indisponible',
            metric: 'n.d.',
            detail: 'Les connecteurs détaillés existent ailleurs mais ne sont pas exposés dans overview.',
            href: `${dossierBase}/connectors`,
        },
        {
            id: 'runs',
            label: 'Runs / moteur',
            status: runs,
            statusLabel: labelForStatus(runs),
            metric: completedRunsTotal > 0 ? `${completedRunsTotal}` : '0',
            detail: latestRunAt ? `Dernier run ${formatRelativeTime(latestRunAt)}` : 'Aucun run observé',
            href: `${geoBase}/runs`,
        },
    ];
}

function buildConnectorItems({ gscStatus = 'unavailable', ga4Status = 'unavailable', auditStatus, runStatus, lastAuditAt, latestRunAt, geoBase, seoBase, dossierBase }) {
    return [
        {
            id: 'gsc',
            label: 'GSC',
            status: gscStatus,
            detail: 'Le détail de connexion GSC n’est pas exposé dans overview.',
            href: `${dossierBase}/connectors`,
        },
        {
            id: 'ga4',
            label: 'GA4',
            status: ga4Status,
            detail: 'Le détail de connexion GA4 n’est pas exposé dans overview.',
            href: `${dossierBase}/connectors`,
        },
        {
            id: 'audit',
            label: 'Audit',
            status: auditStatus,
            detail: lastAuditAt ? `Dernier audit ${formatRelativeTime(lastAuditAt)}` : 'Aucun audit récent exposé',
            href: `${seoBase}/health`,
        },
        {
            id: 'runs',
            label: 'GEO runs',
            status: runStatus,
            detail: latestRunAt ? `Dernier run ${formatRelativeTime(latestRunAt)}` : 'Aucun run observé',
            href: `${geoBase}/runs`,
        },
        {
            id: 'community',
            label: 'Community',
            status: 'unavailable',
            detail: 'La santé community détaillée existe sur la page dédiée, pas dans overview.',
            href: `${geoBase}/social`,
        },
    ];
}

function buildHeroMetrics({ trackedPromptsTotal, completedRunsTotal, openOpportunitiesCount, visibilityProxyPercent, citationCoveragePercent }) {
    return [
        {
            id: 'tracked-prompts',
            label: 'Prompts suivis',
            value: trackedPromptsTotal ?? 0,
            tone: 'info',
        },
        {
            id: 'completed-runs',
            label: 'Runs terminés',
            value: completedRunsTotal ?? 0,
            tone: 'neutral',
        },
        {
            id: 'open-opportunities',
            label: 'Actions ouvertes',
            value: openOpportunitiesCount ?? 0,
            tone: 'warning',
        },
        {
            id: 'visibility',
            label: 'Visibilité',
            value: isFiniteNumber(visibilityProxyPercent) ? `${Math.round(visibilityProxyPercent)}%` : 'n.d.',
            tone: 'info',
        },
        {
            id: 'citations',
            label: 'Couverture citations',
            value: isFiniteNumber(citationCoveragePercent) ? `${Math.round(citationCoveragePercent)}%` : 'n.d.',
            tone: 'info',
        },
    ];
}

export function buildGeoOverviewCommandModel({ clientId, client, workspace, audit, data }) {
    const { geoBase, seoBase, dossierBase } = getBasePaths(clientId);

    const kpis = data?.kpis || {};
    const visibility = data?.visibility || {};
    const sources = data?.sources || {};
    const competitors = data?.competitors || {};
    const opportunities = data?.opportunities || {};
    const guardrails = Array.isArray(data?.guardrails) ? data.guardrails : [];
    const recentActivity = Array.isArray(data?.recentActivity) ? data.recentActivity : [];
    const recentAudits = Array.isArray(data?.recentAudits) ? data.recentAudits : [];
    const recentQueryRuns = Array.isArray(data?.recentQueryRuns) ? data.recentQueryRuns : [];

    const trackedPromptsTotal = Number(kpis.trackedPromptsTotal ?? workspace?.trackedPromptCount ?? 0);
    const completedRunsTotal = Number(kpis.completedRunsTotal ?? workspace?.completedRunCount ?? 0);
    const openOpportunitiesCount = Number(opportunities?.summary?.open ?? kpis.openOpportunitiesCount ?? workspace?.openOpportunityCount ?? 0);
    const seoScore = isFiniteNumber(audit?.seo_score) ? audit.seo_score : kpis.seoScore;
    const geoScore = isFiniteNumber(audit?.geo_score) ? audit.geo_score : kpis.geoScore;
    const mentionRatePercent = kpis.mentionRatePercent;
    const visibilityProxyPercent = kpis.visibilityProxyPercent;
    const citationCoveragePercent = kpis.citationCoveragePercent;
    const visibilityReliability = kpis.visibilityProxyReliability;
    const parseFailureRate = Number(kpis.parseFailureRate ?? 0);
    const latestRunAt = visibility.lastGeoRunAt || workspace?.latestRunAt || null;
    const lastAuditAt = visibility.lastAuditAt || workspace?.latestAuditAt || null;
    const noRunsYet = completedRunsTotal === 0;

    const criticalWarnings = guardrails.filter((item) => item?.severity === 'critical' || item?.severity === 'error');
    const activeWarnings = guardrails.filter((item) => item?.severity === 'warning');

    const runStatus = getRunStatus({
        completedRunsTotal,
        trackedPromptsTotal,
        latestRunAt,
        parseFailureRate,
    });
    const seoStatus = scoreStatus(seoScore);
    const geoStatus = getGeoStatus(geoScore, mentionRatePercent, visibilityReliability);
    const auditStatus = getAuditStatus(lastAuditAt, seoScore);
    const globalStatus = getGlobalStatus({
        criticalWarnings,
        activeWarnings,
        noRunsYet,
        trackedPromptsTotal,
        runStatus,
        seoStatus,
        geoStatus,
    });

    const topActions = buildPriorityActions({
        criticalWarnings,
        activeWarnings,
        noRunsYet,
        trackedPromptsTotal,
        parseFailureRate,
        visibilityReliability,
        opportunities,
        geoBase,
        seoBase,
        workspace,
    });
    const heroScoreValue = isFiniteNumber(geoScore)
        ? Math.round(geoScore)
        : (isFiniteNumber(seoScore) ? Math.round(seoScore) : null);
    const heroScoreLabel = isFiniteNumber(geoScore)
        ? 'Score GEO'
        : (isFiniteNumber(seoScore) ? 'Score SEO' : 'Score');
    const heroScoreTone = heroScoreValue === null ? 'unavailable' : scoreStatus(heroScoreValue);
    const heroScoreCaption = isFiniteNumber(geoScore)
        ? 'Référence audit utilisée dans GEO Ops et SEO Ops.'
        : (isFiniteNumber(seoScore)
            ? 'Référence SEO disponible dans le mandat.'
            : 'Aucun score de référence disponible.');
    const scorePool = heroScoreValue === null ? [] : [heroScoreValue];

    const riskItems = buildRiskItems({
        seoScore,
        geoScore,
        mentionRatePercent,
        visibilityReliability,
        trackedPromptsTotal,
        completedRunsTotal,
        latestRunAt,
        parseFailureRate,
        lastAuditAt,
        geoBase,
        seoBase,
        dossierBase,
    });

    const highestRisk = riskItems.reduce((current, item) => (toneRank(item.status) > toneRank(current.status) ? item : current), riskItems[0]);

    return {
        hero: {
            eyebrow: 'Client Command Center',
            title: client?.client_name || 'Mandat',
            subtitle: client?.business_type || 'Mandat actif',
            websiteLabel: client?.website_url ? client.website_url.replace(/^https?:\/\//, '') : null,
            status: globalStatus,
            score: {
                value: heroScoreValue,
                label: heroScoreLabel,
                captionFinal: heroScoreCaption,
                tone: heroScoreTone,
                caption: scorePool.length > 0 ? `${scorePool.length} signal${scorePool.length > 1 ? 'aux' : ''} agrégé${scorePool.length > 1 ? 's' : ''}` : 'Aucun score agrégable',
            },
            freshness: {
                label: latestRunAt ? `Dernier run ${formatRelativeTime(latestRunAt)}` : 'Aucun run récent',
                detail: latestRunAt ? formatDateTime(latestRunAt) : 'Le workspace overview ne remonte encore aucun run récent.',
                status: runStatus,
            },
            priorityAction: topActions[0] || {
                id: 'review-workspace',
                tone: 'neutral',
                title: 'Ouvrir le workspace détaillé',
                impact: 'Accéder aux sections spécialisées pour continuer le pilotage.',
                proof: 'Aucune priorité immédiate n’a émergé du slice overview.',
                href: geoBase,
            },
            supportingMetrics: buildHeroMetrics({
                trackedPromptsTotal,
                completedRunsTotal,
                openOpportunitiesCount,
                visibilityProxyPercent,
                citationCoveragePercent,
            }),
            headline: highestRisk ? `${highestRisk.label} ${highestRisk.statusLabel.toLowerCase()}` : 'Mandat pilotable',
        },
        riskMap: {
            title: 'Carte des risques',
            description: 'Lecture rapide des domaines opératoires réellement couverts par le workspace overview.',
            items: riskItems,
        },
        topActions,
        trend: buildTrend(recentAudits, recentQueryRuns),
        connectorHealth: {
            title: 'Santé des sources et connecteurs',
            description: 'Les statuts détaillés ne sont affichés que lorsqu’ils sont déjà présents dans overview ou dans le shell du client.',
            items: buildConnectorItems({
                auditStatus,
                runStatus,
                lastAuditAt,
                latestRunAt,
                geoBase,
                seoBase,
                dossierBase,
            }),
        },
        timeline: buildTimeline(recentActivity, geoBase, seoBase, dossierBase),
        evidence: buildEvidence({
            guardrails,
            opportunities,
            sources,
            competitors,
            visibility,
            geoBase,
            seoBase,
        }),
    };
}
