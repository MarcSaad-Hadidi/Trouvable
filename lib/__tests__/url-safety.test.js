import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.fn();

vi.mock('node:dns/promises', () => ({
    lookup: lookupMock,
}));

async function loadModule() {
    return import('../audit/url-safety.js');
}

describe('url safety fetch guard', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
        lookupMock.mockReset();
    });

    it('rejects private and non-http targets before fetch', async () => {
        const { fetchPublicResource } = await loadModule();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(fetchPublicResource('http://localhost/')).rejects.toThrow('blocked_private_host');
        await expect(fetchPublicResource('http://127.0.0.1/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://10.0.0.1/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://169.254.169.254/latest/meta-data')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('data:text/html,test')).rejects.toThrow('invalid_public_http_url');
        await expect(fetchPublicResource('file:///etc/passwd')).rejects.toThrow('invalid_public_http_url');
        await expect(fetchPublicResource('java' + 'script:alert(1)')).rejects.toThrow('invalid_public_http_url');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects URL parser and IPv6 private-network bypasses', async () => {
        const { fetchPublicResource } = await loadModule();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(fetchPublicResource('http://%6c%6f%63%61%6c%68%6f%73%74/')).rejects.toThrow('blocked_private_host');
        await expect(fetchPublicResource('http://2130706433/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://0x7f000001/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://[::1]/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://[::ffff:127.0.0.1]/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://[fe80::1]/')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://[fd00:ec2::254]/latest/meta-data')).rejects.toThrow('blocked_private_ip');
        await expect(fetchPublicResource('http://metadata.google.internal/')).rejects.toThrow('blocked_private_host');
        await expect(fetchPublicResource('http://example.internal/')).rejects.toThrow('blocked_private_host');
        await expect(fetchPublicResource('http://example.com:6379/')).rejects.toThrow('blocked_port');
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

        lookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
        fetchMock.mockResolvedValueOnce(new Response('', {
            status: 302,
            headers: { location: 'http://127.0.0.1/admin' },
        }));
        await expect(fetchPublicResource('https://example.com/start')).rejects.toThrow('blocked_private_ip');
    });
});
