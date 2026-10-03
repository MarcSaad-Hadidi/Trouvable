import { describe, it, expect } from 'vitest';

import {
    buildRobotsTxt,
    CONTENT_SIGNAL_POLICY_LINES,
    CONTENT_SIGNAL_VALUE,
} from '../agent-discovery/config';

describe('/robots.txt content signals contract', () => {
    it('declares content signals in the robots.txt body', () => {
        const text = buildRobotsTxt();
        const lines = text.split('\n');
        const userAgentIndex = lines.indexOf('User-agent: *');

        expect(text).toContain(CONTENT_SIGNAL_POLICY_LINES[0]);
        expect(text).toContain('# The content signals and their meanings are:');
        expect(text).toContain('# search: building a search index');
        expect(text).toContain('# ai-input: inputting content');
        expect(text).toContain('# ai-train: training or fine-tuning AI models.');
        expect(text).toContain('User-agent: *');
        expect(text).toContain('Allow: /');
        expect(text).toContain('Disallow: /admin/');
        expect(text).toContain('Disallow: /portal/');
        expect(text).toContain('Disallow: /espace/');
        expect(text).toContain('Disallow: /api/');
        expect(text).toContain(`Content-Signal: ${CONTENT_SIGNAL_VALUE}`);
        expect(text).toContain('Sitemap:');
        expect(userAgentIndex).toBeGreaterThan(-1);
        expect(lines[userAgentIndex - 2]).toBe(`Content-Signal: ${CONTENT_SIGNAL_VALUE}`);
    });

    it('serves /robots.txt as text/plain with Content-Signal in body and header', async () => {
        const mod = await import('../../app/robots.txt/route.js');
        const response = mod.GET(new Request('https://www.trouvable.app/robots.txt'));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/plain');
        expect(response.headers.get('content-signal')).toBe(CONTENT_SIGNAL_VALUE);

        const body = await response.text();
        expect(body).toContain(`Content-Signal: ${CONTENT_SIGNAL_VALUE}`);
        expect(body).toContain(CONTENT_SIGNAL_POLICY_LINES[0]);
    });
});
