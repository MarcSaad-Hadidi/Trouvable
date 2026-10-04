import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ data: null }));
vi.mock('@/features/admin/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ client: { client_name: 'Test' }, clientId: 'test' }),
    useSeoWorkspaceSlice: () => ({ data: fixture.data, loading: false, error: null }),
    useGeoWorkspaceSlice: () => ({ data: fixture.data, loading: false, error: null }),
}));
vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/clients/test/seo/content',
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

import SeoContentView from '@/features/admin/seo/SeoContentView';
import SeoCannibalizationView from '@/features/admin/seo/SeoCannibalizationView';
import SeoHealthView from '@/features/admin/seo/SeoHealthView';
import SeoOnPageView from '@/features/admin/seo/SeoOnPageView';
import SeoOpportunitiesView from '@/features/admin/seo/SeoOpportunitiesView';

const views = [SeoContentView, SeoCannibalizationView, SeoHealthView, SeoOnPageView, SeoOpportunitiesView];

describe.each(views)('source availability in %s', (Component) => {
    it.each([
        ['partial', 'Données SEO partielles'],
        ['unavailable', 'Sources SEO indisponibles'],
    ])('keeps source %s explicit even in an empty-state layout', (status, title) => {
        fixture.data = {
            status,
            errors: [{ source: 'audit', message: 'Lecture temporairement indisponible.' }],
            emptyState: {
                title: 'Lecture sans données',
                description: 'Les données indépendantes restent accessibles.',
            },
        };
        const html = renderToStaticMarkup(createElement(Component));
        expect(html).toContain(title);
        expect(html).toContain('Lecture temporairement indisponible.');
        expect(html).toContain('Lecture sans données');
        expect(html).not.toContain('private database');
    });

    it.each(['empty', 'not_connected', 'not_observed'])(
        'does not invent an incident for successful source state %s',
        (state) => {
            fixture.data = {
                status: 'available',
                dataSources: { gscRows: state },
                errors: [],
                emptyState: { title: 'Lecture sans données', description: 'Aucune mesure stockée.' },
            };
            const html = renderToStaticMarkup(createElement(Component));
            expect(html).not.toContain('Sources SEO indisponibles');
            expect(html).not.toContain('Données SEO partielles');
            expect(html).toContain('Lecture sans données');
        },
    );
});

describe('cannibalization metrics distinguish an unknown group inventory from observed zero', () => {
    const render = () => renderToStaticMarkup(createElement(SeoCannibalizationView));
    it.each([
        { status: 'partial', emptyState: { title: 'Lecture sans données', description: 'Sources absentes.' } },
        { status: 'partial', groups: [], summaryCards: [{ id: 'group_count', value: null }] },
    ])('does not assert empty conflict counts when group inventory is unknown', (payload) => {
        fixture.data = { errors: [], ...payload };
        const html = render();
        expect(html).not.toContain('Aucun conflit critique mesuré');
        expect(html).not.toContain('Aucune page en conflit visible');
        expect(html).not.toContain('Aucun arbitrage encore exploitable');
        expect((html.match(/n\.d\./g) || []).length).toBeGreaterThanOrEqual(3);
    });
    it('preserves known zero when the backend successfully measured no groups', () => {
        fixture.data = {
            status: 'available',
            errors: [],
            groups: [],
            summaryCards: [{ id: 'group_count', value: 0 }],
        };
        const html = render();
        expect(html).toContain('Aucun conflit critique mesuré');
        expect(html).toContain('Aucune page en conflit visible');
        expect(html).toContain('Aucun arbitrage encore exploitable');
        expect((html.match(/>0<\/div>/g) || []).length).toBeGreaterThanOrEqual(3);
    });
});
