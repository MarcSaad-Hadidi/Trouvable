import { afterEach, describe, expect, it, vi } from 'vitest';
import { __internal__ as actionability, buildActionabilityReport } from '../agent/actionability.js';
import { __internal__ as protocols, buildProtocolsReport } from '../agent/protocols.js';

afterEach(() => vi.useRealTimers());

describe.each([
    ['actionability', actionability, buildActionabilityReport],
    ['protocols', protocols, buildProtocolsReport],
])('%s report readings', (_name, internals, report) => {
    it.each([
        [0, 'calculated'],
        [24 * 60, 'calculated'],
        [24 * 60 + 1, 'stale'],
        [24 * 180, 'stale'],
        [24 * 180 + 1, 'low'],
        [-1, 'calculated'],
    ])('preserves the reliability threshold at %s hours', (hours, reliability) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        const audit = { created_at: new Date(Date.now() - hours * 3600000).toISOString(), extracted_data: {} };
        expect(internals.deriveReliability(audit)).toBe(reliability);
        expect(report({ audit }).summary.auditFreshnessHours).toBe(hours);
    });
    it.each([null, {}, { created_at: 'invalid' }, { created_at: '' }])(
        'preserves unavailable reliability for %j',
        (audit) => {
            expect(internals.deriveReliability(audit)).toBe('unavailable');
        },
    );
    it('keeps report clamp semantics for non-finite and out-of-range inputs', () => {
        expect(internals.clamp(null)).toBe(0);
        expect(internals.clamp(Infinity, 10, 90)).toBe(10);
        expect(internals.clamp(-5)).toBe(0);
        expect(internals.clamp(102)).toBe(100);
        expect(internals.clamp(54.5)).toBe(54.5);
    });
});

it('preserves the distinct dimension status contracts', () => {
    expect(actionability.deriveDimensionStatus(0, false)).toBe('absent');
    expect(actionability.deriveDimensionStatus(0, true)).toBe('bloqué');
    expect(actionability.deriveDimensionStatus(20, true)).toBe('bloqué');
    expect(protocols.deriveDimensionStatus(0)).toBe('absent');
    expect(protocols.deriveDimensionStatus(20)).toBe('faible');
});
