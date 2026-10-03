import { describe, expect, it } from 'vitest';

import { buildGeoOverviewCommandModel } from '@/features/admin/geo/geo-overview-model';

function hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function createBaseInput(overrides = {}) {
    return {
        clientId: 'client-123',
        client: {
            client_name: 'Clinique Horizon',
            business_type: 'Clinique',
            website_url: 'https://horizon.example',
        },
        workspace: {
            latestAuditAt: hoursAgo(12),
            latestRunAt: hoursAgo(6),
        },
        audit: {
            seo_score: 76,
            geo_score: 62,
        },
        data: {
            kpis: {
                seoScore: 76,
                geoScore: 62,
                trackedPromptsTotal: 12,
                completedRunsTotal: 18,
                mentionRatePercent: 34,
                citationCoveragePercent: 58,
                openOpportunitiesCount: 3,
                visibilityProxyPercent: 46,
                visibilityProxyReliability: 'medium',
                avgParseConfidence: 0.72,
                parseFailureRate: 4,
            },
            visibility: {
                lastAuditAt: hoursAgo(12),
                lastGeoRunAt: hoursAgo(6),
                promptCoverage: {
                    total: 12,
                    active: 12,
                    withTargetFound: 5,
                    withRunNoTarget: 4,
                    noRunYet: 3,
                    mentionRatePercent: 34,
                },
                topProvidersModels: [
                    { provider: 'groq', model: 'llama-3.3', targetFoundRatePercent: 41, totalRuns: 7 },
                ],
            },
            sources: {
                summary: {
                    totalCompletedRuns: 18,
                    totalSourceMentions: 24,
                    externalSourceMentions: 19,
                    uniqueSourceHosts: 7,
                    citationCoveragePercent: 58,
                },
                topHosts: [
                    { host: 'support.google.com', count: 9 },
                ],
            },
            competitors: {
                summary: {
                    totalCompletedRuns: 18,
                    competitorMentions: 6,
                    genericNonTargetMentions: 3,
                },
                topCompetitors: [
                    { name: 'Clinique Atlas', count: 4 },
                ],
            },
            opportunities: {
                summary: {
                    open: 3,
                    total: 3,
                },
                openItems: [
                    {
                        id: 'opp-1',
                        title: 'Corriger les signaux contradictoires',
                        description: 'Les réponses citent des sources hors positionnement visé.',
                        priority: 'high',
                        source: 'observed',
                        provenance: {
                            label: 'Observé',
                            shortLabel: 'Observé',
                        },
                        created_at: hoursAgo(5),
                    },
                ],
            },
            guardrails: [
                {
                    severity: 'critical',
                    message: "Le moteur d'exécution remonte des alertes critiques.",
                },
            ],
            recentActivity: [
                {
                    id: 'act-1',
                    type: 'audit',
                    title: 'Audit du site terminé',
                    description: 'SEO 76 · GEO 62',
                    created_at: hoursAgo(4),
                    provenance: {
                        label: 'Observé',
                        shortLabel: 'Observé',
                    },
                },
            ],
            recentAudits: [
                { id: 'audit-1', created_at: '2026-04-01T10:00:00.000Z', seo_score: 61, geo_score: 49 },
                { id: 'audit-2', created_at: '2026-04-08T10:00:00.000Z', seo_score: 69, geo_score: 57 },
                { id: 'audit-3', created_at: '2026-04-16T10:00:00.000Z', seo_score: 76, geo_score: 62 },
            ],
            recentQueryRuns: [
                { id: 'run-1', created_at: '2026-04-14T08:00:00.000Z', target_found: false },
                { id: 'run-2', created_at: '2026-04-15T08:00:00.000Z', target_found: true },
                { id: 'run-3', created_at: '2026-04-16T08:00:00.000Z', target_found: true },
            ],
        },
        ...overrides,
    };
}

