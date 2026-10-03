import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PortalSignalsPanel from '../PortalSignalsPanel';
import PortalMomentumStrip from '../PortalMomentumStrip';
import PortalExecutiveStrip from '../PortalExecutiveStrip';

function renderText(component, props) {
    return renderToStaticMarkup(React.createElement(component, props)).replace(/<[^>]*>/g, '');
}

describe('Portal observed signal availability', () => {
    it('computes detection only from observed boolean results', () => {
        const prompts = [
            { id: 'found', query_text: 'Observed mention', target_found: true },
            { id: 'miss', query_text: 'Observed absence', target_found: false },
            { id: 'pending', query_text: 'Run unavailable', target_found: null },
        ];
        const text = renderText(PortalSignalsPanel, { prompts });
        expect(text).toContain('50%');
        expect(text).toContain('Indisponible');
    });

    it('keeps a wholly unobserved prompt list unavailable instead of a zero detection rate', () => {
        const text = renderText(PortalSignalsPanel, { prompts: [{ id: 'pending', query_text: 'Awaiting observation', target_found: null }] });
        expect(text).not.toContain('0%');
        expect(text).not.toContain('Non cité');
        expect(text).toContain('Indisponible');
    });

    it('preserves observed false as a zero detection rate', () => {
        const text = renderText(PortalSignalsPanel, { prompts: [{ id: 'miss', query_text: 'Observed absence', target_found: false }] });
        expect(text).toContain('0%');
        expect(text).toContain('Non cité');
    });

    it('renders unavailable run counts distinctly from observed zero', () => {
        const unavailable = renderText(PortalMomentumStrip, { visibility: { visibility_proxy_percent: 25, total_query_runs: null } });
        const observed = renderText(PortalMomentumStrip, { visibility: { visibility_proxy_percent: 25, total_query_runs: 0 } });
        expect(unavailable).toMatch(/Runs exécutésn\.d\./);
        expect(observed).toMatch(/Runs exécutés0/);
    });

    it('does not describe unavailable activity as no activity or unavailable trends as pending', () => {
        const props = { visibility: {}, recentWorkItems: [], trendSummary: {} };
        const observed = renderText(PortalExecutiveStrip, props);
        const unavailable = renderText(PortalExecutiveStrip, { ...props, dataSources: { actions: 'unavailable', history: 'unavailable' } });
        expect(observed).toContain('Aucune activité');
        expect(unavailable).not.toContain('Aucune activité');
        expect(unavailable).not.toContain('Tendances bientôt disponibles');
        expect(unavailable).toContain('Indisponible');
    });
});
