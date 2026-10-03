import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ data: {} as any }));
vi.mock('@/features/admin/dashboard/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ clientId: 'fixture', client: { client_name: 'Fixture' } }),
    useGeoWorkspaceSlice: () => ({ data: fixture.data, loading: false, error: null }),
}));
import AgentOverviewView from '../AgentOverviewView';

function renderOverview(snapshot, status) {
    fixture.data = { snapshot, status };
    return renderToStaticMarkup(<AgentOverviewView />).replace(/<[^>]*>/g, '');
}

describe('AGENT overview source availability', () => {
    it('keeps failed snapshot counts unavailable and reports partial data', () => {
        const text = renderOverview({ completedRunsTotal: null, trackedPromptsTotal: null, openOpportunitiesCount: null, highPriorityOpen: null }, 'partial');
        expect(text).toContain('Exécutions complétéesn.d.');
        expect(text).toContain('Prompts suivisn.d.');
        expect(text).toContain('Correctifs actifsn.d.');
        expect(text).toContain('Données partielles');
        expect(text).not.toContain('0 priorité(s)');
    });

    it('preserves observed zero counts', () => {
        const text = renderOverview({ completedRunsTotal: 0, trackedPromptsTotal: 0, openOpportunitiesCount: 0, highPriorityOpen: 0 }, 'available');
        expect(text).toContain('Exécutions complétées0');
        expect(text).toContain('Prompts suivis0');
        expect(text).toContain('Correctifs actifs0');
        expect(text).toContain('0 priorité(s)');
    });
});
