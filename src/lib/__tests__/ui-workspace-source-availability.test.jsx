import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ data: null, loading: false, error: null }));
vi.mock('@/features/admin/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ client: { client_name: 'Fixture' }, clientId: 'test', invalidateWorkspace: vi.fn() }),
    useGeoWorkspaceSlice: () => fixture,
}));
vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/clients/test/geo/prompts',
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
import GeoPromptsView from '@/features/admin/geo/GeoPromptsView';
import GeoSocialView from '@/features/admin/geo/GeoSocialView';
import AgentActionabilityView from '@/features/admin/agent/AgentActionabilityView';
import AgentProtocolsView from '@/features/admin/agent/AgentProtocolsView';

function data(overrides = {}) {
    return {
        status: 'available', errors: [], available: false, summary: {},
        prompts: [], categoryOptions: [], discoveryModeOptions: [],
        emptyState: { title: 'Lecture sans données', description: 'Absence connue après lecture.' },
        ...overrides,
    };
}
function render(Component) { return renderToStaticMarkup(createElement(Component)); }
function text(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }

beforeEach(() => { fixture.data = data(); fixture.loading = false; fixture.error = null; });

describe.each([
    [GeoPromptsView, 'GEO'], [GeoSocialView, 'GEO'],
    [AgentActionabilityView, 'AGENT'], [AgentProtocolsView, 'AGENT'],
].map(([Component, domain]) => ({ name: Component.name, Component, domain })))('workspace availability in $name', ({ Component, domain }) => {
    it.each(['partial', 'unavailable'])('renders the %s source warning, including a report empty-state layout', (status) => {
        fixture.data = data({ status, errors: [{ source: 'audit', message: 'Lecture temporairement indisponible.' }] });
        const html = render(Component);
        expect(html).toContain(status === 'partial' ? 'Données '+domain+' partielles' : 'Sources '+domain+' indisponibles');
        expect(html).toContain('Lecture temporairement indisponible.');
        if (domain === 'AGENT') expect(html).toContain('Absence connue après lecture.');
    });
    it('does not invent an incident for a successful empty source', () => {
        fixture.data = data({ dataSources: { audit: 'empty' } });
        expect(render(Component)).not.toContain('Lecture temporairement indisponible.');
        expect(render(Component)).not.toContain('Sources '+domain+' indisponibles');
    });
    it.each(['loading', 'error'])('preserves the dedicated %s layout', (state) => {
        fixture.data = data({ status: 'partial', errors: [{ source: 'audit', message: 'Source notice' }] });
        fixture[state] = state === 'loading' ? true : 'Network error';
        expect(render(Component)).not.toContain('Source notice');
        if (state === 'error') expect(render(Component)).toContain('Network error');
    });
});

describe('unknown GEO metrics', () => {
    it('does not render an unknown prompt rate as zero or infer ready lifecycle without context', () => {
        fixture.data = data({
            status: 'partial',
            summary: { total: null, mentionRatePercent: null, weakPromptCount: null, inactive: null },
            prompts: [{ id: 'q', query_text: 'Question conservée', is_active: true, quality_status: null, lifecycle: { has_run: null } }],
        });
        const html = text(render(GeoPromptsView));
        expect(html).toMatch(/Inventaire n\.d\. Total prompts/);
        expect(html).toMatch(/Performance n\.d\. Taux cible/);
        expect(html).toMatch(/Critique n\.d\./);
        expect(html).toMatch(/Inactifs n\.d\./);
        expect(html).not.toContain('PRÊT');
        expect(html).toContain('INDISPONIBLE');
    });
    it('preserves real prompt zeroes', () => {
        fixture.data = data({ summary: { total: 0, mentionRatePercent: 0, weakPromptCount: 0, inactive: 0 } });
        const html = text(render(GeoPromptsView));
        expect(html).toMatch(/Inventaire 0 Total prompts/);
        expect(html).toMatch(/Performance 0% Taux cible/);
        expect(html).toMatch(/Inactifs 0 En pause/);
    });
    it('preserves a known collection without converting unknown counts to no signal or connected status', () => {
        fixture.data = data({
            status: 'partial', connection: { status: 'unavailable' }, dataSources: { stats: 'unavailable', clusters: 'unavailable', connectorRows: 'unavailable' },
            summary: { documents_count: null, clusters_count: null, opportunities_count: null, total_discussions: null, last_run: { status: 'completed', started_at: '2026-10-01T10:00:00Z' } },
        });
        const html = text(render(GeoSocialView));
        expect(html).toMatch(/Documents n\.d\. Sources collectées/);
        expect(html).toMatch(/Clusters Thématiques n\.d\./);
        expect(html).toMatch(/Actionnabilité n\.d\./);
        expect(html).toMatch(/Statut Collecte Indisponible/);
        expect(html).toMatch(/Connecteur Indisponible/);
        expect(html).toContain('n.d. discussions');
        expect(html).not.toContain('Aucun signal');
        expect(html).not.toContain('Derniers 30 jours');
    });
    it('keeps known empty metrics and an actually disconnected connector distinct', () => {
        fixture.data = data({
            connection: { status: 'not_connected' },
            summary: { documents_count: 0, clusters_count: 0, opportunities_count: 0, total_discussions: 0, last_run: { status: 'completed' } },
        });
        const html = text(render(GeoSocialView));
        expect(html).toMatch(/Documents 0 Sources collectées/);
        expect(html).toMatch(/Statut Collecte Aucun signal/);
        expect(html).toMatch(/Connecteur Non connecté/);
    });
});
