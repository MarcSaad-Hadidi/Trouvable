import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ReliabilityPill from '@/components/shared/metrics/ReliabilityPill';
import { ProvenancePill } from '@/components/shared/metrics/ProvenancePill';

const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

describe.each([ReliabilityPill, ProvenancePill])('metric pill', (Component) => {
    it('keeps missing values invisible', () => {
        expect(render(Component, {})).toBe('');
        expect(render(Component, { meta: {} })).toBe('');
    });
    it('keeps metadata priority, description and class names', () => {
        const html = render(Component, { value: 'observed', meta: { label: 'Long', shortLabel: 'Court', description: 'Source', tone: 'amber' }, className: 'custom' });
        expect(html).toContain('title="Source"');
        expect(html).toContain('>Court</span>');
        expect(html).toContain('text-amber-200');
        expect(html).toContain('custom');
    });
    it('falls back to the label and slate for unknown tone', () => {
        const html = render(Component, { meta: { label: 'Signal', tone: 'unknown' } });
        expect(html).toContain('title="Signal"');
        expect(html).toContain('>Signal</span>');
        expect(html).toContain('text-white/45');
    });
});

it('preserves each concept’s palette and fallback', () => {
    expect(render(ReliabilityPill, { value: 'calculated' })).toContain('text-sky-300');
    expect(render(ProvenancePill, { value: 'derived' })).toContain('text-violet-300');
    expect(render(ReliabilityPill, { meta: { label: 'Custom', tone: 'violet' } })).toContain('text-white/45');
    expect(render(ProvenancePill, { meta: { label: 'Custom', tone: 'blue' } })).toContain('text-white/45');
    expect(render(ReliabilityPill, { value: 'unknown' })).toContain('Indisponible');
    expect(render(ProvenancePill, { value: 'unknown' })).toContain('Dérivé');
});
