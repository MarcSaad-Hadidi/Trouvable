import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { callGroq } from '@/lib/ai/providers/groq';
import { callOpenRouter } from '@/lib/ai/providers/openrouter';

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('GROQ_API_KEY', 'groq-fixture');
    vi.stubEnv('OPENROUTER_API_KEY', 'router-fixture');
    vi.stubEnv('GROQ_MODEL_QUERY', 'groq-query');
    vi.stubEnv('OPENROUTER_MODEL_QUERY', 'router-query');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixture.example');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

const providers = [
    {
        name: 'Groq',
        call: callGroq,
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: 'GROQ_API_KEY',
        timeout: 'Timeout après 30000ms',
        empty: 'Réponse vide',
        model: 'groq-query',
        token: 'groq-fixture',
    },
    {
        name: 'OpenRouter',
        call: callOpenRouter,
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: 'OPENROUTER_API_KEY',
        timeout: 'Timeout apres 30000ms',
        empty: 'Reponse vide',
        model: 'router-query',
        token: 'router-fixture',
    },
];

describe.each(providers)('$name chat completion transport contract', (provider) => {
    it('keeps provider auth, query model, JSON body and response shape', async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'fixture' } }], usage: { prompt_tokens: 7 } }),
        });
        expect(
            await provider.call({
                messages: [{ role: 'user', content: 'test' }],
                purpose: 'query',
                jsonMode: true,
                maxTokens: 123,
                temperature: 0.4,
            }),
        ).toEqual({ text: 'fixture', model: provider.model, usage: { prompt_tokens: 7 } });
        expect(fetch).toHaveBeenCalledWith(
            provider.url,
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: `Bearer ${provider.token}`,
                    'Content-Type': 'application/json',
                }),
            }),
        );
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            model: provider.model,
            messages: [{ role: 'user', content: 'test' }],
            temperature: 0.4,
            max_tokens: 123,
            response_format: { type: 'json_object' },
        });
        if (provider.name === 'OpenRouter')
            expect(fetch.mock.calls[0][1].headers).toMatchObject({
                'HTTP-Referer': 'https://fixture.example',
                'X-Title': 'Trouvable',
            });
        else expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('HTTP-Referer');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('reads keys at call time and rejects before IO when absent', async () => {
        vi.stubEnv(provider.key, '');
        await expect(provider.call({ messages: [] })).rejects.toThrow(`${provider.key} manquante`);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('retains valid empty content and missing usage with an explicit model override', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{}] }) });
        expect(await provider.call({ messages: [], modelOverride: 'fixture-model' })).toEqual({
            text: '',
            usage: {},
            model: 'fixture-model',
        });
        expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('response_format');
    });

    it.each([
        [400, 6000],
        [429, 14000],
        [503, 14000],
    ])('preserves bounded HTTP %s retries and total backoff %sms', async (status, delay) => {
        fetch.mockResolvedValue({ ok: false, status, text: async () => 'x'.repeat(400) });
        const start = Date.now();
        const pending = provider.call({ messages: [] });
        const failure = expect(pending).rejects.toThrow(`[AI/${provider.name}] HTTP ${status}: ${'x'.repeat(300)}`);
        await vi.runAllTimersAsync();
        await failure;
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(Date.now() - start).toBe(delay);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts every timed-out request and preserves the provider error wording', async () => {
        const signals = [];
        fetch.mockImplementation(
            (url, { signal }) =>
                new Promise((resolve, reject) => {
                    signals.push(signal);
                    signal.addEventListener(
                        'abort',
                        () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
                        { once: true },
                    );
                }),
        );
        const failure = expect(provider.call({ messages: [] })).rejects.toThrow(provider.timeout);
        await vi.runAllTimersAsync();
        await failure;
        expect(signals).toHaveLength(3);
        expect(signals.every((signal) => signal.aborted)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('retries an invalid empty choices array instead of returning fabricated content', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
        const failure = expect(provider.call({ messages: [] })).rejects.toThrow(provider.empty);
        await vi.runAllTimersAsync();
        await failure;
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('clears the request timer before reading the response body', async () => {
        let finishBody;
        fetch.mockResolvedValue({
            ok: true,
            json: () =>
                new Promise((resolve) => {
                    finishBody = resolve;
                }),
        });
        const pending = provider.call({ messages: [] });
        await vi.advanceTimersByTimeAsync(1);
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(60000);
        expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
        finishBody({ choices: [{ message: { content: 'body' } }] });
        expect((await pending).text).toBe('body');
    });
});

it('reads the OpenRouter referer again on retries while keeping the initial key and model', async () => {
    fetch
        .mockImplementationOnce(async () => {
            vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://retry.example');
            vi.stubEnv('OPENROUTER_API_KEY', 'changed-key');
            vi.stubEnv('OPENROUTER_MODEL_QUERY', 'changed-model');
            return { ok: false, status: 429, text: async () => '' };
        })
        .mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'retried' } }] }) });
    const pending = callOpenRouter({ messages: [], purpose: 'query' });
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ model: 'router-query', text: 'retried' });
    expect(fetch.mock.calls[1][1].headers).toMatchObject({
        Authorization: 'Bearer router-fixture',
        'HTTP-Referer': 'https://retry.example',
    });
});