describe('buildGeoOverviewCommandModel', () => {
    it('prioritizes blocking issues and keeps unavailable domains honest', () => {
        const model = buildGeoOverviewCommandModel(createBaseInput());

        expect(model.hero.status.tone).toBe('critical');
        expect(model.hero.priorityAction.href).toBe('/admin/clients/client-123/geo/alerts');
        expect(model.topActions[0].title).toContain('alertes critiques');

        expect(model.riskMap.items.find((item) => item.id === 'social').status).toBe('unavailable');
        expect(model.riskMap.items.find((item) => item.id === 'connectors').status).toBe('unavailable');

        expect(model.connectorHealth.items.find((item) => item.id === 'gsc').status).toBe('unavailable');
        expect(model.connectorHealth.items.find((item) => item.id === 'ga4').status).toBe('unavailable');
        expect(model.connectorHealth.items.find((item) => item.id === 'runs').status).toBe('ok');
    });

    it('surfaces a no-runs mandate as the first action without inventing missing connector data', () => {
        const model = buildGeoOverviewCommandModel(createBaseInput({
            workspace: {
                latestAuditAt: '2026-04-10T09:00:00.000Z',
                latestRunAt: null,
            },
            data: {
                ...createBaseInput().data,
                kpis: {
                    ...createBaseInput().data.kpis,
                    completedRunsTotal: 0,
                    mentionRatePercent: null,
                    visibilityProxyPercent: null,
                    visibilityProxyReliability: 'insufficient_data',
                    parseFailureRate: 0,
                },
                visibility: {
                    ...createBaseInput().data.visibility,
                    lastGeoRunAt: null,
                    promptCoverage: {
                        ...createBaseInput().data.visibility.promptCoverage,
                        noRunYet: 12,
                        withTargetFound: 0,
                        withRunNoTarget: 0,
                    },
                },
                sources: {
                    ...createBaseInput().data.sources,
                    summary: {
                        ...createBaseInput().data.sources.summary,
                        totalCompletedRuns: 0,
                    },
                    topHosts: [],
                },
                competitors: {
                    ...createBaseInput().data.competitors,
                    topCompetitors: [],
                },
                guardrails: [],
                recentQueryRuns: [],
            },
        }));

        expect(model.hero.status.tone).toBe('critical');
        expect(model.hero.priorityAction.href).toBe('/admin/clients/client-123/geo/prompts');
        expect(model.topActions[0].title).toContain('premières exécutions');
        expect(model.riskMap.items.find((item) => item.id === 'runs').status).toBe('critical');
        expect(model.connectorHealth.items.find((item) => item.id === 'community').status).toBe('unavailable');
    });

    it('builds a ready trend and a recent timeline only from observed histories', () => {
        const model = buildGeoOverviewCommandModel(createBaseInput());

        expect(model.trend.state).toBe('ready');
        expect(model.trend.series.map((series) => series.label)).toEqual(['SEO', 'GEO', 'Visibilité']);
        expect(model.timeline.items).toHaveLength(1);
        expect(model.evidence.items[0].title).toBe("Le moteur d'exécution remonte des alertes critiques.");
    });
    it('keeps the trend empty when the observed history is too short to chart honestly', () => {
        const baseInput = createBaseInput();
        const model = buildGeoOverviewCommandModel(createBaseInput({
            data: {
                ...baseInput.data,
                recentAudits: [
                    { id: 'audit-1', created_at: '2026-04-16T10:00:00.000Z', seo_score: 76, geo_score: 62 },
                ],
                recentQueryRuns: [
                    { id: 'run-1', created_at: '2026-04-16T08:00:00.000Z', target_found: true },
                ],
            },
        }));

        expect(model.trend.state).toBe('empty');
        expect(model.trend.series).toEqual([]);
        expect(model.trend.labels).toEqual([]);
    });

    it('sends evidence links to existing admin routes', () => {
        const model = buildGeoOverviewCommandModel(createBaseInput());

        const competitorEvidence = model.evidence.items.find((item) => item.id === 'competitor-top');
        expect(competitorEvidence?.href).toBe('/admin/clients/client-123/geo/signals?focus=competitors');
    });
    it('uses the geo audit score as the hero score instead of a derived aggregate', () => {
        const model = buildGeoOverviewCommandModel(createBaseInput());

        expect(model.hero.score.value).toBe(62);
        expect(model.hero.score.label).toBe('Score GEO');
    });

    it('routes audit-oriented links to current admin destinations', () => {
        const model = buildGeoOverviewCommandModel(createBaseInput());

        expect(model.timeline.items[0]?.href).toBe('/admin/clients/client-123/seo/health');
        expect(model.riskMap.items.find((item) => item.id === 'geo')?.href).toBe('/admin/clients/client-123/geo/signals');
        expect(model.connectorHealth.items.find((item) => item.id === 'audit')?.href).toBe('/admin/clients/client-123/seo/health');
    });

    it('keeps failed count sources unavailable without replacing them with stale workspace zeroes', () => {
        const input = createBaseInput();
        input.data.status = 'partial';
        input.data.dataSources = { trackedQueries: 'unavailable', totalQueryRuns: 'unavailable', opportunities: 'unavailable' };
        input.data.kpis.trackedPromptsTotal = null;
        input.data.kpis.completedRunsTotal = null;
        input.data.kpis.openOpportunitiesCount = null;
        input.workspace.completedRunCount = 0;
        const model = buildGeoOverviewCommandModel(input);
        expect(model.hero.supportingMetrics.slice(0, 3).map((item) => item.value)).toEqual(['n.d.', 'n.d.', 'n.d.']);
        expect(model.hero.status.label).toContain('indisponibles');
        expect(model.riskMap.items.find((item) => item.id === 'runs').status).toBe('unavailable');
    });

    it('preserves observed zero counts', () => {
        const input = createBaseInput();
        input.data.kpis.trackedPromptsTotal = 0;
        input.data.kpis.completedRunsTotal = 0;
        input.data.opportunities.summary.open = 0;
        expect(buildGeoOverviewCommandModel(input).hero.supportingMetrics.slice(0, 3).map((item) => item.value)).toEqual([0, 0, 0]);
    });

    it('does not replace failed audit scores with a stale shell audit and preserves observed critical warnings', () => {
        const input = createBaseInput();
        input.data.status = 'partial';
        input.data.dataSources = { audit: 'unavailable' };
        const model = buildGeoOverviewCommandModel(input);
        expect(model.hero.score.value).toBeNull();
        expect(model.hero.status.tone).toBe('critical');
        expect(model.hero.status.label).toContain('indisponibles');
    });
});

