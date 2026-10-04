import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { SEO_GROWTH_PAGES } from '@/lib/data/seo-growth-pages';
import AiOverviewsPage from '@/features/public/seo-growth/pages/AiOverviewsPage';
import ChatgptPage from '@/features/public/seo-growth/pages/ChatgptPage';
import ClaudePage from '@/features/public/seo-growth/pages/ClaudePage';
import CopilotPage from '@/features/public/seo-growth/pages/CopilotPage';
import GeminiPage from '@/features/public/seo-growth/pages/GeminiPage';
import PerplexityPage from '@/features/public/seo-growth/pages/PerplexityPage';
import Navbar from '@/features/public/shared/Navbar';

it.each([
    ['ai-overviews', AiOverviewsPage],
    ['chatgpt', ChatgptPage],
    ['claude', ClaudePage],
    ['copilot', CopilotPage],
    ['gemini', GeminiPage],
    ['perplexity', PerplexityPage],
])('%s renders its native logo sources and semantic content', (slug, Component) => {
    const page = SEO_GROWTH_PAGES.find((candidate) => candidate.slug === slug);
    expect(page).toBeDefined();
    const html = renderToStaticMarkup(createElement(Component, { page, trustBrief: null }));
    expect(html).toContain('<h1');
    const images = html.match(/<img\b[^>]*>/g);
    expect(images?.length).toBeGreaterThan(0);
    for (const image of images) {
        expect(image).toContain('src="/logos/');
        expect(image).toMatch(/width="\d+"/);
        expect(image).toMatch(/height="\d+"/);
        expect(image).toContain('loading="eager"');
        expect(image).not.toContain('/_next/image');
        expect(image).not.toContain('srcSet');
    }
});

it('keeps the navigation logo size, alt text and source', () => {
    const html = renderToStaticMarkup(createElement(Navbar));
    const image = html.match(/<img\b[^>]*>/)?.[0];
    expect(image).toContain('width="22"');
    expect(image).toContain('height="22"');
    expect(image).toContain('alt="Logo Trouvable"');
    expect(image).toContain('src="/logos/trouvable_logo_blanc1.png"');
    expect(image).not.toContain('/_next/image');
});
