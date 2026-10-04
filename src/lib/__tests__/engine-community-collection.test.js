import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const web = vi.hoisted(() => ({ available: vi.fn(), collect: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/agent-reach/web-search-collector', () => ({
    isWebSearchAvailable: web.available,
    collectViaWebSearch: web.collect,
}));
import { collectCommunityPosts } from '@/lib/agent-reach/community-collection';

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    web.available.mockReturnValue(false);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function collect(seeds = [{ query: 'Acme', strategy: 'brand' }], subreddits = []) {
    const pending = collectCommunityPosts(seeds, subreddits);
    await vi.runAllTimersAsync();
    return pending;
}

describe('community collector bounded network effects', () => {
    it.each([
        [403, 1, 'source_access_failure'],
        [401, 1, 'source_auth_required'],
        [429, 3, 'source_rate_limited'],
        [503, 3, 'temporary_network_failure'],
        [400, 1, 'unknown_collection_failure'],
    ])('bounds HTTP %s retries to %s calls and classifies the failure', async (status, calls, failureClass) => {
        const times = [];
        fetch.mockImplementation(async () => {
            times.push(Date.now());
            return { ok: false, status };
        });
        const result = await collect();
        expect(fetch).toHaveBeenCalledTimes(calls);
        expect(result.seedDiagnostics).toEqual([
            expect.objectContaining({ status: 'error', failure_class: failureClass, http_status: status }),
        ]);
        if (calls === 3) expect(times.slice(1).map((time, i) => time - times[i])).toEqual([2000, 4000]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts every timed-out attempt and clears timers after bounded retries', async () => {
        const signals = [];
        fetch.mockImplementation(
            (url, { signal }) =>
                new Promise((resolve, reject) => {
                    signals.push(signal);
                    signal.addEventListener('abort', () => reject(new Error('abort timeout')), { once: true });
                }),
        );
        const result = await collect();
        expect(signals).toHaveLength(3);
        expect(signals.every((signal) => signal.aborted)).toBe(true);
        expect(result.seedDiagnostics[0]).toMatchObject({
            failure_class: 'temporary_network_failure',
            http_status: null,
        });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps query order and pacing, scopes the first two seeds, and deduplicates by post id', async () => {
        const times = [];
        fetch.mockImplementation(async () => {
            times.push(Date.now());
            return {
                ok: true,
                json: async () => ({
                    data: {
                        children: [
                            {
                                data: {
                                    id: 'same',
                                    title: 'First title',
                                    selftext: 'body',
                                    subreddit: 'SEO',
                                    ups: 0,
                                    created_utc: 1,
                                    permalink: '/r/SEO/same',
                                },
                            },
                        ],
                    },
                }),
            };
        });
        const result = await collect(
            ['first', { query: 'second', strategy: 'topic' }],
            ['r/SEO', '', 'marketing', 'ignored'],
        );
        expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
            '/search.json',
            '/search.json',
            '/r/SEO/search.json',
            '/r/SEO/search.json',
            '/r/marketing/search.json',
            '/r/marketing/search.json',
        ]);
        expect(result.seedDiagnostics.map((diagnostic) => diagnostic.strategy)).toEqual([
            'legacy',
            'topic',
            'community',
            'community',
            'community',
            'community',
        ]);
        expect(times.slice(1).map((time, i) => time - times[i])).toEqual([1500, 1500, 1500, 1500, 1500]);
        expect(result.rawPosts).toEqual([
            expect.objectContaining({
                id: 'same',
                seed_query: 'first',
                ups: 0,
                created_at: '1970-01-01T00:00:01.000Z',
            }),
        ]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not fallback after a successful zero-result response or a partially successful collection', async () => {
        web.available.mockReturnValue(true);
        fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { children: [] } }) });
        expect((await collect()).collectionOutcome.failureClass).toBe('seed_quality_failure');
        expect(web.collect).not.toHaveBeenCalled();
        fetch
            .mockResolvedValueOnce({ ok: false, status: 403 })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { children: [{ data: { id: 'one', title: 'found' } }] } }),
            });
        const partial = await collect(['first', 'second']);
        expect(partial.collectionOutcome).toMatchObject({ failureClass: null, summary: { ok: 1, error: 1 } });
        expect(web.collect).not.toHaveBeenCalled();
    });

    it('retains both collectors diagnostics when the fallback is empty', async () => {
        web.available.mockReturnValue(true);
        fetch.mockResolvedValue({ ok: false, status: 403 });
        web.collect.mockResolvedValue({
            posts: [],
            provider: 'fixture',
            seedDiagnostics: [{ status: 'ok', results: 0 }],
        });
        const result = await collect();
        expect(result).toMatchObject({ collectionSource: 'reddit', webSearchProvider: null, rawPosts: [] });
        expect(result.seedDiagnostics).toEqual([
            expect.objectContaining({ collector: 'reddit', status: 'error' }),
            expect.objectContaining({ collector: 'web_search', status: 'ok', results: 0 }),
        ]);
        expect(result.collectionOutcome.isAccessFailure).toBe(false);
    });
});
