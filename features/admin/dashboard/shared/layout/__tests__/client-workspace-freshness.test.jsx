import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ latestRunAt: null }));
vi.mock('@/features/admin/dashboard/shared/context/ClientContext', () => ({
    ClientProvider: ({ children }) => children,
    useGeoClient: () => ({ client: { id: 'fixture', client_name: 'Fixture' }, workspace: { latestRunAt: fixture.latestRunAt }, invalidateWorkspace() {} }),
}));
vi.mock('@/features/admin/dashboard/shared/components/AdminTray', () => ({ default: () => null }));
vi.mock('@/features/admin/dashboard/shared/components/CommandStrip', () => ({ default: () => null }));
vi.mock('@/features/admin/dashboard/portfolio/actions', () => ({ transitionLifecycleAction: vi.fn() }));
import ClientWorkspaceShell from '../ClientWorkspaceShell';

afterEach(() => vi.useRealTimers());

describe('workspace hourly freshness', () => {
    it('keeps invalid timestamps unavailable without NaN or a healthy status', () => {
        fixture.latestRunAt = 'invalid timestamp';
        const html = renderToStaticMarkup(<ClientWorkspaceShell clientId="fixture">Content</ClientWorkspaceShell>);
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('Dernière exécution moteur récente');
        expect(html).toContain('Exécution moteur indisponible');
        expect(html).toContain('bg-white/20');
    });

    it.each([[6, 'récente'], [25, 'à surveiller'], [73, 'ancienne']])('preserves the valid %s hour threshold', (hours, label) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        fixture.latestRunAt = new Date(Date.now() - hours * 3600000).toISOString();
        const html = renderToStaticMarkup(<ClientWorkspaceShell clientId="fixture">Content</ClientWorkspaceShell>);
        expect(html).toContain(label);
        expect(html).not.toContain('NaN');
    });
});
