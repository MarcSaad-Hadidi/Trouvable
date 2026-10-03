import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Microsoft Clarity integration', () => {
    const rootLayout = readFileSync(resolve(process.cwd(), 'src/app/layout.jsx'), 'utf-8');

    it('loads the configured project globally through next/script', () => {
        expect(rootLayout).toContain("import Script from 'next/script'");
        expect(rootLayout).toContain('id="microsoft-clarity"');
        expect(rootLayout).toContain('strategy="afterInteractive"');
        expect(rootLayout).toContain('https://www.clarity.ms/tag/');
        expect(rootLayout).toContain('"y0x5dpjp58"');
    });
});
