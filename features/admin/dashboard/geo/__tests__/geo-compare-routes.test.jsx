import { beforeEach, describe, expect, it, vi } from 'vitest';

const geoCompareViewMock = vi.fn(() => null);
const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/features/admin/dashboard/geo/GeoCompareView', () => ({
    default: geoCompareViewMock,
}));

const useGeoClientMock = vi.fn();
vi.mock('@/features/admin/dashboard/shared/context/ClientContext', () => ({
    useGeoClient: useGeoClientMock,
}));

describe('geo compare route wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps global route in free mode', async () => {
        const { default: GeoComparePage } = await import('@/app/admin/(workspace)/geo-compare/page');
        const element = GeoComparePage();
        expect(element.type).toBe(geoCompareViewMock);
        expect(element.props).toEqual({});
    });

    it('wires client route with linked client context', async () => {
        useGeoClientMock.mockReturnValue({
            clientId: 'client-123',
            client: { client_name: 'Trouvable Test' },
        });

        const { default: ClientGeoComparePage } = await import('@/app/admin/(workspace)/clients/[clientId]/geo/compare/page');
        const element = ClientGeoComparePage();
        expect(element.type).toBe(geoCompareViewMock);
        expect(element.props).toEqual({
            linkedClientId: 'client-123',
            linkedClientName: 'Trouvable Test',
        });
    });

    it('keeps the legacy client alias redirect explicit', async () => {
        const { default: RedirectPage } = await import('@/app/admin/(workspace)/clients/[clientId]/geo-compare/page');
        await RedirectPage({ params: Promise.resolve({ clientId: 'client-123' }) });
        expect(redirectMock).toHaveBeenCalledWith('/admin/clients/client-123/geo/compare');
    });
});

