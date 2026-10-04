import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/og', () => ({
    ImageResponse: class {
        constructor(element, options) {
            this.element = element;
            this.options = options;
        }
    },
}));

import * as openGraph from '@/app/opengraph-image';
import * as twitter from '@/app/twitter-image';

describe('social image entry points', () => {
    it.each([
        ['Open Graph', openGraph],
        ['Twitter', twitter],
    ])('%s preserves metadata and image size', (name, entry) => {
        expect(entry.runtime).toBe('edge');
        expect(entry.alt).toBe('Trouvable | Firme de visibilité Google et réponses IA');
        expect(entry.size).toEqual({ width: 1200, height: 630 });
        expect(entry.contentType).toBe('image/png');
        expect(entry.default().options).toEqual(entry.size);
    });

    it('renders the same public copy and layout for both conventions', () => {
        const html = renderToStaticMarkup(openGraph.default().element);
        expect(renderToStaticMarkup(twitter.default().element)).toBe(html);
        expect(html).toContain('Firme de visibilité');
        expect(html).toContain('Vous déléguez, nous exécutons.');
        expect(html).toContain('trouvable.app');
        expect(html).toContain('background-color:#080808');
        expect(html).toContain('padding:60px 80px');
    });
});
