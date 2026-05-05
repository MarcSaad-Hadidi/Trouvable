import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
    redirect: redirectMock,
}));

vi.mock('@/features/admin/dashboard/seo/SeoOverviewView', () => ({
    default: function MockSeoOverviewView() {
        return React.createElement('div', { 'data-testid': 'seo-overview' });
    },
}));

describe('seo overview route wiring', () => {
    it('renders the SEO overview instead of redirecting to organic visibility', async () => {
        const { default: ClientSeoPage } = await import('@/app/admin/(workspace)/clients/[clientId]/seo/page');

        const result = await ClientSeoPage({
            params: Promise.resolve({ clientId: 'client-123' }),
        });

        expect(redirectMock).not.toHaveBeenCalled();
        expect(result?.type?.name).toBe('MockSeoOverviewView');
    });
});
