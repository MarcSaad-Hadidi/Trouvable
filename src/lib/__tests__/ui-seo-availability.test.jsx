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
import SeoLocalView from '@/features/admin/seo/SeoLocalView';
import SeoActionsView from '@/features/admin/seo/SeoActionsView';

describe('SEO source availability', () => {
    it.each([SeoLocalView, SeoActionsView])(
        'keeps unavailable source notices visible in %s empty state',
        (Component) => {
            fixture.data = {
                available: false,
                status: 'unavailable',
                errors: [{ source: 'audit', message: 'Lecture de l’audit indisponible.' }],
                emptyState: { title: 'Données temporairement indisponibles' },
            };
            const html = renderToStaticMarkup(createElement(Component));
            expect(html).toContain('Sources SEO indisponibles');
            expect(html).toContain('Lecture de l’audit indisponible.');
            expect(html).not.toContain('Aucun audit');
        },
    );

    it.each([SeoLocalView, SeoActionsView])(
        'keeps independent known data beside a partial notice in %s',
        (Component) => {
            fixture.data = {
                available: true,
                status: 'partial',
                errors: [{ source: 'audit', message: 'Lecture de l’audit indisponible.' }],
                localScore: 0,
                localIssueCount: null,
                totalIssueCount: null,
                counts: { totalSuggestions: 17, draftSuggestions: 0, approvedSuggestions: 0, totalAuditIssues: null },
            };
            const html = renderToStaticMarkup(createElement(Component));
            expect(html).toContain('Données SEO partielles');
            expect(html).toContain('Lecture de l’audit indisponible.');
            expect(html).not.toContain('Aucune action SEO identifiée');
            if (Component === SeoActionsView) expect(html).toContain('17');
        },
    );

    it.each([
        [null, 'n.d.'],
        [0, '0'],
    ])('local issue count %s remains %s', (value, displayed) => {
        fixture.data = { available: true, localIssueCount: value, totalIssueCount: value };
        const html = renderToStaticMarkup(createElement(SeoLocalView));
        expect(html.match(/>Problèmes locaux<\/div><div[^>]*>(.*?)<\/div>/)?.[1]).toBe(displayed);
        expect(html).toContain(`sur ${displayed} total`);
    });

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

describe('SEO metric availability in full layouts', () => {
    it.each(['unavailable', 'not_connected', 'not_observed'])(
        'keeps the visibility table count unknown for %s queries',
        (state) => {
            fixture.data = {
                trackedKeywordCount: null,
                topQueries: [],
                dataSources: { gscQueries: state },
                gscSource: { mode: 'live' },
                kpis: { sessions: 0 },
            };
            const html = renderToStaticMarkup(createElement(SeoVisibilityView));
            expect(html).toContain('n.d. mots-clés suivis');
            expect(html).not.toContain('0 mots-clés suivis');
        },
    );
    it('preserves a genuinely empty query inventory in the table count', () => {
        fixture.data = { trackedKeywordCount: 0, topQueries: [], dataSources: { gscQueries: 'empty' } };
        expect(renderToStaticMarkup(createElement(SeoVisibilityView))).toContain('0 mots-clés suivis');
    });
    it.each([
        [null, 'n.d.'],
        [0, '0'],
    ])('renders overview audit issue inventory %s without replacing it', (count, label) => {
        fixture.data = { auditScores: { seoScore: 0, geoScore: 0, issueCount: count } };
        const html = renderToStaticMarkup(createElement(SeoOverviewView));
        expect(html.match(/Problèmes détectés<\/div><div[^>]*>(.*?)<\/div>/)?.[1]).toBe(label);
    });
});
