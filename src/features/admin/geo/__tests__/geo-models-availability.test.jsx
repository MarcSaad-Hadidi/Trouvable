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
});
