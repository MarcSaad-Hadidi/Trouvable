import { describe, expect, it, vi } from 'vitest';

const lookupMock = vi.fn();

vi.mock('node:dns/promises', () => ({
    lookup: lookupMock,
}));

async function loadModule() {
    return import('../audit/url-safety.js');
}

describe('url safety fetch guard', () => {
    it('rejects private and non-http targets before fetch', async () => {
        const { fetchPublicResource } = await loadModule();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(fetchPublicResource('http://localhost/')).rejects.toThrow('blocked_private_host');
        await expect(fetchPublicResource('http://127.0.0.1/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://10.0.0.1/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://169.254.169.254/latest/meta-data')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('data:text/html,test')).rejects.toThrow('invalid_public_http_url');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects public hostnames that resolve to private addresses', async () => {
        const { fetchPublicResource } = await loadModule();
        lookupMock.mockResolvedValueOnce([{ address: '192.168.0.10', family: 4 }]);
        vi.stubGlobal('fetch', vi.fn());

        await expect(fetchPublicResource('https://example.com/')).rejects.toThrow('blocked_private_dns');
    });

    it('follows public redirects and rejects redirects to private targets', async () => {
        const { fetchPublicResource } = await loadModule();
        lookupMock
            .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
            .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
            .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);

        const redirectResponse = new Response('', {
            status: 302,
            headers: { location: 'https://www.example.com/final' },
        });
        const okResponse = new Response('ok', { status: 200 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(redirectResponse)
            .mockResolvedValueOnce(okResponse);
        vi.stubGlobal('fetch', fetchMock);

        const response = await fetchPublicResource('https://example.com/start');
        expect(await response.text()).toBe('ok');
        expect(fetchMock).toHaveBeenCalledTimes(2);

        fetchMock.mockResolvedValueOnce(new Response('', {
            status: 302,
            headers: { location: 'http://127.0.0.1/admin' },
        }));
        await expect(fetchPublicResource('https://example.com/start')).rejects.toThrow('blocked_private_ip');
    });
});
