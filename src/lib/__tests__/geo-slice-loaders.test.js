import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    overview: vi.fn(async (clientId) => ({ slice: 'overview', clientId })),
    trend: vi.fn(async (clientId) => ({ slice: 'continuous', clientId })),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/operator-intelligence/overview', () => ({
    getOverviewSlice: mocks.overview,
}));

vi.mock('@/lib/continuous/jobs', () => ({
    getTrendSlice: mocks.trend,
}));

import { hasGeoSlice, loadGeoSlice } from '@/lib/operator-intelligence/geo-slice-loaders';

describe('geo slice loaders', () => {
    beforeEach(() => {
        mocks.overview.mockClear();
        mocks.trend.mockClear();
    });

    it('loads only the requested overview slice', async () => {
        const result = await loadGeoSlice('overview', 'client-123');

        expect(result).toEqual({ slice: 'overview', clientId: 'client-123' });
        expect(mocks.overview).toHaveBeenCalledTimes(1);
        expect(mocks.overview).toHaveBeenCalledWith('client-123');
        expect(mocks.trend).not.toHaveBeenCalled();
    });

    it('loads the continuous slice only when explicitly requested', async () => {
        const result = await loadGeoSlice('continuous', 'client-456');

        expect(result).toEqual({ slice: 'continuous', clientId: 'client-456' });
        expect(mocks.trend).toHaveBeenCalledTimes(1);
        expect(mocks.trend).toHaveBeenCalledWith('client-456');
        expect(mocks.overview).not.toHaveBeenCalled();
    });

    it('reports unknown slices without invoking any loader', async () => {
        expect(hasGeoSlice('unknown-slice')).toBe(false);
        await expect(loadGeoSlice('unknown-slice', 'client-789')).resolves.toBeNull();
        expect(mocks.overview).not.toHaveBeenCalled();
        expect(mocks.trend).not.toHaveBeenCalled();
    });
});
