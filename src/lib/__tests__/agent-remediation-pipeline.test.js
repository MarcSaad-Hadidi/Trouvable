import { describe, expect, it } from 'vitest';

import {
    buildAgentFixesEmptyState,
    buildAgentMajorBlockers,
    buildAgentRemediationPipeline,
} from '../agent/remediation-pipeline.js';

function makeScore(overrides = {}) {
    return {
        subscores: {
            visibility: { score: 35, reason: null, ...overrides.visibility },
            readiness: { score: 50, reason: null, ...overrides.readiness },
            actionability: { score: 55, reason: null, ...overrides.actionability },
            advanced_protocols: { score: 40, reason: null, ...overrides.advanced_protocols },
        },
    };
}

describe('buildAgentRemediationPipeline', () => {
    it('remonte des correctifs même sans opportunités ouvertes quand des dimensions sont faibles', () => {
        const remediation = buildAgentRemediationPipeline({
            opportunitySlice: {
                byStatus: { open: [], in_progress: [] },
                reviewQueue: [],
                summary: {},
            },
            readinessSlice: {
                topBlockers: [
                    {
                        title: 'Crawl IA bloqué',
                        detail: 'GPTBot reste bloqué sur robots.txt.',
                        status: 'bloqué',
                        reliability: 'measured',
                    },
                ],
                recommendations: [],
            },
            actionabilityReport: {
                available: true,
                reliability: 'calculated',
                topFixes: [],
                dimensions: [
                    {
                        key: 'offer_clarity',
                        label: 'Clarté de l’offre',
                        status: 'partiel',
                        score: 55,
                        topFix: 'Clarifier l’offre principale sur la page d’accueil.',
                    },
                ],
            },
            protocolsReport: {
                available: true,
                reliability: 'calculated',
                topFixes: [],
                dimensions: [
                    {
                        key: 'llms_txt',
                        label: 'llms.txt',
                        status: 'absent',
                        score: 0,
                        topFix: 'Créer /llms.txt avec les sections recommandées.',
                    },
                ],
            },
            overviewSlice: {
                kpis: {
                    trackedPromptsTotal: 2,
                    completedRunsTotal: 2,
                    mentionRatePercent: 30,
                    visibilityProxyPercent: 40,
                    citationCoveragePercent: 20,
                },
            },
            score: makeScore(),
        });

        expect(remediation.topFixes.length).toBeGreaterThan(0);
        expect(remediation.summary.open).toBeGreaterThan(0);
        expect(remediation.topFixes.some((item) => item.source !== 'opportunity')).toBe(true);
    });

    it('couvre tous les sous-scores non parfaits via garde-fous de cohérence', () => {
        const remediation = buildAgentRemediationPipeline({
            opportunitySlice: {
                byStatus: { open: [], in_progress: [] },
                reviewQueue: [],
                summary: {},
            },
            readinessSlice: null,
            actionabilityReport: null,
            protocolsReport: null,
            overviewSlice: { kpis: { trackedPromptsTotal: 0, completedRunsTotal: 0 } },
            score: makeScore({
                visibility: { score: 25 },
                readiness: { score: 15 },
                actionability: { score: 10 },
                advanced_protocols: { score: 5 },
            }),
        });

        expect(remediation.coverage.hasKnownGaps).toBe(true);
        expect(remediation.coverage.subscoreGaps.length).toBe(4);
        expect(remediation.coverage.uncoveredSubscores).toHaveLength(0);
    });
});

describe('AGENT remediation helpers', () => {
    it('injecte les correctifs haute priorité dans les blocages majeurs', () => {
        const blockers = buildAgentMajorBlockers({
            readinessSlice: { topBlockers: [{ title: 'Aucun blocage majeur', status: 'couvert' }] },
            remediation: {
                topFixes: [
                    {
                        title: 'Créer /llms.txt',
                        description: 'Le fichier llms.txt est absent.',
                        priority: 'high',
                        source: 'protocols',
                        provenance: { key: 'derived' },
                    },
                ],
            },
        });

        expect(blockers[0].title).toBe('Créer /llms.txt');
        expect(blockers[0].source).toBe('protocols');
    });

    it('retourne un empty state explicite quand des écarts existent sans action', () => {
        const emptyState = buildAgentFixesEmptyState({
            opportunitySlice: { byStatus: { open: [] } },
            remediation: {
                topFixes: [],
                coverage: { hasKnownGaps: true, uncoveredSubscores: ['readiness'] },
            },
        });

        expect(emptyState).toBeTruthy();
        expect(emptyState.title).toContain('synchronisation');
    });
});

