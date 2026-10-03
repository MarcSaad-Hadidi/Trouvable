import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ data: {} }));
vi.mock('@/features/admin/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ clientId: 'fixture', invalidateWorkspace() {} }),
    useGeoWorkspaceSlice: () => ({ data: fixture.data, loading: false, error: null }),
}));
vi.mock('@/features/admin/geo/components/GeoRealCharts', () => ({ CumulativeModelVisibilityChart: () => null }));
import GeoModelesView from '../GeoModelesView';

function renderModels(sources, sessions, dataSources = {}) {
    fixture.data = {
        status: sources === null ? 'partial' : 'available',
        dataSources,
        modelPerformance: [{ provider: 'fixture', model: 'fixture-model', runs: 2, targetFound: 0, sources }],
        benchmark: { variantsCatalog: [{ id: 'fixture-variant', provider: 'fixture', model: 'fixture-model', label: 'Fixture' }], sessions },
    };
    return renderToStaticMarkup(<GeoModelesView />).replace(/<[^>]*>/g, '');
}

describe('model laboratory availability', () => {
    it('preserves missing source counts and benchmark sessions as unavailable', () => {
        const text = renderModels(null, null);
        expect(text).toContain('Sourcesn.d.');
        expect(text).toContain('Sessionsn.d.');
        expect(text).toContain('Données partielles');
    });

    it('preserves measured zero source counts and empty benchmark history', () => {
        const text = renderModels(0, []);
        expect(text).toContain('Sources0');
        expect(text).toContain('Sessions0');
        expect(text).toContain('0%');
    });

    it('does not treat failed benchmark arrays kept for compatibility as empty observed sessions', () => {
        const text = renderModels(0, [], { benchmarks: 'unavailable' });
        expect(text).toContain('Sessionsn.d.');
        expect(text).toContain('Sourcesn.d.');
    });
    it('keeps merged model totals unknown when compare-run history is unavailable', () => {
        fixture.data = {
            status: 'partial', dataSources: { runs: 'available', recentRuns: 'unavailable', benchmarks: 'available' },
            modelPerformance: [
                { provider: 'fixture', model: 'fixture-model', runs: 2, targetFound: 0, sources: 0 },
                { provider: 'other', model: 'outside-catalog', runs: 3, targetFound: 1, sources: 1 },
            ],
            benchmark: {
                variantsCatalog: [{ id: 'fixture-variant', provider: 'fixture', model: 'fixture-model', label: 'Fixture' }],
                sessions: [{ id: 'known-session', created_at: '2026-10-03T12:00:00Z', rows: [{ engine_variant: 'fixture-variant', provider: 'fixture', model: 'fixture-model', target_found: true, citations: 2 }] }],
            },
        };
        const text = renderToStaticMarkup(<GeoModelesView />).replace(/<[^>]*>/g, '');
        expect(text.split('Runsn.d.').length - 1).toBe(2);
        expect(text.split('ROIn.d.').length - 1).toBe(2);
        expect(text.split('Sourcesn.d.').length - 1).toBe(2);
        expect(text).toContain('Top Raten.d.');
        expect(text).toContain('Sessions1');
        expect(text).toContain('CIBLE OK');
        expect(text).toContain('outside-catalog');
        expect(text).toContain('Données partielles');
    });

    it('preserves complete zero-run observations when compare history is empty', () => {
        fixture.data = {
            status: 'available', dataSources: { runs: 'empty', recentRuns: 'empty', benchmarks: 'empty' },
            modelPerformance: [{ provider: 'fixture', model: 'fixture-model', runs: 0, targetFound: 0, sources: 0 }],
            benchmark: { variantsCatalog: [{ id: 'fixture-variant', provider: 'fixture', model: 'fixture-model', label: 'Fixture' }], sessions: [] },
        };
        const text = renderToStaticMarkup(<GeoModelesView />).replace(/<[^>]*>/g, '');
        expect(text).toContain('Runs0');
        expect(text).toContain('ROI0%');
        expect(text).toContain('Sessions0');
        expect(text).not.toContain('Données partielles');
    });

});
