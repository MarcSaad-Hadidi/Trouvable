import { describe, it, expect } from 'vitest';
import {
    extractUrlsFromText,
    normalizeDomainHost,
    hostnameFromUrl,
    classifySourceType,
    computeSourceConfidence,
} from '../geo-query-utils.js';

describe('extractUrlsFromText', () => {
    it('extracts valid URLs from text', () => {
        const text = 'Check https://example.com/page and http://other.org for info';
        const urls = extractUrlsFromText(text);
        expect(urls).toContain('https://example.com/page');
        expect(urls).toContain('http://other.org');
    });

    it('filters non-citation URLs (images, tracking, CDN)', () => {
        const text = [
            'Source: https://editorial.com/article',
            'Image: https://cdn.example.com/photo.jpg',
            'Tracking: https://example.com?utm_source=test&gclid=abc',
            'Font: https://fonts.googleapis.com/css2',
            'Analytics: https://www.googletagmanager.com/gtag.js',
        ].join('\n');
        const urls = extractUrlsFromText(text);
        expect(urls).toContain('https://editorial.com/article');
        expect(urls).not.toContain('https://cdn.example.com/photo.jpg');
        expect(urls).not.toContain('https://fonts.googleapis.com/css2');
    });

    it('filters Google API assets by hostname, not URL substring', () => {
        const text = [
            'Font: https://fonts.googleapis.com/css2',
            'Fake: https://editorial.com/article?next=fonts.googleapis.com',
        ].join('\n');
        const urls = extractUrlsFromText(text);

        expect(urls).not.toContain('https://fonts.googleapis.com/css2');
        expect(urls).toContain('https://editorial.com/article?next=fonts.googleapis.com');
    });

    it('returns empty for null/empty input', () => {
        expect(extractUrlsFromText(null)).toEqual([]);
        expect(extractUrlsFromText('')).toEqual([]);
    });

    it('deduplicates URLs', () => {
        const text = 'Visit https://example.com and again https://example.com end.';
        const urls = extractUrlsFromText(text);
        expect(urls.length).toBe(1);
    });
});

describe('normalizeDomainHost', () => {
    it('strips protocol, www, path, port, trailing dot', () => {
        expect(normalizeDomainHost('https://www.Example.COM/page?q=1')).toBe('example.com');
        expect(normalizeDomainHost('http://host.io:8080/path')).toBe('host.io');
        expect(normalizeDomainHost('example.com.')).toBe('example.com');
    });

    it('returns empty string for falsy input', () => {
        expect(normalizeDomainHost(null)).toBe('');
        expect(normalizeDomainHost('')).toBe('');
    });
});

describe('hostnameFromUrl', () => {
    it('extracts normalized hostname from full URL', () => {
        expect(hostnameFromUrl('https://www.example.com/path')).toBe('example.com');
    });

    it('handles non-URL input gracefully', () => {
        const result = hostnameFromUrl('not a url');
        expect(typeof result).toBe('string');
    });
});

describe('classifySourceType', () => {
    it('classifies review platforms', () => {
        expect(classifySourceType('yelp.com')).toBe('review_platform');
        expect(classifySourceType('www.tripadvisor.com')).toBe('review_platform');
        expect(classifySourceType('trustpilot.com')).toBe('review_platform');
    });

    it('classifies social media', () => {
        expect(classifySourceType('facebook.com')).toBe('social');
        expect(classifySourceType('linkedin.com')).toBe('social');
        expect(classifySourceType('youtube.com')).toBe('social');
    });

    it('classifies directories', () => {
        expect(classifySourceType('pagesjaunes.ca')).toBe('directory');
    });

    it('classifies client own domain', () => {
        expect(classifySourceType('myclient.com', 'https://www.myclient.com')).toBe('client_own');
    });

    it('classifies government domains', () => {
        expect(classifySourceType('canada.gc.ca')).toBe('government');
    });

    it('defaults to editorial for unknown domains', () => {
        expect(classifySourceType('some-blog.com')).toBe('editorial');
    });

    it('classifies encyclopedias', () => {
        expect(classifySourceType('en.wikipedia.org')).toBe('encyclopedia');
    });

    it('returns generic for null input', () => {
        expect(classifySourceType(null)).toBe('generic');
    });
});

describe('computeSourceConfidence', () => {
    it('gives higher confidence to review platforms', () => {
        const conf = computeSourceConfidence('https://yelp.com/biz/test', 'yelp.com', 'review_platform');
        expect(conf).toBeGreaterThanOrEqual(0.85);
    });

    it('gives lower confidence to client own domain', () => {
        const conf = computeSourceConfidence('https://myclient.com/about', 'myclient.com', 'client_own');
        expect(conf).toBeLessThanOrEqual(0.6);
    });

    it('gives lower confidence to forums', () => {
        const conf = computeSourceConfidence('https://reddit.com/r/test', 'reddit.com', 'forum');
        expect(conf).toBeLessThanOrEqual(0.7);
    });

    it('reduces confidence for very long URLs', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(250);
        const normal = computeSourceConfidence('https://example.com/page', 'example.com', 'editorial');
        const long = computeSourceConfidence(longUrl, 'example.com', 'editorial');
        expect(long).toBeLessThan(normal);
    });

    it('returns low confidence for missing data', () => {
        expect(computeSourceConfidence(null, null, 'generic')).toBe(0.3);
    });
});
