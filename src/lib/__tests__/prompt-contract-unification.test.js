import { describe, expect, it } from 'vitest';

import { buildCanonicalPromptContract } from '../queries/onboarding-prompt-contract.js';

function hasCoreFields(contract) {
    return Boolean(
        contract.query_text
        && contract.intent_family
        && contract.prompt_mode
        && contract.quality_status
        && contract.validation_status
        && contract.prompt_origin
        && contract.query_type_v2
        && contract.funnel_stage
        && contract.geo_scope
        && contract.brand_scope
        && contract.comparison_scope
        && contract.locale
    );
}

describe('canonical prompt contract', () => {
    it('provides a complete canonical shape', () => {
        const contract = buildCanonicalPromptContract({
            queryText: "Pour quels types d'entreprises Trouvable est-il pertinent ?",
            clientName: 'Trouvable',
            city: 'Montreal',
            region: 'QC',
            locale: 'fr-CA',
            promptOrigin: 'starter_pack_saas',
            intentFamily: 'brand',
            promptMode: 'user_like',
            offerAnchor: 'visibilite IA locale',
            userVisibleOffering: 'visibilite IA locale',
            targetAudience: 'b2b',
            primaryUseCase: 'ameliorer la visibilite IA locale',
            differentiationAngle: 'specialisation locale',
        });

        expect(hasCoreFields(contract)).toBe(true);
        expect(contract.validation_status).toBe(contract.quality_status);
        expect(contract.is_valid).toBe(contract.quality_status !== 'weak');
    });

    it('prevents contradictory strong + invalid states', () => {
        const contract = buildCanonicalPromptContract({
            queryText: 'Quels criteres et quelles preuves demander avant de choisir Trouvable ?',
            clientName: 'Trouvable',
            intentFamily: 'buyer_guidance',
            promptMode: 'user_like',
        });

        if (contract.quality_status === 'strong') {
            expect(contract.is_valid).toBe(true);
        }
    });
});

describe('multi-profile robustness', () => {
    const scenarios = [
        {
            name: 'Trouvable',
            queryText: "Quelles alternatives a Trouvable existent pour la visibilite IA locale et pourquoi ?",
            clientName: 'Trouvable',
            intentFamily: 'competitor',
            promptMode: 'user_like',
        },
        {
            name: 'SaaS generic',
            queryText: 'Quels prerequis techniques et indicateurs suivre dans les 30 premiers jours ?',
            clientName: 'FlowSuite',
            intentFamily: 'implementation',
            promptMode: 'operator_probe',
        },
        {
            name: 'Service local',
            queryText: 'Quels prix, inclusions et delais faut-il verifier pour un service de plomberie a Montreal ?',
            clientName: 'Plomberie Atlas',
            city: 'Montreal',
            intentFamily: 'pricing',
            promptMode: 'user_like',
        },
        {
            name: 'Agence / cabinet',
            queryText: 'Comment choisir un cabinet SEO local: quels criteres, risques et preuves demander ?',
            clientName: 'Cabinet Nova',
            intentFamily: 'buyer_guidance',
            promptMode: 'user_like',
        },
        {
            name: 'Borderline generic',
            queryText: 'local_business schema.org service local',
            clientName: 'GenericCo',
            intentFamily: 'brand',
            promptMode: 'user_like',
            expectedWeak: true,
        },
    ];

    it('keeps stable statuses across profiles', () => {
        for (const scenario of scenarios) {
            const contract = buildCanonicalPromptContract({
                queryText: scenario.queryText,
                clientName: scenario.clientName,
                city: scenario.city || '',
                intentFamily: scenario.intentFamily,
                promptMode: scenario.promptMode,
                promptOrigin: 'test_suite',
            });

            expect(contract.quality_status).toBe(contract.validation_status);
            expect(contract.activation_blocked).toBe(contract.quality_status === 'weak');

            if (scenario.expectedWeak) {
                expect(contract.quality_status).toBe('weak');
                expect(contract.quality_reasons.join(' ').toLowerCase()).toMatch(/interdit|non naturel/);
            } else {
                expect(['strong', 'review']).toContain(contract.quality_status);
            }
        }
    });
});
