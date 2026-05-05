import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const pages = new Map();
const requestedUrls = [];

vi.mock('../audit/playwright-renderer.js', () => ({
    createPlaywrightRenderer: vi.fn(async () => ({
        available: false,
        reason: 'disabled_for_test',
        close: vi.fn(async () => {}),
    })),
}));

vi.mock('../audit/url-safety.js', () => ({
    fetchPublicResource: vi.fn(async (url) => {
        requestedUrls.push(url);
        const normalized = String(url).replace(/\/$/, '');
        const html = pages.get(normalized);
        if (!html) {
            return new Response('missing', {
                status: 404,
                headers: { 'content-type': 'text/html' },
            });
        }
        return new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html' },
        });
    }),
}));

function html({ title, links = [] }) {
    return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${links.map((href) => `<a href="${href}">${href}</a>`).join(' ')}</body></html>`;
}

describe('site audit crawler frontier behavior', () => {
    beforeEach(() => {
        vi.resetModules();
        pages.clear();
        requestedUrls.length = 0;
        process.env.AUDIT_SITEMAP_FIRST_DISABLED = '1';
        delete process.env.AUDIT_MAX_PAGES;
        delete process.env.AUDIT_MAX_FETCH_ATTEMPTS;
        delete process.env.AUDIT_LINK_EXTRACTION_DEPTH;
    });

    it('can crawl more than 10 pages and stops by frontier exhaustion', async () => {
        const links = [];
        for (let i = 1; i <= 12; i += 1) {
            links.push(`/page-${i}`);
            pages.set(`https://example.com/page-${i}`, html({ title: `Page ${i}` }));
        }
        pages.set('https://example.com', html({ title: 'Home', links }));

        const { runSiteAudit } = await import('../audit/scanner.js');
        const result = await runSiteAudit('https://example.com/');
        const metadata = result.extracted_data.layered_v1_layer1.crawl_metadata;

        expect(result.scanned_pages.filter((page) => page.success)).toHaveLength(13);
        expect(metadata.stopped_reason).toBe('frontier_exhausted');
        expect(metadata.limit_reason).toBeNull();
    }, 15_000);

    it('skips external hosts and records skipped reasons', async () => {
        pages.set('https://example.com', html({
            title: 'Home',
            links: ['/about', 'https://evil.test/private'],
        }));
        pages.set('https://example.com/about', html({ title: 'About' }));

        const { runSiteAudit } = await import('../audit/scanner.js');
        const result = await runSiteAudit('https://example.com/');
        const metadata = result.extracted_data.layered_v1_layer1.crawl_metadata;

        expect(requestedUrls).not.toContain('https://evil.test/private');
        expect(metadata.skipped_reasons.external_host).toBeGreaterThan(0);
        expect(metadata.skipped_urls.some((entry) => entry.reason === 'external_host')).toBe(true);
    });
});
