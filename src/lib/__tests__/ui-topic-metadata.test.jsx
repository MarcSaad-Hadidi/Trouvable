import { describe, expect, it } from 'vitest';
import { EXPERTISES, VILLES } from '@/lib/data/geo-architecture';
import { resolveVilleComposition } from '@/lib/data/composition';
import { SITE_URL } from '@/lib/site-config';
import { fitMetaDescription, withPublicAuthor } from '@/lib/seo/metadata';
import * as city from '@/features/public/city/VillePage';
import * as expertise from '@/features/public/expertise/ExpertisePage';

describe.each([
    ['villes', 'villeSlug', VILLES, city],
    ['expertises', 'expertiseSlug', EXPERTISES, expertise],
])('%s metadata', (route, param, entries, page) => {
    it('preserves every canonical URL, title, author and social image contract', async () => {
        expect(page.generateStaticParams()).toEqual(entries.map((entry) => ({ [param]: entry.slug })));
        for (const entry of entries) {
            const title =
                route === 'villes'
                    ? `Visibilité IA à ${entry.name} | Trouvable`
                    : `${entry.name} | Visibilité IA | Trouvable`;
            const description = fitMetaDescription(
                route === 'villes'
                    ? resolveVilleComposition(entry)?.metaDescription || entry.description
                    : entry.description,
            );
            const url = `${SITE_URL}/${route}/${entry.slug}`;
            const metadata = await page.generateMetadata({ params: Promise.resolve({ [param]: entry.slug }) });
            expect(metadata).toEqual(
                withPublicAuthor({
                    title,
                    description,
                    alternates: { canonical: url },
                    openGraph: {
                        title,
                        description,
                        url,
                        siteName: 'Trouvable',
                        type: 'website',
                        images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: title }],
                    },
                    twitter: { card: 'summary_large_image', title, description, images: [`${SITE_URL}/twitter-image`] },
                    robots: { index: true, follow: true },
                }),
            );
        }
    });
    it('keeps unknown slug metadata empty', async () => {
        expect(await page.generateMetadata({ params: Promise.resolve({ [param]: 'not-a-topic' }) })).toEqual({});
    });
});
