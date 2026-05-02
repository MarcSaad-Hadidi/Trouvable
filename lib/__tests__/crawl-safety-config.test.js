import { describe, expect, it, vi } from 'vitest';

describe('crawl safety config', () => {
    it('uses frontier exhaustion with safety ceilings instead of a fixed 10 page cap', async () => {
        vi.resetModules();
        delete process.env.AUDIT_MAX_PAGES;
        const { getCrawlSafetyCeiling } = await import('@/lib/audit/audit-config');

        const ceiling = getCrawlSafetyCeiling();

        expect(ceiling.maxPages).toBeGreaterThan(10);
        expect(ceiling.maxFetchAttempts).toBeGreaterThan(10);
        expect(ceiling.maxDurationMs).toBeGreaterThan(60_000);
    });

    it('clamps caller-provided page ceilings as guardrails', async () => {
        vi.resetModules();
        process.env.AUDIT_MAX_PAGES = '12';
        const { getCrawlSafetyCeiling } = await import('@/lib/audit/audit-config');

        expect(getCrawlSafetyCeiling().maxPages).toBe(12);
        delete process.env.AUDIT_MAX_PAGES;
    });
});
