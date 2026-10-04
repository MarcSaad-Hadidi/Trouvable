import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    aggregatePageRows, filterRowsSince, getLatestObservedDate, getObservedAgeDays,
    getSinceDate, normalizeUrl, resolveConnectorStatus, weightedPosition,
} from '../operator-intelligence/seo-gsc';

afterEach(() => vi.useRealTimers());

describe('persisted GSC page projections', () => {
    it('merges historical URL variants with weighted positions and preserves the first observed URL', () => {
        const firstUrl = 'https://EXAMPLE.test/Services//?a=1';
        const pages = aggregatePageRows([
            { page: firstUrl, clicks: '2', impressions: '10', position: '4' },
            { page: 'https://example.test/services#section', clicks: 0, impressions: 30, position: 8 },
            { page: null, clicks: 99, impressions: 99, position: 1 },
        ]);
        expect([...pages]).toEqual([['https://example.test/services', {
            url: firstUrl, clicks: 2, impressions: 40, ctr: 0.05, position: 7,
        }]]);
    });

    it('keeps observed zero counts while ratios without an observation remain absent', () => {
        const pages = aggregatePageRows([
            { page: '/historical/', clicks: null, impressions: '', position: 'invalid' },
            { page: ' /other/ ', clicks: 'invalid', impressions: Infinity, position: 0 },
        ]);
        expect([...pages.values()]).toEqual([
            { url: '/historical/', clicks: 0, impressions: 0, ctr: null, position: null },
            { url: '/other/', clicks: 0, impressions: 0, ctr: null, position: null },
        ]);
        expect(aggregatePageRows(null).size).toBe(0);
        expect(aggregatePageRows([]).size).toBe(0);
    });

    it('falls back to the mean positive position only when impressions are absent', () => {
        const pages = aggregatePageRows([
            { page: '/page', impressions: 0, position: 4 },
            { page: '/page', impressions: 0, position: 8 },
            { page: '/page', impressions: 0, position: 0 },
        ]);
        expect(pages.get('/page')).toMatchObject({ position: 6, ctr: null });
        expect(weightedPosition(10, 0, 12, 2)).toBe(0);
        expect(weightedPosition(0, 0, 0, 0)).toBeNull();
    });

    it('retains historical URL identity including relative paths and origin', () => {
        expect(normalizeUrl('https://Example.test/A//B/?x=1#h')).toBe('https://example.test/a/b');
        expect(normalizeUrl('https://Example.test/')).toBe('https://example.test/');
        expect(normalizeUrl(' /Relative/ ')).toBe('/relative/');
        expect(normalizeUrl('')).toBeNull();
        expect(normalizeUrl(12)).toBeNull();
    });

    it('keeps the inclusive current window, observed date and synchronization date independent', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        const rows = [{ date: '2026-09-04' }, { date: '2026-09-05' }, { date: '2026-10-01' }, { date: '' }];
        expect(getSinceDate(28)).toBe('2026-09-05');
        expect(filterRowsSince(rows, getSinceDate(28))).toEqual(rows.slice(1, 3));
        expect(getLatestObservedDate(rows)).toBe('2026-10-01');
        expect(getObservedAgeDays('2026-10-01')).toBe(2);
        expect(getObservedAgeDays('invalid')).toBeNull();
        expect(getObservedAgeDays(null)).toBeNull();
        expect(resolveConnectorStatus([{ provider: 'gsc', status: 'error', last_synced_at: '2026-10-03', last_error: 'sync failed' }], 'gsc'))
            .toEqual({ status: 'error', lastSyncedAt: '2026-10-03', lastError: 'sync failed' });
        expect(resolveConnectorStatus([{ provider: 'ga4', status: 'healthy' }], 'gsc'))
            .toEqual({ status: 'not_connected', lastSyncedAt: null, lastError: null });
    });
});
