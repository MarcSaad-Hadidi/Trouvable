import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { normalizeText, createSeoQueryMatcher } from '../operator-intelligence/seo-query-matching';
import { getPathname, getPrimarySegment } from '../operator-intelligence/seo-gsc';
const content = createSeoQueryMatcher();
const cannibalization = createSeoQueryMatcher({ additionalStopwords: ['blog', 'actualites', 'actualite'] });
describe('SEO editorial query matching', () => {
    it('normalizes French accents and casing without changing token boundaries', () => {
        expect(normalizeText('Électricité À Montréal')).toBe('electricite a montreal');
        expect(content.tokenize('Électricité À Montréal')).toEqual(['electricite', 'montreal']);
    });
    it.each([null, undefined, '', false, 0])('retains empty-input matching for %s', (value) => {
        expect(content.tokenize(value)).toEqual([]);
        expect(content.overlapScore(value, 'Montréal')).toBe(0);
        expect(content.sharedTokens(value, 'Montréal')).toEqual([]);
    });
    it('filters common stopwords and short tokens but keeps repetitions in tokenization', () => {
        expect(content.tokenize('services dans www.example.com: SEO SEO pour Montréal 42')).toEqual([
            'example',
            'seo',
            'seo',
            'montreal',
        ]);
    });
    it('keeps shared tokens unique and in left-hand order', () => {
        expect(
            content.sharedTokens('Montréal plomberie plomberie urgence', 'urgence Montreal ailleurs plomberie'),
        ).toEqual(['montreal', 'plomberie', 'urgence']);
    });
    it('divides unique overlap by the larger set, including meaningful zero and full matches', () => {
        expect(content.overlapScore('plomberie plomberie Montreal', 'Montreal urgence entretien')).toBe(1 / 3);
        expect(content.overlapScore('plomberie', 'urgence')).toBe(0);
        expect(content.overlapScore('plomberie Montreal', 'MONTRÉAL plomberie plomberie')).toBe(1);
    });
    it('preserves the domain-specific blog/news stopwords rather than silently making both surfaces identical', () => {
        expect(content.tokenize('Blog actualités actualité plomberie')).toEqual([
            'blog',
            'actualites',
            'actualite',
            'plomberie',
        ]);
        expect(cannibalization.tokenize('Blog actualités actualité plomberie')).toEqual(['plomberie']);
        expect(content.overlapScore('blog plomberie', 'blog urgence')).toBe(0.5);
        expect(cannibalization.overlapScore('blog plomberie', 'blog urgence')).toBe(0);
    });
    it('keeps configured matching independent from the default matcher', () => {
        const configured = createSeoQueryMatcher({ additionalStopwords: ['montreal'] });
        expect(configured.tokenize('Montréal plomberie')).toEqual(['plomberie']);
        expect(content.tokenize('Montréal plomberie')).toEqual(['montreal', 'plomberie']);
    });
});
describe('persisted SEO page paths', () => {
    it.each([null, undefined, '', '/relative', 'invalid URL'])('retains unknown paths as null for %s', (value) => {
        expect(getPathname(value)).toBeNull();
        expect(getPrimarySegment(value)).toBeNull();
    });
    it('preserves pathname case, root absence, slash normalization and first segment', () => {
        expect(getPathname('https://example.test')).toBe('/');
        expect(getPrimarySegment('https://example.test')).toBeNull();
        expect(getPathname('https://example.test//Services///Urgence/?q=SEO#topic')).toBe('/Services/Urgence');
        expect(getPrimarySegment('https://example.test//Services///Urgence/?q=SEO#topic')).toBe('Services');
    });
});
