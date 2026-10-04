import { describe, expect, it } from 'vitest';
import { loadIndependentSources } from '../operator-intelligence/source-availability';

describe('independent source initialization', () => {
    it('starts every read in insertion order before yielding to a microtask', async () => {
        const calls = [];
        const pending = loadIndependentSources({
            traffic: () => {
                calls.push('traffic');
                return Promise.resolve([{ sessions: 0 }]);
            },
            pages: () => {
                calls.push('pages');
                return Promise.resolve([]);
            },
            connectors: () => {
                calls.push('connectors');
                return Promise.resolve(null);
            },
        });
        const immediateCalls = [...calls];
        const result = await pending;

        expect(immediateCalls).toEqual(['traffic', 'pages', 'connectors']);
        expect(result.dataSources).toEqual({ traffic: 'available', pages: 'empty', connectors: 'empty' });
        expect(result.values.traffic).toEqual([{ sessions: 0 }]);
    });

    it('starts independent reads even when an earlier loader throws synchronously', async () => {
        const calls = [];
        const pending = loadIndependentSources({
            traffic: () => {
                calls.push('traffic');
                throw new Error('private database credentials');
            },
            pages: () => {
                calls.push('pages');
                return [{ sessions: 0 }];
            },
            connectors: () => {
                calls.push('connectors');
                return Promise.resolve([]);
            },
        });
        const immediateCalls = [...calls];
        const result = await pending;

        expect(immediateCalls).toEqual(['traffic', 'pages', 'connectors']);
        expect(result.dataSources).toEqual({ traffic: 'unavailable', pages: 'available', connectors: 'empty' });
        expect(result.values).toEqual({ traffic: null, pages: [{ sessions: 0 }], connectors: [] });
        expect(result.errors).toEqual([{ source: 'traffic', message: 'Données temporairement indisponibles.' }]);
        expect(JSON.stringify(result)).not.toContain('private database credentials');
    });
});
