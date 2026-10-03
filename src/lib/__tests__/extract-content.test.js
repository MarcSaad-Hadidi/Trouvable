import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('extractInputContent', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('normalizes raw text input', async () => {
        const { extractInputContent } = await import('@/lib/llm-comparison/extract-content');
        const result = await extractInputContent({
            text: '  Bonjour \n\n le   monde  ',
            sourceType: 'text',
        });

        expect(result.source_type).toBe('text');
        expect(result.content).toBe('Bonjour le monde');
    });

    it('extracts readable content from URL HTML', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'text/html; charset=utf-8' },
            text: async () => '<html><head><title>Page test</title></head><body><script>x</script><main>Contenu utile</main></body></html>',
        }));

        const { extractInputContent } = await import('@/lib/llm-comparison/extract-content');
        const result = await extractInputContent({ url: 'https://example.com', sourceType: 'url' });
        expect(result.source_type).toBe('url');
        expect(result.content).toContain('Page test');
        expect(result.content).toContain('Contenu utile');
    }, 30000);
});
