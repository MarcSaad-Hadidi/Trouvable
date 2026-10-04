import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ data: null }));
vi.mock('@/features/admin/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ client: { client_name: 'Test' }, clientId: 'test' }),
    useSeoWorkspaceSlice: () => ({ data: fixture.data, loading: false, error: null }),
}));
vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/clients/test/seo/visibility',
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

import SeoOverviewView from '@/features/admin/seo/SeoOverviewView';
import SeoVisibilityView from '@/features/admin/seo/SeoVisibilityView';

describe('SEO source availability', () => {
    it.each([
        [null, 'n.d.'],
        [0, '0'],
    ])('overview renders actual KPI %s as %s', (value, displayed) => {
        fixture.data = {
            kpis: {
                sessions: value,
                users: value,
                totalClicks: value,
                totalImpressions: value,
                daysWithTraffic: value,
                gscQueryCount: value,
            },
        };
        const html = renderToStaticMarkup(createElement(SeoOverviewView));
        expect(html.match(/>Sessions<\/div><div[^>]*>(.*?)<\/div>/)?.[1]).toBe(displayed);
        expect(html.match(/>Utilisateurs<\/div><div[^>]*>(.*?)<\/div>/)?.[1]).toBe(displayed);
        expect(html).not.toContain('Sources SEO indisponibles');
    });

    it.each([
        [null, 'n.d.'],
        [0, '0'],
    ])('visibility does not replace count %s with loaded rows', (count, displayed) => {
        fixture.data = {
            trackedKeywordCount: count,
            topQueries: [{ query: 'Exemple', clicks: 0, impressions: 0 }],
            gscSource: { mode: 'live' },
        };
        const html = renderToStaticMarkup(createElement(SeoVisibilityView));
        expect(html).toContain(`${displayed} requêtes`);
        expect(html).not.toContain('1 requêtes');
    });

    it.each([
        ['unavailable', 'indisponible'],
        ['partial', 'partiel'],
    ])('keeps query source %s explicit when another GSC response succeeds', (status, label) => {
        fixture.data = { trackedKeywordCount: null, dataSources: { gscQueries: status }, gscSource: { mode: 'live' } };
        const html = renderToStaticMarkup(createElement(SeoVisibilityView));
        expect(html.match(/>n\.d\. requêtes<\/span><span[^>]*>(.*?)<\/span>/)?.[1]).toBe(label);
    });

    it.each([SeoOverviewView, SeoVisibilityView])('shows partial readings and available values in %s', (Component) => {
        fixture.data = {
            status: 'partial',
            errors: [{ source: 'ga4Traffic', message: 'Lecture GA4 indisponible.' }],
            kpis: { sessions: null, totalClicks: 17 },
            trackedKeywordCount: 17,
            connectors: { ga4: { status: 'unavailable' }, gsc: { status: 'healthy' } },
        };
        const html = renderToStaticMarkup(createElement(Component));
        expect(html).toContain('Données SEO partielles');
        expect(html).toContain('Lecture GA4 indisponible.');
        expect(html).toContain('17');
        expect(html).not.toContain('Non connecté');
    });

    it.each([SeoOverviewView, SeoVisibilityView])(
        'distinguishes unavailable sources from successful empty readings in %s',
        (Component) => {
            fixture.data = {
                status: 'unavailable',
                trackedKeywordCount: null,
                errors: [{ source: 'connectors', message: 'Lecture des connecteurs indisponible.' }],
                emptyState: { title: 'Données indisponibles' },
            };
            const unavailable = renderToStaticMarkup(createElement(Component));
            expect(unavailable).toContain('Sources SEO indisponibles');
            expect(unavailable).toContain('Lecture des connecteurs indisponible.');
            fixture.data = { status: 'available', trackedKeywordCount: 0, dataSources: { gscQueries: 'empty' } };
            const empty = renderToStaticMarkup(createElement(Component));
            expect(empty).not.toContain('Sources SEO indisponibles');
            expect(empty).not.toContain('Données SEO partielles');
        },
    );

    it.each(['not_connected', 'not_observed'])('keeps known source %s out of incident notices', (status) => {
        fixture.data = {
            status: 'available',
            trackedKeywordCount: null,
            dataSources: { gscQueries: status },
            errors: [],
            emptyState: { title: 'Aucune donnée connectée' },
        };
        for (const Component of [SeoOverviewView, SeoVisibilityView]) {
            const html = renderToStaticMarkup(createElement(Component));
            expect(html).not.toContain('Sources SEO indisponibles');
            expect(html).not.toContain('Données SEO partielles');
        }
    });
});
