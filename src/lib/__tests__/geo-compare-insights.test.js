import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('geo compare insights', () => {
    it('parses normalized API response into provider GEO insights', async () => {
        const { buildComparisonViewModel } = await import('@/lib/llm-comparison/geo-insights');
        const vm = buildComparisonViewModel({
            contract_version: 'v1',
            input: { source_type: 'text', prompt: 'x', content_preview: 'y' },
            results: [
                {
                    provider: 'gemini',
                    model: 'g',
                    ok: true,
                    status: 'success',
                    latency_ms: 1200,
                    usage: {},
                    content: 'Voir https://example.com et https://competitor.com',
                    error: null,
                },
            ],
        }, {
            targetName: 'Trouvable',
            targetDomain: 'trouvable.com',
            competitors: ['competitor'],
        });

        expect(vm.contract_version).toBe('v1');
        expect(vm.results[0].geo.citations_count).toBeGreaterThanOrEqual(1);
        expect(vm.results[0].geo.competitors_count).toBeGreaterThanOrEqual(1);
    });

    it('handles partial provider errors honestly', async () => {
        const { buildComparisonViewModel } = await import('@/lib/llm-comparison/geo-insights');
        const vm = buildComparisonViewModel({
            results: [
                { provider: 'gemini', model: 'g', ok: true, status: 'success', latency_ms: 100, usage: {}, content: 'ok', error: null },
                { provider: 'groq', model: 'q', ok: false, status: 'error', latency_ms: 80, usage: null, content: null, error: { class: 'timeout', message: 'timeout' } },
            ],
        }, {});

        expect(vm.has_partial_error).toBe(true);
        expect(vm.has_full_error).toBe(false);
        expect(vm.summary.error_count).toBe(1);
        expect(vm.summary.successful_count).toBe(1);
    });

    it('builds comparative summary for decision support', async () => {
        const { buildComparisonViewModel } = await import('@/lib/llm-comparison/geo-insights');
        const vm = buildComparisonViewModel({
            results: [
                { provider: 'gemini', model: 'g', ok: true, status: 'success', latency_ms: 100, usage: {}, content: 'https://a.com https://b.com brand', error: null },
                { provider: 'groq', model: 'q', ok: true, status: 'success', latency_ms: 100, usage: {}, content: 'https://a.com', error: null },
                { provider: 'mistral', model: 'm', ok: true, status: 'success', latency_ms: 100, usage: {}, content: 'short', error: null },
            ],
        }, {
            targetName: 'brand',
            competitors: ['rival'],
        });

        expect(vm.summary.best_overall_provider).toBeTruthy();
        expect(vm.summary.most_citations_provider).toBeTruthy();
        expect(Array.isArray(vm.hints)).toBe(true);
    });

    it('detects competitors from structured markdown response', async () => {
        const { buildComparisonViewModel } = await import('@/lib/llm-comparison/geo-insights');
        const vm = buildComparisonViewModel({
            results: [
                {
                    provider: 'gemini',
                    model: 'g',
                    ok: true,
                    status: 'success',
                    latency_ms: 100,
                    usage: {},
                    content: `
Voici 3 options concurrentes a Trouvable:
### 1. **BrightLocal**
Description
### 2. **Yext**
Description
### 3. **LocalClarity**
Description
`,
                    error: null,
                },
            ],
        }, {
            targetName: 'Trouvable',
            targetDomain: 'trouvable.com',
            competitors: [],
        });

        expect(vm.results[0].geo.competitors_count).toBeGreaterThanOrEqual(3);
        expect(vm.results[0].geo.competitors_detected).toEqual(
            expect.arrayContaining(['BrightLocal', 'Yext', 'LocalClarity'])
        );
    });

    it('does not treat generic use-case sections as competitors', async () => {
        const { buildComparisonViewModel } = await import('@/lib/llm-comparison/geo-insights');
        const vm = buildComparisonViewModel({
            results: [
                {
                    provider: 'gemini',
                    model: 'g',
                    ok: true,
                    status: 'success',
                    latency_ms: 100,
                    usage: {},
                    content: `
### **1. Entreprises avec une visibilité Google insuffisante**
Texte explicatif
### **2. Entreprises locales dont l'activité est mal comprise par les IA**
Texte explicatif
### **Secteurs cibles prioritaires**
1. **Restaurants & Gastronomie**
2. **Immobilier & Courtiers**
`,
                    error: null,
                },
            ],
        }, {
            targetName: 'Trouvable',
            targetDomain: 'trouvable.com',
            competitors: [],
        });

        expect(vm.results[0].geo.competitors_count).toBe(0);
        expect(vm.results[0].geo.competitors_detected).toEqual([]);
    });
});
