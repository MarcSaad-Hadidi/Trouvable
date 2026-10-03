import { describe, expect, it } from 'vitest';

import { evaluateOnboardingPromptContract } from '../queries/onboarding-prompt-contract.js';

describe('onboarding prompt contract', () => {
    it('never returns strong + invalid', () => {
        const result = evaluateOnboardingPromptContract({
            queryText: "Pour quels types d'entreprises Trouvable est-il pertinent ?",
            intentFamily: 'brand',
            promptMode: 'user_like',
            clientName: 'Trouvable',
        });

        if (result.status === 'strong') {
            expect(result.is_valid).toBe(true);
        }
    });

    it('blocks internal labels and forbidden generic tokens', () => {
        const result = evaluateOnboardingPromptContract({
            queryText: '1. Diagnostic & Strategie local_business schema.org',
            intentFamily: 'pricing',
            promptMode: 'operator_probe',
            clientName: 'Trouvable',
        });

        expect(result.status).toBe('weak');
        expect(result.is_valid).toBe(false);
        expect(result.reasons.join(' ')).toMatch(/interdit|non naturel/i);
    });
});

describe('trouvable onboarding prompt examples', () => {
    const prompts = [
        { query: "Pour quels types d'entreprises Trouvable est-il pertinent ?", family: 'brand', mode: 'user_like' },
        { query: "Quelles alternatives a Trouvable sont citees pour la visibilite IA locale et pourquoi ?", family: 'competitor', mode: 'user_like' },
        { query: 'Liste 3 options concurrentes a Trouvable, avec un critere de differentiation par option.', family: 'competitor', mode: 'operator_probe' },
        { query: "Que comprend une offre de visibilite IA locale, et quels frais caches ou delais verifier ?", family: 'pricing', mode: 'user_like' },
        { query: 'Quels prerequis techniques et indicateurs suivre dans les 30 premiers jours avec Trouvable ?', family: 'implementation', mode: 'operator_probe' },
    ];

    it('all examples are valid and never contradictory', () => {
        for (const prompt of prompts) {
            const result = evaluateOnboardingPromptContract({
                queryText: prompt.query,
                intentFamily: prompt.family,
                promptMode: prompt.mode,
                clientName: 'Trouvable',
            });
            expect(result.status).not.toBe('weak');
            if (result.status === 'strong') {
                expect(result.is_valid).toBe(true);
            }
            expect(prompt.query.toLowerCase()).not.toContain('local_business');
            expect(prompt.query.toLowerCase()).not.toContain('schema.org');
            expect(prompt.query).not.toMatch(/\b1\.\s*Diagnostic/i);
        }
    });
});
