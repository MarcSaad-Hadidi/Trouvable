import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    PROMPT_TEMPLATE_VERSION,
    buildGeoPromptForMode,
    buildGeoQueryAnalysisPrompt,
    getGeoPromptTemplate,
} from '@/lib/ai/prompts';

const businessContext = {
    name: 'Trouvable',
    description: 'Plateforme premium de visibilite IA locale pour commerces avec accompagnement GEO.',
    area: 'Montreal',
    services: ['visibilite IA locale', 'audit SEO', 'GEO local'],
    known_competitors: ['CompetitorA', 'CompetitorB'],
};

function flattenMessages(result) {
    return result.messages.map((message) => message.content).join('\n');
}

describe('GEO prompt templates v3', () => {
    it('uses a versioned prompt template id for every mode', () => {
        expect(PROMPT_TEMPLATE_VERSION).toMatch(/^geo-v\d+\.\d+\.\d+$/);

        for (const mode of [
            'blind_discovery',
            'neutral_brand_check',
            'skeptical_brand_evaluation',
            'competitor_discovery',
            'source_grounded_evaluation',
            'controlled_context_answer',
            'operator_extraction',
        ]) {
            const template = getGeoPromptTemplate(mode);
            expect(template.id).toContain(mode);
            expect(template.version).toBe(PROMPT_TEMPLATE_VERSION);
        }
    });

    it('blind_discovery does not inject target name, pitch, services, or competitors', () => {
        const result = buildGeoPromptForMode({
            query: 'Quel est le meilleur outil de visibilite IA pour un commerce local ?',
            mode: 'blind_discovery',
            businessContext,
            locale: 'fr-CA',
        });

        const text = flattenMessages(result);
        expect(text).not.toContain('Trouvable');
        expect(text).not.toContain('Plateforme premium');
        expect(text).not.toContain('visibilite IA locale');
        expect(text).not.toContain('CompetitorA');
        expect(result.metadata).toMatchObject({
            discovery_mode: 'blind_discovery',
            context_injected: false,
            business_context_used: false,
            bias_risk: 'no_context',
            evidence_level: 'none',
            answer_type: 'discovery',
        });
    });

    it('skeptical_brand_evaluation keeps only brand/location context and never injects the pitch', () => {
        const result = buildGeoPromptForMode({
            query: "Trouvable a Montreal, c'est vraiment efficace pour la visibilite IA ou c'est juste du vent ?",
            mode: 'skeptical_brand_evaluation',
            businessContext,
            locale: 'fr-CA',
        });

        const text = flattenMessages(result);
        expect(text).toContain('Trouvable');
        expect(text).toContain('Montreal');
        expect(text).not.toContain('Plateforme premium');
        expect(text).not.toContain('audit SEO');
        expect(text).not.toContain('CompetitorA');
        expect(text).toMatch(/sceptique|prudente|preuves|incertitudes/i);
        expect(result.metadata).toMatchObject({
            discovery_mode: 'skeptical_brand_evaluation',
            context_injected: false,
            business_context_used: false,
            bias_risk: 'brand_name_only',
            evidence_level: 'none',
            answer_type: 'evaluation',
        });
    });

    it('controlled_context_answer injects business context and marks the run as context_injected', () => {
        const result = buildGeoPromptForMode({
            query: "Dans quels cas Trouvable est-il pertinent ?",
            mode: 'controlled_context_answer',
            businessContext,
            locale: 'fr-CA',
        });

        const text = flattenMessages(result);
        expect(text).toContain('Plateforme premium');
        expect(text).toContain('visibilite IA locale');
        expect(text).toContain('CompetitorA');
        expect(text).toMatch(/pas une preuve independante|contexte fourni/i);
        expect(result.metadata).toMatchObject({
            discovery_mode: 'controlled_context_answer',
            context_injected: true,
            business_context_used: true,
            bias_risk: 'context_injected',
            evidence_level: 'weak',
        });
    });

    it('source_grounded_evaluation cites only provided sources and records them in metadata', () => {
        const result = buildGeoPromptForMode({
            query: 'Est-ce que Trouvable est credible ?',
            mode: 'source_grounded_evaluation',
            businessContext,
            locale: 'fr-CA',
            sources: [
                { url: 'https://example.com/trouvable-review', title: 'Review', snippet: 'Signal externe.' },
            ],
        });

        const text = flattenMessages(result);
        expect(text).toContain('https://example.com/trouvable-review');
        expect(text).not.toContain('CompetitorA');
        expect(text).not.toContain('Plateforme premium');
        expect(text).toMatch(/cite seulement|URLs fournies/i);
        expect(result.metadata).toMatchObject({
            discovery_mode: 'source_grounded_evaluation',
            source_grounded: true,
            sources_provided: ['https://example.com/trouvable-review'],
            bias_risk: 'source_grounded',
            evidence_level: 'source_provided',
            answer_type: 'source_grounded',
        });
    });

    it('source_grounded_evaluation without sources does not ask the model to invent URLs', () => {
        const result = buildGeoPromptForMode({
            query: 'Est-ce que Trouvable est credible ?',
            mode: 'source_grounded_evaluation',
            businessContext,
            locale: 'fr-CA',
            sources: [],
        });

        const text = flattenMessages(result);
        expect(text).toMatch(/aucune source fiable/i);
        expect(text).not.toMatch(/URL complete|cherche des URLs|trouve des URLs/i);
        expect(result.metadata.evidence_level).toBe('none');
        expect(result.metadata.sources_provided).toEqual([]);
    });

    it('operator_extraction is an extraction prompt, not answer generation', () => {
        const messages = buildGeoQueryAnalysisPrompt(
            'Est-ce que Trouvable est credible ?',
            'Je ne peux pas verifier son efficacite sans sources externes. Aucune URL fournie.',
            'Trouvable'
        );

        const fullText = messages.map((message) => message.content).join('\n');
        expect(fullText).toContain('extracteur structure');
        expect(fullText).toContain('hallucination_risk');
        expect(fullText).toContain('unsupported_claims');
        expect(fullText).not.toMatch(/Reponds naturellement|produis une reponse utilisateur/i);
    });
});
