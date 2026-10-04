import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    auth: { isLoaded: false, isSignedIn: false },
    effects: [],
    replace: vi.fn(),
}));

vi.mock('react', async (original) => ({
    ...await original(),
    useEffect: (callback) => { state.effects.push(callback); },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => state.auth }));
vi.mock('next/dynamic', () => ({
    default: () => function ClerkForm({ path, routing, forceRedirectUrl, fallbackRedirectUrl }) {
        return createElement('div', {
            'data-path': path,
            'data-routing': routing,
            'data-force': forceRedirectUrl,
            'data-fallback': fallbackRedirectUrl,
        });
    },
}));

import AdminSignInClient from '@/features/auth/admin/AdminSignInClient';
import EspaceSignInClient from '@/features/auth/espace/EspaceSignInClient';
import PortalSignInClient from '@/features/auth/portal/PortalSignInClient';

beforeEach(() => {
    state.auth = { isLoaded: false, isSignedIn: false };
    state.effects = [];
    state.replace.mockClear();
});

describe.each([
    [AdminSignInClient, 'Chargement...', 'Redirection vers le tableau de bord...'],
    [PortalSignInClient, 'Chargement…', 'Redirection vers votre espace…'],
    [EspaceSignInClient, 'Chargement…', 'Redirection…'],
])('sign-in progress', (Component, loadingText, redirectText) => {
    it('waits for Clerk before redirecting', () => {
        const html = renderToStaticMarkup(createElement(Component));
        expect(html).toContain(loadingText);
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('min-h-[280px]');
        state.effects[0]();
        expect(state.replace).not.toHaveBeenCalled();
    });

    it('redirects signed-in users with the original progress message', () => {
        state.auth = { isLoaded: true, isSignedIn: true };
        const html = renderToStaticMarkup(createElement(Component));
        expect(html).toContain(redirectText);
        expect(html).toContain('min-h-[200px]');
        expect(html).not.toContain('data-path');
        state.effects[0]();
        expect(state.replace).toHaveBeenCalledExactlyOnceWith('/espace/apres-connexion');
    });
});

it.each([[PortalSignInClient, '/portal/sign-in'], [EspaceSignInClient, '/espace']])('preserves Clerk routing for %s', (Component, path) => {
    state.auth = { isLoaded: true, isSignedIn: false };
    const html = renderToStaticMarkup(createElement(Component));
    expect(html).toContain(`data-path="${path}"`);
    expect(html).toContain('data-routing="path"');
    expect(html).toContain('data-force="/espace/apres-connexion"');
    expect(html).toContain('data-fallback="/espace/apres-connexion"');
    state.effects[0]();
    expect(state.replace).not.toHaveBeenCalled();
});

it('preserves the admin delayed/manual activation', () => {
    state.auth = { isLoaded: true, isSignedIn: false };
    const html = renderToStaticMarkup(createElement(AdminSignInClient));
    expect(html).toContain('Ouvrir le formulaire');
    expect(html).not.toContain('data-path');
    const setTimeout = vi.fn(() => 42);
    const clearTimeout = vi.fn();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    try {
        const cleanup = state.effects[1]();
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1200);
        cleanup();
        expect(clearTimeout).toHaveBeenCalledWith(42);
    } finally {
        vi.unstubAllGlobals();
    }
});
