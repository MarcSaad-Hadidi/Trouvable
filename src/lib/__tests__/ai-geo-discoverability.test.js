import { describe, expect, it } from 'vitest';
import { AI_SERVICE_PAYLOAD, AI_SUMMARY_PAYLOAD } from '@/lib/agent-discovery/public-data';
import { buildMcpDescriptorPayload } from '@/lib/agent-discovery/mcp-tools';
import { SEO_GROWTH_PAGES, buildSeoGrowthArticleSchema, buildSeoGrowthItemListSchema, buildSeoGrowthMetadata } from '@/lib/data/seo-growth-pages';
import { HOME_FAQS } from '@/features/public/home/home-faqs';
import { META_DESCRIPTION_MAX, META_DESCRIPTION_MIN, fitMetaDescription } from '@/lib/seo/metadata';
import { SITE_NAME, SITE_SAME_AS, SITE_URL } from '@/lib/site-config';

function wordCount(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

describe('AI and GEO public discovery', () => {
    it('serves hardened AI summary and service payloads', () => {
        expect(AI_SUMMARY_PAYLOAD.site_name).toBe(SITE_NAME);
        expect(AI_SUMMARY_PAYLOAD.site_url).toBe(SITE_URL);
        expect(AI_SUMMARY_PAYLOAD.description.length).toBeGreaterThan(80);
        expect(AI_SUMMARY_PAYLOAD.author.name).toBe(SITE_NAME);
        expect(AI_SUMMARY_PAYLOAD.same_as).toEqual(SITE_SAME_AS);
        expect(AI_SUMMARY_PAYLOAD.discovery.summary_json).toBe(`${SITE_URL}/ai/summary.json`);
        expect(AI_SUMMARY_PAYLOAD.discovery.webmcp).toBe(`${SITE_URL}/.well-known/webmcp.json`);
        expect(AI_SUMMARY_PAYLOAD.top_pages.some((page) => page.url === `${SITE_URL}/a-propos`)).toBe(true);

        expect(AI_SERVICE_PAYLOAD.site_name).toBe(SITE_NAME);
        expect(AI_SERVICE_PAYLOAD.same_as).toEqual(SITE_SAME_AS);
        expect(AI_SERVICE_PAYLOAD.services.length).toBeGreaterThan(3);
    });

    it('keeps sameAs limited to verified official profiles', () => {
        expect(SITE_SAME_AS).toEqual(['https://www.linkedin.com/company/trouvable']);
        expect(SITE_SAME_AS.join(' ')).not.toMatch(/wikipedia|wikidata|crunchbase/i);
    });

    it('exposes a stable WebMCP descriptor through the shared builder and well-known route', async () => {
        const descriptor = buildMcpDescriptorPayload();
        expect(descriptor.url).toBe(`${SITE_URL}/mcp`);
        expect(descriptor.declarationUrl).toBe(`${SITE_URL}/.well-known/webmcp.json`);
        expect(descriptor.tools.map((tool) => tool.name)).toEqual(['navigate_page', 'open_contact_page', 'search_site']);

        const mod = await import('../../app/.well-known/webmcp.json/route.js');
        const response = mod.GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('max-age=300');
        expect(body.declarationUrl).toBe(`${SITE_URL}/.well-known/webmcp.json`);
    });
});

describe('public metadata and schema helpers', () => {
    it('fits generated SEO/GEO metadata descriptions to snippet length', () => {
        for (const page of SEO_GROWTH_PAGES) {
            const metadata = buildSeoGrowthMetadata(page);
            expect(metadata.description.length, page.slug).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
            expect(metadata.description.length, page.slug).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
            expect(metadata.openGraph.description.length, page.slug).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
            expect(metadata.authors[0].name).toBe(SITE_NAME);
        }

        expect(fitMetaDescription('Court.').length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
    });

    it('builds Article and ItemList schema inputs for every SEO/GEO page', () => {
        for (const page of SEO_GROWTH_PAGES) {
            const article = buildSeoGrowthArticleSchema(page);
            const itemList = buildSeoGrowthItemListSchema(page);

            expect(article.url).toBe(`${SITE_URL}${page.path}`);
            expect(article.headline).toBe(page.h1);
            expect(article.references.length).toBeGreaterThan(0);
            expect(itemList.id).toBe(`${SITE_URL}${page.path}#key-items`);
            expect(itemList.items.length).toBeGreaterThan(0);
        }
    });

    it('keeps homepage FAQ answers in the citation-friendly 40 to 60 word range', () => {
        for (const faq of HOME_FAQS) {
            expect(wordCount(faq.answer), faq.question).toBeGreaterThanOrEqual(40);
            expect(wordCount(faq.answer), faq.question).toBeLessThanOrEqual(60);
        }
    });
});
