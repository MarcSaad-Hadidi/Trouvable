import { describe, it, expect } from 'vitest';

import { normalizeEntityTypeForDb } from '../queries/mention-entity-type.js';

describe('normalizeEntityTypeForDb', () => {
    it('maps generic_mention to business for Postgres check constraint', () => {
        expect(normalizeEntityTypeForDb('generic_mention')).toBe('business');
    });

    it('preserves allowed types', () => {
        expect(normalizeEntityTypeForDb('business')).toBe('business');
        expect(normalizeEntityTypeForDb('competitor')).toBe('competitor');
        expect(normalizeEntityTypeForDb('source')).toBe('source');
    });

    it('defaults unknown values to business', () => {
        expect(normalizeEntityTypeForDb('unknown')).toBe('business');
        expect(normalizeEntityTypeForDb(null)).toBe('business');
        expect(normalizeEntityTypeForDb('')).toBe('business');
    });
});
