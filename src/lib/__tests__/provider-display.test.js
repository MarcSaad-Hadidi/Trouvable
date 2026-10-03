import { describe, expect, it } from 'vitest';

import {
    getProviderMeta,
    normalizeModelLabel,
    signalTierLabel,
} from '@/lib/llm-comparison/provider-display';

describe('provider display utilities', () => {
    describe('getProviderMeta', () => {
        it('returns premium label for known providers', () => {
            expect(getProviderMeta('gemini').label).toBe('Gemini');
            expect(getProviderMeta('groq').label).toBe('Groq');
            expect(getProviderMeta('mistral').label).toBe('Mistral');
            expect(getProviderMeta('openrouter').label).toBe('OpenRouter');
        });

        it('returns unique initials to avoid avatar collisions', () => {
            const initials = ['gemini', 'groq', 'mistral', 'openrouter'].map(
                (p) => getProviderMeta(p).initials
            );
            expect(new Set(initials).size).toBe(4);
        });

        it('returns fallback for unknown providers', () => {
            const meta = getProviderMeta('unknown-provider');
            expect(meta.label).toBe('unknown-provider');
            expect(meta.initials).toBe('??');
        });

        it('handles null/undefined gracefully', () => {
            expect(getProviderMeta(null).initials).toBe('??');
            expect(getProviderMeta(undefined).initials).toBe('??');
        });
    });

    describe('normalizeModelLabel', () => {
        it('normalises Gemini model names', () => {
            expect(normalizeModelLabel('gemini-2.5-flash')).toBe('Gemini 2.5 Flash');
        });

        it('normalises Groq/Llama model names and strips noise suffixes', () => {
            const label = normalizeModelLabel('llama-3.3-70b-versatile');
            expect(label).toBe('Llama 3.3 70B');
        });

        it('normalises Mistral model names and strips date suffixes', () => {
            expect(normalizeModelLabel('mistral-small-2603')).toBe('Mistral Small');
        });

        it('normalises OpenRouter-style org/model names', () => {
            expect(normalizeModelLabel('openai/gpt-4o-mini')).toBe('GPT 4o Mini');
        });

        it('returns n.d. for null/undefined', () => {
            expect(normalizeModelLabel(null)).toBe('n.d.');
            expect(normalizeModelLabel(undefined)).toBe('n.d.');
        });
    });

    describe('signalTierLabel', () => {
        it('maps tier keys to operator-readable French labels', () => {
            expect(signalTierLabel('useful')).toBe('Exploitable');
            expect(signalTierLabel('weak')).toBe('Faible');
            expect(signalTierLabel('low_yield')).toBe('Peu exploitable');
            expect(signalTierLabel('failed')).toBe('Échec');
        });

        it('returns original for unknown tiers', () => {
            expect(signalTierLabel('other')).toBe('other');
        });
    });
});
