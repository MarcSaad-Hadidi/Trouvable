import { beforeEach, describe, expect, it, vi } from 'vitest';

const geoReadinessViewMock = vi.fn(() => null);

vi.mock('@/features/admin/geo/GeoReadinessView', () => ({
    default: geoReadinessViewMock,
}));

describe('geo readiness route wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('wires the client GEO readiness route to the readiness view', async () => {
        const { default: GeoReadinessPage } =
            await import('@/app/admin/(workspace)/clients/[clientId]/geo/readiness/page');

        const element = GeoReadinessPage();

        expect(element.type).toBe(geoReadinessViewMock);
        expect(element.props).toEqual({});
    });
});
