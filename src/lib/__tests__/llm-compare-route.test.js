import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const requireAdminMock = vi.fn();
vi.mock('@/lib/auth', () => ({
    requireAdmin: requireAdminMock,
}));

const compareModelsMock = vi.fn();
vi.mock('@/lib/llm-comparison/compare-models', () => ({
    compareModels: compareModelsMock,
}));

describe('POST /api/admin/llm-compare', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAdminMock.mockResolvedValue({ email: 'admin@trouvable.local' });
    });

    it('returns normalized contract and does not leak secrets', { timeout: 15000 }, async () => {
        compareModelsMock.mockResolvedValue({
            contract_version: 'v1',
            input: { source_type: 'text', url: null, prompt: 'analyse', content_preview: 'preview' },
            results: [
                { provider: 'gemini', model: 'g', ok: true, status: 'success', latency_ms: 10, usage: {}, content: 'ok', error: null },
                { provider: 'groq', model: 'q', ok: true, status: 'success', latency_ms: 12, usage: {}, content: 'ok', error: null },
                { provider: 'mistral', model: 'm', ok: true, status: 'success', latency_ms: 14, usage: {}, content: 'ok', error: null },
                { provider: 'openrouter', model: 'o', ok: true, status: 'success', latency_ms: 16, usage: {}, content: 'ok', error: null },
            ],
        });

        process.env.GOOGLE_API_KEY = 'test-google-key';
        process.env.GROQ_API_KEY = 'test-groq-key';
        process.env.MISTRAL_API_KEY = 'test-mistral-key';
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

        const { POST } = await import('@/app/api/admin/llm-compare/route');
        const response = await POST(new Request('http://localhost/api/admin/llm-compare', {
            method: 'POST',
            body: JSON.stringify({ text: 'raw input', prompt: 'analyse' }),
        }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.contract_version).toBe('v1');
        expect(json.results).toHaveLength(4);
        expect(JSON.stringify(json)).not.toContain('test-google-key');
        expect(JSON.stringify(json)).not.toContain('test-groq-key');
        expect(JSON.stringify(json)).not.toContain('test-mistral-key');
        expect(JSON.stringify(json)).not.toContain('test-openrouter-key');
    });

    it('maps typed comparison errors to stable JSON error', async () => {
        const { LlmComparisonError } = await import('@/lib/llm-comparison/response-contract');
        compareModelsMock.mockRejectedValue(new LlmComparisonError('input_error', 'prompt manquant'));

        const { POST } = await import('@/app/api/admin/llm-compare/route');
        const response = await POST(new Request('http://localhost/api/admin/llm-compare', {
            method: 'POST',
            body: JSON.stringify({ text: 'raw input', prompt: 'x' }),
        }));
        const json = await response.json();
        expect(response.status).toBe(400);
        expect(json.error.class).toBe('input_error');
    });
});
