import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { expect, it } from 'vitest';
import tailwindConfig from '../../../tailwind.config.mjs';

it('generates the intended transition duration and easing with the animation plugin enabled', async () => {
    const source = await readFile(new URL('../../features/public/home/HomeInteractiveIslands.jsx', import.meta.url), 'utf8');
    const result = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: source, extension: 'jsx' }] })]).process('@tailwind utilities;', { from: undefined });
    const css = result.css.replace(/\s+/g, '');
    for (const duration of ['900ms', '850ms', '880ms']) {
        expect(css).toContain(`transition-duration:${duration}`);
    }
    expect(css).toContain('transition-timing-function:cubic-bezier(0.16,1,0.3,1)');
    expect(css).not.toContain('animation-timing-function:cubic-bezier(0.16,1,0.3,1)');
});
