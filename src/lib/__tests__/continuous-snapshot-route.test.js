import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ authorize: vi.fn(), seed: vi.fn(), capture: vi.fn(), order: [] }));
vi.mock('@/lib/continuous/cron-auth', () => ({ assertCronAuthorized: io.authorize }));
vi.mock('@/lib/continuous/jobs', () => ({
    ensureDefaultRecurringJobsForAllClients: io.seed,
    captureDailySnapshotsForAllClients: io.capture,
}));
import { GET, POST } from '../../app/api/cron/continuous/snapshot/route.js';

beforeEach(() => {
    vi.resetAllMocks();
    io.order.length = 0;
    io.authorize.mockImplementation(() => io.order.push('authorize'));
    io.seed.mockImplementation(async () => {
        io.order.push('seed');
        return 2;
    });
    io.capture.mockImplementation(async () => {
        io.order.push('capture');
        return { captured: 1, total: 2 };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('daily snapshot route order with simulated IO', () => {
    it.each([
        ['GET', GET],
        ['POST', POST],
    ])('%s authorizes, initializes, then captures without changing the response', async (_method, handler) => {
        const request = new Request('http://localhost/api/cron/continuous/snapshot');
        const response = await handler(request);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            ok: true,
            seededJobsForClients: 2,
            snapshotSummary: { captured: 1, total: 2 },
        });
        expect(io.order).toEqual(['authorize', 'seed', 'capture']);
        expect(io.authorize).toHaveBeenCalledWith(request);
        expect(io.seed).toHaveBeenCalledWith();
        expect(io.capture).toHaveBeenCalledWith();
    });

    it('does not initialize or capture for an unauthorized request', async () => {
        io.authorize.mockImplementation(() => {
            throw Object.assign(new Error('fixture denied'), { code: 'CRON_UNAUTHORIZED' });
        });
        const response = await GET(new Request('http://localhost/api/cron/continuous/snapshot'));
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'fixture denied' });
        expect(io.seed).not.toHaveBeenCalled();
        expect(io.capture).not.toHaveBeenCalled();
    });

    it('keeps an authorization configuration failure distinct from denial', async () => {
        io.authorize.mockImplementation(() => {
            throw new Error('fixture configuration missing');
        });
        const response = await POST(new Request('http://localhost/api/cron/continuous/snapshot'));
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'fixture configuration missing' });
        expect(io.seed).not.toHaveBeenCalled();
        expect(io.capture).not.toHaveBeenCalled();
    });

    it('does not capture after a failed initialization', async () => {
        io.seed.mockRejectedValueOnce(new Error('fixture seed unavailable'));
        const response = await GET(new Request('http://localhost/api/cron/continuous/snapshot'));
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'fixture seed unavailable' });
        expect(io.capture).not.toHaveBeenCalled();
    });

    it('reports a capture failure after initialization has completed', async () => {
        io.capture.mockImplementationOnce(async () => {
            io.order.push('capture');
            throw new Error('fixture capture unavailable');
        });
        const response = await GET(new Request('http://localhost/api/cron/continuous/snapshot'));
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'fixture capture unavailable' });
        expect(io.order).toEqual(['authorize', 'seed', 'capture']);
    });

    it('preserves a successful empty batch as zero', async () => {
        io.seed.mockResolvedValueOnce(0);
        io.capture.mockResolvedValueOnce({ captured: 0, total: 0 });
        const response = await GET(new Request('http://localhost/api/cron/continuous/snapshot'));
        expect(await response.json()).toEqual({
            ok: true,
            seededJobsForClients: 0,
            snapshotSummary: { captured: 0, total: 0 },
        });
    });
});
