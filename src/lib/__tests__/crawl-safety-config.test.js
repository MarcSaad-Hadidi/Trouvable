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

    it('exposes configurable crawler and sitemap guardrails beyond page count', async () => {
        vi.resetModules();
        process.env.AUDIT_SITEMAP_SEED_LIMIT = '123';
        process.env.AUDIT_MAX_URLS_FROM_SITEMAP = '321';
        process.env.AUDIT_MAX_SITEMAP_DOCS = '9';
        process.env.AUDIT_LINK_EXTRACTION_DEPTH = '77';
        process.env.AUDIT_RENDER_ATTEMPT_LIMIT = '6';
        process.env.AUDIT_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT = '5';
        process.env.AUDIT_FULL_TIMEOUT_MS = '123456';

        const {
            getCrawlerRuntimeConfig,
            getFullAuditTimeoutMs,
            getSitemapDiscoveryConfig,
        } = await import('@/lib/audit/audit-config');

        expect(getCrawlerRuntimeConfig()).toMatchObject({
            sitemapSeedLimit: 123,
            linkExtractionDepth: 77,
            renderAttemptLimit: 6,
            renderFetchFailureAttemptLimit: 5,
        });
        expect(getSitemapDiscoveryConfig()).toMatchObject({
            maxUrlsFromSitemap: 321,
            maxSitemapDocs: 9,
        });
        expect(getFullAuditTimeoutMs()).toBe(123456);

        delete process.env.AUDIT_SITEMAP_SEED_LIMIT;
        delete process.env.AUDIT_MAX_URLS_FROM_SITEMAP;
        delete process.env.AUDIT_MAX_SITEMAP_DOCS;
        delete process.env.AUDIT_LINK_EXTRACTION_DEPTH;
        delete process.env.AUDIT_RENDER_ATTEMPT_LIMIT;
        delete process.env.AUDIT_RENDER_FETCH_FAILURE_ATTEMPT_LIMIT;
        delete process.env.AUDIT_FULL_TIMEOUT_MS;
    });
});
