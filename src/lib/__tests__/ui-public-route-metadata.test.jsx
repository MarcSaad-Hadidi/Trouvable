import { describe, expect, it } from 'vitest';
import { metadata as offers } from '@/app/offres/page';
import { metadata as methodology } from '@/app/methodologie/layout';
import { metadata as contact } from '@/app/contact/layout';
import { metadata as measurement } from '@/app/notre-mesure/layout';
import { metadata as cases } from '@/app/etudes-de-cas/layout';
import { metadata as dossier } from '@/app/etudes-de-cas/dossier-type/layout';
import { buildPublicMetadata, fitMetaDescription } from '@/lib/seo/metadata';
import { SITE_URL } from '@/lib/site-config';

describe.each([
    ['/offres', offers],
    ['/methodologie', methodology],
    ['/contact', contact],
    ['/notre-mesure', measurement],
    ['/etudes-de-cas', cases],
    ['/etudes-de-cas/dossier-type', dossier],
])('public metadata for %s', (path, metadata) => {
    it('identifies the current page in its canonical and Open Graph URLs', () => {
        expect(metadata.alternates?.canonical).toBe(`${SITE_URL}${path}`);
        expect(metadata.openGraph.url).toBe(`${SITE_URL}${path}`);
    });

    it('keeps a title, bounded description and existing shared social endpoints', () => {
        expect(metadata.title).toBeTruthy();
        expect(metadata.description.length).toBeLessThanOrEqual(158);
        expect(metadata.openGraph.title).toBe(metadata.title);
        expect(metadata.openGraph.description).toBe(metadata.description);
        expect(metadata.openGraph.images).toEqual([
            { url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: metadata.title },
        ]);
        expect(metadata.twitter.card).toBe('summary_large_image');
        expect(metadata.twitter.title).toBe(metadata.title);
        expect(metadata.twitter.description).toBe(metadata.description);
        expect(metadata.twitter.images).toEqual([`${SITE_URL}/twitter-image`]);
    });
});

describe('public metadata defaults', () => {
    it('preserves caller social images, URL, card and indexing restrictions without mutation', () => {
        const openGraph = {
            title: 'Specific title',
            description: 'Specific description',
            url: `${SITE_URL}/a-propos`,
            images: [{ url: `${SITE_URL}/icon.png`, alt: 'Existing icon' }],
        };
        const twitter = { card: 'summary', images: [`${SITE_URL}/icon.png`] };
        const robots = { index: false, follow: false };
        const before = structuredClone({ openGraph, twitter, robots });
        const metadata = buildPublicMetadata({
            title: 'Title',
            description: 'Description',
            canonical: `${SITE_URL}/recherche`,
            openGraph,
            twitter,
            robots,
        });
        expect(metadata.openGraph).toEqual({
            ...openGraph,
            description: fitMetaDescription(openGraph.description),
        });
        expect(metadata.twitter).toMatchObject(twitter);
        expect(metadata.robots).toEqual(robots);
        expect({ openGraph, twitter, robots }).toEqual(before);
    });

    it('respects deliberately empty image lists', () => {
        const metadata = buildPublicMetadata({
            title: 'Title',
            description: 'Description',
            openGraph: { images: [] },
            twitter: { images: [] },
        });
        expect(metadata.openGraph.images).toEqual([]);
        expect(metadata.twitter.images).toEqual([]);
    });

    it('does not invent a canonical URL for a caller that omits it', () => {
        const metadata = buildPublicMetadata({ title: 'Title', description: 'Description' });
        expect(metadata.alternates).toBeUndefined();
        expect(metadata.openGraph.url).toBeUndefined();
    });
});
