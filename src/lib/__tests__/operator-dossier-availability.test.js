import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ shell: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/operator-intelligence/base', () => ({ getOperatorWorkspaceShell: boundary.shell }));
vi.mock('@/lib/db/opportunities', () => ({ getLatestOpportunities: async () => ({ active: [], stale: [] }) }));
vi.mock('@/lib/operator-intelligence/activity', () => ({ getRecentSafeActivity: async () => ({ items: [] }) }));
vi.mock('@/lib/connectors/index', () => ({ getConnectorOverviewForClient: async () => ({ connections: [], providers: {} }) }));
vi.mock('@/lib/continuous/jobs', () => ({ getRecurringJobHealthSlice: async () => ({ jobs: [], runs: [], summary: {} }) }));
vi.mock('@/lib/operator-intelligence/social', () => ({ getSocialSlice: async () => ({ summary: {} }) }));
vi.mock('@/lib/operator-intelligence/visibility', () => ({ getVisibilitySlice: async () => ({ connectors: {}, kpis: null }) }));

import { getDossierOverviewSlice } from '../operator-intelligence/dossier.js';

const observedDate = '2026-10-02T12:00:00.000Z';
function shell(workspace = {}, dataSources = {}) {
    return { client: { id: 'client-a', client_name: 'Fixture', business_details: {}, contact_info: {} },
        workspace: { seoScore: 0, geoScore: 0, completedRunCount: null, latestRunAt: observedDate, ...workspace }, dataSources };
}
const card = (cards, id) => cards.find(item => item.id === id);

describe('actual dossier GEO availability descriptions', () => {
    beforeEach(() => {
        boundary.shell.mockReset().mockResolvedValue(shell({}, { totalQueryRuns: 'unavailable', lastRun: 'available' }));
    });

    it('keeps a known last-run date when the completed-count source failed, without null or no-cycle claims', async () => {
        const dossier = await getDossierOverviewSlice('client-a');
        const summary = card(dossier.summaryCards, 'geo_summary');
        const freshness = card(dossier.freshnessCards, 'latest_geo_run');
        expect(summary.detail).toContain('indisponible');
        expect(summary.detail).not.toContain('Aucune exécution');
        expect(freshness.detail).toContain('indisponible');
        expect(freshness.detail).not.toContain('null');
        expect(freshness.value).not.toBe('Indisponible');
        expect(freshness.reliability).toBe('measured');
        expect(summary.value).toBe(0);
        expect(card(dossier.summaryCards, 'seo_summary').value).toBe(0);
    });

    it('does not interpolate a null count into the independently known date card', async () => {
        const dossier = await getDossierOverviewSlice('client-a');
        expect(card(dossier.freshnessCards, 'latest_geo_run').detail).toContain('indisponible');
        expect(card(dossier.freshnessCards, 'latest_geo_run').detail).not.toContain('null');
    });
    it('describes an absent count and date as unavailable rather than an observed empty cycle', async () => {
        boundary.shell.mockResolvedValue(shell({ latestRunAt: null }, {}));
        const dossier = await getDossierOverviewSlice('client-a');
        expect(card(dossier.summaryCards, 'geo_summary').detail).toContain('indisponible');
        const freshness = card(dossier.freshnessCards, 'latest_geo_run');
        expect(freshness.detail).toContain('indisponible');
        expect(freshness.value).toBe('Indisponible');
        expect(freshness.reliability).toBe('unavailable');
    });

    it('preserves genuine zero completed runs as an observed empty result', async () => {
        boundary.shell.mockResolvedValue(shell({ completedRunCount: 0, latestRunAt: null }, { totalQueryRuns: 'empty', lastRun: 'empty' }));
        const dossier = await getDossierOverviewSlice('client-a');
        expect(card(dossier.summaryCards, 'geo_summary').detail).toBe('Aucune exécution IA finalisée');
        expect(card(dossier.freshnessCards, 'latest_geo_run').detail).toBe('Aucune exécution terminée à date');
    });

    it('preserves a known run date with a genuine zero completed-count', async () => {
        boundary.shell.mockResolvedValue(shell({ completedRunCount: 0 }, { totalQueryRuns: 'empty', lastRun: 'available' }));
        const dossier = await getDossierOverviewSlice('client-a');
        expect(card(dossier.freshnessCards, 'latest_geo_run').detail).toBe('0 exécution(s) terminée(s) au total');
    });

    it('preserves measured positive count descriptions', async () => {
        boundary.shell.mockResolvedValue(shell({ completedRunCount: 3 }, { totalQueryRuns: 'available', lastRun: 'available' }));
        const dossier = await getDossierOverviewSlice('client-a');
        expect(card(dossier.summaryCards, 'geo_summary').detail).toContain('3 exécution(s) terminée(s)');
        expect(card(dossier.freshnessCards, 'latest_geo_run').detail).toBe('3 exécution(s) terminée(s) au total');
    });

    it('does not report no completed execution after a failed date source with a known positive count', async () => {
        boundary.shell.mockResolvedValue(shell({ completedRunCount: 3, latestRunAt: null }, { totalQueryRuns: 'available', lastRun: 'unavailable' }));
        const dossier = await getDossierOverviewSlice('client-a');
        const freshness = card(dossier.freshnessCards, 'latest_geo_run');
        expect(freshness.detail).toContain('3 exécution(s) terminée(s)');
        expect(freshness.detail).toContain('indisponible');
        expect(freshness.detail).not.toContain('Aucune');
    });
});
