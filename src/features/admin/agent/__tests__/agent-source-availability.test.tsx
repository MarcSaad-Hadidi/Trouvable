import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ data: {} as any }));
vi.mock('@/features/admin/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ clientId: 'fixture', client: { client_name: 'Fixture' } }),
    useGeoWorkspaceSlice: () => ({ data: fixture.data, loading: false, error: null }),
}));
import AgentVisibilityView from '../AgentVisibilityView';
import AgentFixesView from '../AgentFixesView';

function renderView(View, data) {
    fixture.data = data;
    return renderToStaticMarkup(<View />).replace(/<[^>]*>/g, '');
}

describe('AGENT source availability at rendering boundaries', () => {
    it('keeps unavailable mention counts unknown while retaining observed runs and models', () => {
        const text = renderView(AgentVisibilityView, {
            status: 'partial',
            dataSources: { mentions: 'unavailable' },
            emptyState: null,
            kpis: {
                competitorMentionsCount: null,
                genericMentionsCount: null,
                completedRunsTotal: 3,
                trackedPromptsTotal: 2,
            },
            topModels: [{ provider: 'Fixture provider', model: 'Fixture model', total_runs: 3, total_mentions: null }],
        });
        expect(text).toContain('Concurrents citésn.d.');
        expect(text).toContain('Mentions génériques indisponibles');
        expect(text).toContain('3 exécution(s) complétée(s)');
        expect(text).toContain('Fixture model');
        expect(text).toContain('Données partielles');
        expect(text).not.toContain('0 mention(s) générique(s)');
    });

    it('preserves observed zero mention counts', () => {
        const text = renderView(AgentVisibilityView, {
            status: 'available',
            emptyState: null,
            kpis: {
                competitorMentionsCount: 0,
                genericMentionsCount: 0,
                completedRunsTotal: 3,
                trackedPromptsTotal: 2,
            },
        });
        expect(text).toContain('Concurrents cités0');
        expect(text).toContain('0 mention(s) générique(s)');
        expect(text).not.toContain('Données partielles');
    });

    it('keeps incomplete remediation aggregates unknown while displaying known actions', () => {
        const text = renderView(AgentFixesView, {
            status: 'partial',
            emptyState: null,
            summary: {
                open: null,
                total: null,
                highPriorityOpen: null,
                derivedOpen: null,
                inProgress: null,
                reviewQueueCount: null,
                remediationDraftCount: null,
                opportunityOpen: 2,
            },
            topFixes: [{ id: 'known', title: 'Correctif connu', priority: 'high', status: 'open' }],
        });
        expect(text).toContain('Correctifs actifsn.d.');
        expect(text).toContain('Priorité hauten.d.');
        expect(text).toContain('En coursn.d.');
        expect(text).toContain('À revoirn.d.');
        expect(text).toContain('Total des actions indisponible');
        expect(text).toContain('Signaux dérivés indisponibles');
        expect(text).toContain('Brouillons indisponibles');
        expect(text).toContain('Correctif connu');
        expect(text).toContain('Correctifs depuis opportunités2');
        expect(text).toContain('Données partielles');
    });

    it('preserves observed zero remediation counts', () => {
        const text = renderView(AgentFixesView, {
            status: 'available',
            emptyState: null,
            summary: {
                open: 0,
                total: 0,
                highPriorityOpen: 0,
                derivedOpen: 0,
                inProgress: 0,
                reviewQueueCount: 0,
                remediationDraftCount: 0,
            },
        });
        expect(text).toContain('Correctifs actifs0');
        expect(text).toContain('Priorité haute0');
        expect(text).toContain('En cours0');
        expect(text).toContain('À revoir0');
        expect(text).toContain('0 action(s) au total');
        expect(text).toContain('0 signal(aux) issu(s) des dimensions');
        expect(text).toContain('0 brouillon(s)');
        expect(text).not.toContain('Données partielles');
    });
});
