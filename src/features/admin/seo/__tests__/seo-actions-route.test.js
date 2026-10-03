import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
    redirect: redirectMock,
}));

describe('seo actions route wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('redirects the client SEO actions route to the SEO remediation queue', async () => {
        const { default: SeoActionsPage } = await import('@/app/admin/(workspace)/clients/[clientId]/seo/actions/page');

        await SeoActionsPage({
            params: Promise.resolve({ clientId: 'client-123' }),
        });

        expect(redirectMock).toHaveBeenCalledWith('/admin/clients/client-123/seo/opportunities');
    });
});

