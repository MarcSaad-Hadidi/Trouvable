import { describe, expect, it } from 'vitest';

import { buildRemediationPrompt } from '../remediation/prompt-builder.js';

const baseProblem = {
    id: 'p1',
    clientId: 'client-1',
    source: 'geo_runs',
    severity: 'medium',
    detectedAt: '2026-03-25T10:00:00.000Z',
    status: 'open',
    context: {
        company_name: 'Cabinet Nova',
        company_short_description: 'Cabinet de services professionnels',
        company_city: 'Montreal',
        company_website: 'https://example.com',
        query_text: 'meilleur cabinet fiscal montreal',
    },
};

describe('buildRemediationPrompt()', () => {
    it('builds FAQ prompt for missing_faq_for_intent', () => {
        const prompt = buildRemediationPrompt({
            ...baseProblem,
            type: 'missing_faq_for_intent',
        });

        expect(prompt.system).toContain('SEO/GEO');
        expect(prompt.user).toContain('5 a 7 questions/reponses');
        expect(prompt.user).toContain('meilleur cabinet fiscal montreal');
    });

    it('builds schema prompt for schema_missing_or_incoherent', () => {
        const prompt = buildRemediationPrompt({
            ...baseProblem,
            type: 'schema_missing_or_incoherent',
        });

        expect(prompt.user).toContain('JSON-LD');
        expect(prompt.user).toContain('LocalBusiness');
    });

    it('builds local clarity prompt for weak_local_clarity', () => {
        const prompt = buildRemediationPrompt({
            ...baseProblem,
            type: 'weak_local_clarity',
        });

        expect(prompt.user).toContain('clarte locale');
        expect(prompt.user).toContain('impact attendu');
    });

    it('builds trend recovery prompt for visibility_declining', () => {
        const prompt = buildRemediationPrompt({
            ...baseProblem,
            type: 'visibility_declining',
            context: {
                ...baseProblem.context,
                action_center_signals: [{ id: 'citation_gap', priority: 'high' }],
            },
        });

        expect(prompt.user).toContain('30 jours');
        expect(prompt.user).toContain('J1-J7');
    });

    it('uses fallback for unsupported types', () => {
        const prompt = buildRemediationPrompt({
            ...baseProblem,
            type: 'target_never_found',
        });

        expect(prompt.user).toContain('Probleme detecte');
        expect(prompt.user).toContain('target_never_found');
    });
});
