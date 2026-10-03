import { describe, expect, it } from 'vitest';
import { AI_FAQ_PAYLOAD, AI_SERVICE_PAYLOAD, AI_SUMMARY_PAYLOAD, renderLlmsFullTxt, renderLlmsTxt } from '@/lib/agent-discovery/public-data';
import { SEO_GROWTH_PAGES, SEO_GROWTH_PAGE_PATHS } from '@/lib/data/seo-growth-pages';
import { SITE_URL } from '@/lib/site-config';

const REQUIRED_LINKS = ['/offres', '/methodologie', '/notre-mesure', '/villes/montreal', '/contact'];
const P1_PATHS = [
    '/agence-geo-montreal',
    '/services/audit-visibilite-ia',
    '/services/visibilite-google-reponses-ia',
    '/services/seo-ia-referencement-generatif',
    '/plateformes/chatgpt',
    '/plateformes/perplexity',
    '/plateformes/ai-overviews',
    '/ressources/geo-vs-seo',
];

const P2_PATHS = [
    '/agence-geo-quebec',
    '/services/accompagnement-geo',
    '/services/strategie-visibilite-ia',
    '/plateformes/gemini',
    '/plateformes/copilot',
    '/ressources/mesurer-visibilite-ia',
    '/ressources/structurer-site-moteurs-ia',
];

describe('SEO growth pages', () => {
    it('keeps URLs unique and includes the expected P1 and P2 paths', () => {
        const uniquePaths = new Set(SEO_GROWTH_PAGE_PATHS);

        expect(uniquePaths.size).toBe(SEO_GROWTH_PAGE_PATHS.length);
        for (const path of [...P1_PATHS, ...P2_PATHS]) {
            expect(SEO_GROWTH_PAGE_PATHS).toContain(path);
        }
    });

    it('defines the required conversion and SEO fields on every page', () => {
        for (const page of SEO_GROWTH_PAGES) {
            expect(page.title.length).toBeGreaterThan(20);
            expect(page.description.length).toBeGreaterThan(80);
            expect(page.h1.length).toBeGreaterThan(20);
            expect(page.keyword.length).toBeGreaterThan(3);
            expect(page.ctaLabel.length).toBeGreaterThan(5);
            expect(page.faqs.length).toBeGreaterThanOrEqual(4);
            expect(page.problems.length).toBeGreaterThanOrEqual(3);
            expect(page.corrections.length).toBeGreaterThanOrEqual(3);
            expect(page.deliverables.length).toBeGreaterThanOrEqual(3);
        }
    });

    it('includes required internal links for SEO/GEO discovery', () => {
        for (const page of SEO_GROWTH_PAGES) {
            const hrefs = page.internalLinks.map((link) => link.href);

            for (const requiredLink of REQUIRED_LINKS) {
                expect(hrefs).toContain(requiredLink);
            }
        }
    });

    it('exposes every P1 page through AI discovery payloads and llms files', () => {
        const summaryUrls = AI_SUMMARY_PAYLOAD.top_pages.map((entry) => entry.url);
        const serviceUrls = AI_SERVICE_PAYLOAD.services.map((entry) => entry.url);
        const faqSources = AI_FAQ_PAYLOAD.faqs.map((entry) => entry.source);
        const llms = renderLlmsTxt();
        const llmsFull = renderLlmsFullTxt();

        for (const page of SEO_GROWTH_PAGES) {
            const absoluteUrl = `${SITE_URL}${page.path}`;

            expect(summaryUrls).toContain(absoluteUrl);
            expect(faqSources.some((source) => source.startsWith(absoluteUrl))).toBe(true);
            expect(llms).toContain(absoluteUrl);
            expect(llmsFull).toContain(absoluteUrl);

            if (page.type === 'service') {
                expect(serviceUrls).toContain(absoluteUrl);
            }
        }
    });
});
