import { describe, expect, it } from 'vitest';

import { normalizeUrl } from '../audit/layer1/url-utils.js';

describe('crawl URL normalization', () => {
    it('drops tracking query params and sorts retained params', () => {
        expect(normalizeUrl('https://example.com/path?b=2&utm_source=x&a=1&fbclid=abc#section'))
            .toBe('https://example.com/path?a=1&b=2');
    });

    it('bounds noisy faceted query loops', () => {
        expect(normalizeUrl('https://example.com/search?q=test&page=2&sort=asc&filter=one&color=red&size=large'))
            .toBeNull();
    });
});
