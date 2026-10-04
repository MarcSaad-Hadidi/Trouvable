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
        benchmark: {
            variantsCatalog: [{ id: 'fixture-variant', provider: 'fixture', model: 'fixture-model', label: 'Fixture' }],
            sessions,
        },
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
        expect(text).toContain('ROI0%');
        expect(text).toContain('Taux de détection0%');
        expect(text).toContain('Plus testéFixture');
    });

    it('does not treat failed benchmark arrays kept for compatibility as empty observed sessions', () => {
        const text = renderModels(0, [], { benchmarks: 'unavailable' });
        expect(text).toContain('Sessionsn.d.');
        expect(text).toContain('Sourcesn.d.');
    });
    it('keeps merged model totals unknown when compare-run history is unavailable', () => {
        fixture.data = {
            status: 'partial',
            dataSources: { runs: 'available', recentRuns: 'unavailable', benchmarks: 'available' },
            modelPerformance: [
                { provider: 'fixture', model: 'fixture-model', runs: 2, targetFound: 0, sources: 0 },
                { provider: 'other', model: 'outside-catalog', runs: 3, targetFound: 1, sources: 1 },
            ],
            benchmark: {
                variantsCatalog: [
                    { id: 'fixture-variant', provider: 'fixture', model: 'fixture-model', label: 'Fixture' },
                ],
                sessions: [
                    {
                        id: 'known-session',
                        created_at: '2026-10-03T12:00:00Z',
                        rows: [
                            {
                                engine_variant: 'fixture-variant',
                                provider: 'fixture',
                                model: 'fixture-model',
                                target_found: true,
                                citations: 2,
                            },
                        ],
                    },
                ],
            },
        };
        const text = renderToStaticMarkup(<GeoModelesView />).replace(/<[^>]*>/g, '');
        expect(text.split('Runsn.d.').length - 1).toBe(2);
        expect(text.split('ROIn.d.').length - 1).toBe(2);
        expect(text.split('Sourcesn.d.').length - 1).toBe(2);
        expect(text).toContain('Taux de détectionn.d.');
        expect(text).toContain('Plus testén.d.');
        expect(text).toContain('Sessions1');
        expect(text).toContain('CIBLE OK');
        expect(text).toContain('outside-catalog');
        expect(text).toContain('Données partielles');
    });

    it('preserves complete zero-run observations when compare history is empty', () => {
        fixture.data = {
            status: 'available',
            dataSources: { runs: 'empty', recentRuns: 'empty', benchmarks: 'empty' },
            modelPerformance: [{ provider: 'fixture', model: 'fixture-model', runs: 0, targetFound: 0, sources: 0 }],
            benchmark: {
                variantsCatalog: [
                    { id: 'fixture-variant', provider: 'fixture', model: 'fixture-model', label: 'Fixture' },
                ],
                sessions: [],
            },
        };
        const text = renderToStaticMarkup(<GeoModelesView />).replace(/<[^>]*>/g, '');
        expect(text).toContain('Runs0');
        expect(text).toContain('ROIn.d.');
        expect(text).toContain('Sources0');
        expect(text).toContain('Taux de détectionn.d.');
        expect(text).toContain('Plus testén.d.');
        expect(text).toContain('Sessions0');
        expect(text).not.toContain('Données partielles');
    });
});

describe('model laboratory observed summary and page scroll', () => {
    function renderFixture(
        rows = [],
        dataSources = {},
        variantsCatalog = [
            {
                id: 'tavily-fixture',
                provider: 'orchestrated',
                model: 'composite-free',
                label: 'Tavily (Web orchestre)',
            },
        ],
    ) {
        fixture.data = {
            status: Object.values(dataSources).includes('unavailable') ? 'partial' : 'available',
            dataSources,
            modelPerformance: rows,
            benchmark: { variantsCatalog, sessions: [] },
        };
        return renderToStaticMarkup(<GeoModelesView />);
    }
    function visibleText(markup) {
        return markup.replace(/<[^>]*>/g, '');
    }
    function expectNoSummaryObservation(text) {
        expect(text).toContain('Taux de détectionn.d.');
        expect(text).toContain('Plus testén.d.');
        expect(text).not.toContain('Recommandé');
        expect(text).not.toContain('Meilleur modèle');
    }

    it('keeps catalogue variants untested without manufacturing a zero rate or leader', () => {
        const text = visibleText(renderFixture());
        expectNoSummaryObservation(text);
        expect(text).toContain('Untested');
        expect(text).toContain('Aucune donnée disponible');
        expect(text).toContain('Audités0');
        expect(text).toContain('Sessions0');
        expect(text).not.toContain('0%');
    });

    it.each(['runs', 'recentRuns', 'benchmarks'])(
        'does not select a model from unavailable %s measurements',
        (source) => {
            const text = visibleText(
                renderFixture(
                    [{ provider: 'orchestrated', model: 'composite-free', runs: 2, targetFound: 1, sources: 0 }],
                    { [source]: 'unavailable' },
                ),
            );
            expectNoSummaryObservation(text);
            expect(text).toContain('ROIn.d.');
            expect(text).toContain('Runsn.d.');
        },
    );

    it('describes the existing ranking by observed run volume rather than claiming the best rate', () => {
        const text = visibleText(
            renderFixture([
                { provider: 'volume', model: 'most-tested', runs: 10, targetFound: 2, sources: 0 },
                { provider: 'rate', model: 'highest-rate', runs: 2, targetFound: 2, sources: 0 },
            ]),
        );
        expect(text).toContain('Plus testémost-testedExécutions observées');
        expect(text).toContain('Taux de détection20%Modèle le plus testé');
        expect(text).toContain('ROI100%');
        expect(text).not.toContain('Recommandé');
        expect(text).not.toContain('Meilleur modèle');
        expect(text).not.toContain('Top Rate');
    });

    it('keeps zero counts but no rate for an observed row outside the catalogue with zero runs', () => {
        const text = visibleText(
            renderFixture([
                { provider: 'outside', model: 'zero-run', runs: 0, targetFound: 0, sources: 0, targetRatePercent: 0 },
            ]),
        );
        expectNoSummaryObservation(text);
        expect(text).toContain('ROIn.d.');
        expect(text).toContain('Runs0');
        expect(text).toContain('Sources0');
        expect(text).toContain('Sessions0');
    });

    it('does not coerce an unknown target count to an observed zero rate', () => {
        const text = visibleText(
            renderFixture([{ provider: 'outside', model: 'unknown-target', runs: 2, targetFound: null, sources: 0 }]),
        );
        expectNoSummaryObservation(text);
        expect(text).toContain('ROIn.d.');
        expect(text).toContain('Runs2');
    });

    it('lets the shell own vertical scrolling rather than creating bounded page panes', () => {
        const markup = renderFixture();
        expect(markup).not.toContain('h-[calc(100vh-280px)]');
        expect(markup).not.toContain('min-h-[600px]');
        expect(markup).not.toContain('overflow-y-auto');
        expect(markup).not.toContain('geo-scrollbar');
    });
});
