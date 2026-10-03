import { describe, expect, it } from 'vitest';

import { formatValue } from '../agent-page-primitives';

describe('Agent metric presentation', () => {
    it.each([null, undefined, '', NaN, Infinity, -Infinity])('renders unavailable %s as n.d.', (value) => {
        expect(formatValue(value)).toBe('n.d.');
    });

    it('preserves observed zero and finite numeric formatting', () => {
        expect(formatValue(0)).toBe('0');
        expect(formatValue(12.345)).toBe('12.35');
        expect(formatValue(1200)).toBe((1200).toLocaleString('fr-CA'));
    });

    it('preserves literal strings and boolean labels', () => {
        expect(formatValue('0')).toBe('0');
        expect(formatValue('12.50')).toBe('12.50');
        expect(formatValue(false)).toBe('Non');
        expect(formatValue(true)).toBe('Oui');
    });
});
