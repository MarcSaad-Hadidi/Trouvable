/**
 * Tests for the blind_discovery / brand_aware mode split and measurement architecture.
 *
 * Validates:
 * 1. Blind discovery prompt contains zero target priming (no name, description, services, competitors)
 * 2. Brand-aware prompt intentionally contains full business context
 * 3. Analysis/extraction remains target-aware in both modes
 * 4. Discovery mode is correctly inferred from prompt metadata
 * 5. Brand-adjacent intent families (pricing, implementation, buyer_guidance) → brand_aware
 * 6. Measurement outcome classification produces correct outcomes for all scenarios
 * 7. Visibility eligibility correctly gates spontaneous metrics
 * 8. DISCOVERY_MODE_META and MEASUREMENT_OUTCOMES are complete
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildGeoQueryPrompt, buildBlindGeoQueryPrompt, buildGeoQueryAnalysisPrompt } from '@/lib/ai/prompts';
import {
    normalizeDiscoveryMode,
    inferDiscoveryMode,
    isVisibilityEligible,
    classifyMeasurementOutcome,
    countsAsVisibilityOutcome,
    DISCOVERY_MODE_META,
    MEASUREMENT_OUTCOMES,
    getDiscoveryModeOptions,
} from '@/lib/operator-intelligence/prompt-taxonomy';

// ─── Prompt construction ────────────────────────────────────────────

describe('Prompt construction — brand_aware', () => {
    const businessContext = {
        name: 'Trouvable',
        description: 'Plateforme de visibilite IA locale pour commerces',
        area: 'Montreal',
        services: ['visibilite IA', 'audit SEO', 'GEO local'],
        known_competitors: ['CompetitorA', 'CompetitorB'],
    };

    it('includes business name, description, area, services, and competitors', () => {
        const messages = buildGeoQueryPrompt('meilleur outil visibilite IA locale', businessContext);
        const fullText = messages.map((m) => m.content).join('\n');

        expect(fullText).toContain('Trouvable');
        expect(fullText).toContain('visibilite IA locale pour commerces');
        expect(fullText).toContain('Montreal');
        expect(fullText).toContain('visibilite IA');
        expect(fullText).toContain('CompetitorA');
        expect(fullText).toContain('CompetitorB');
    });

    it('contains fidelity rules', () => {
        const messages = buildGeoQueryPrompt('test', businessContext);
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg.content).toContain('REGLES DE FIDELITE');
    });
});

describe('Prompt construction — blind_discovery (zero target priming)', () => {
    it('contains NO business name, NO description, NO services, NO competitors', () => {
        const messages = buildBlindGeoQueryPrompt('meilleur outil visibilite IA locale');
        const fullText = messages.map((m) => m.content).join('\n');

        expect(fullText).not.toContain('Trouvable');
        expect(fullText).not.toContain('visibilite IA locale pour commerces');
        expect(fullText).not.toContain('CompetitorA');
        expect(fullText).not.toContain('CompetitorB');
        expect(fullText).toContain('meilleur outil visibilite IA locale');
    });

    it('preserves system-level fidelity rules', () => {
        const messages = buildBlindGeoQueryPrompt('meilleur dentiste a Montreal');
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg).toBeDefined();
        expect(systemMsg.content).toContain('REGLES DE FIDELITE');
        expect(systemMsg.content).toContain('N\'invente pas');
    });

    it('does not contain the word "contexte" or "cible" or "profil" (no hidden hints)', () => {
        const messages = buildBlindGeoQueryPrompt('meilleur plombier a Montreal');
        const userMsg = messages.find((m) => m.role === 'user');
        expect(userMsg.content).not.toMatch(/contexte business|Nom:|Activite:|Zone:|Services:/i);
    });

    it('shares the same base fidelity rules as brand_aware', () => {
        const businessContext = {
            name: 'X', description: '', area: '', services: [], known_competitors: [],
        };
        const brandSystem = buildGeoQueryPrompt('test', businessContext).find((m) => m.role === 'system').content;
        const blindSystem = buildBlindGeoQueryPrompt('test').find((m) => m.role === 'system').content;

        expect(brandSystem).toContain('N\'invente pas d\'entreprises');
        expect(blindSystem).toContain('N\'invente pas d\'entreprises');
    });
});

describe('Analysis prompt — remains target-aware in both modes', () => {
    it('analysis prompt includes target business for evaluation', () => {
        const messages = buildGeoQueryAnalysisPrompt(
            'meilleur outil visibilite IA',
            'Voici une reponse avec Trouvable et CompetitorA...',
            'Trouvable'
        );
        const fullText = messages.map((m) => m.content).join('\n');

        expect(fullText).toContain('Trouvable');
        expect(fullText).toContain('BUSINESS CIBLE');
    });
});

// ─── Discovery mode normalization ───────────────────────────────────

describe('normalizeDiscoveryMode', () => {
    it('normalizes valid modes', () => {
        expect(normalizeDiscoveryMode('blind_discovery')).toBe('blind_discovery');
        expect(normalizeDiscoveryMode('brand_aware')).toBe('brand_aware');
        expect(normalizeDiscoveryMode('neutral_brand_check')).toBe('neutral_brand_check');
        expect(normalizeDiscoveryMode('skeptical_brand_evaluation')).toBe('skeptical_brand_evaluation');
        expect(normalizeDiscoveryMode('competitor_discovery')).toBe('competitor_discovery');
        expect(normalizeDiscoveryMode('source_grounded_evaluation')).toBe('source_grounded_evaluation');
        expect(normalizeDiscoveryMode('controlled_context_answer')).toBe('controlled_context_answer');
    });

    it('normalizes case/format variations', () => {
        expect(normalizeDiscoveryMode('BLIND_DISCOVERY')).toBe('blind_discovery');
        expect(normalizeDiscoveryMode('Brand Aware')).toBe('brand_aware');
        expect(normalizeDiscoveryMode('blind-discovery')).toBe('blind_discovery');
    });

    it('defaults to brand_aware for unknown/empty values (conservative)', () => {
        expect(normalizeDiscoveryMode('')).toBe('brand_aware');
        expect(normalizeDiscoveryMode(null)).toBe('brand_aware');
        expect(normalizeDiscoveryMode(undefined)).toBe('brand_aware');
        expect(normalizeDiscoveryMode('unknown_mode')).toBe('brand_aware');
    });
});

// ─── Discovery mode inference ───────────────────────────────────────

describe('inferDiscoveryMode — robust resolution', () => {
    it('brand category -> neutral_brand_check', () => {
        expect(inferDiscoveryMode({ category: 'brand', intentFamily: 'brand', queryText: '', clientName: '' }))
            .toBe('neutral_brand_check');
    });

    it('competitor_comparison category -> competitor_discovery', () => {
        expect(inferDiscoveryMode({ category: 'competitor_comparison', intentFamily: 'competitor', queryText: '', clientName: '' }))
            .toBe('competitor_discovery');
    });

    it('buyer_guidance intent without brand can stay blind_discovery', () => {
        expect(inferDiscoveryMode({ category: 'service_intent', intentFamily: 'buyer_guidance', queryText: 'quels criteres', clientName: 'X' }))
            .toBe('blind_discovery');
    });

    it('pricing intent with brand -> neutral_brand_check', () => {
        expect(inferDiscoveryMode({ category: 'brand', intentFamily: 'pricing', queryText: 'cout de X', clientName: 'X' }))
            .toBe('neutral_brand_check');
    });

    it('implementation intent with brand category -> neutral_brand_check', () => {
        expect(inferDiscoveryMode({ category: 'brand', intentFamily: 'implementation', queryText: 'etapes pour deployer', clientName: '' }))
            .toBe('neutral_brand_check');
    });

    it('query text containing client name -> neutral_brand_check', () => {
        expect(inferDiscoveryMode({
            category: 'discovery',
            intentFamily: 'discovery',
            queryText: 'Est-ce que Trouvable est bon pour les dentistes ?',
            clientName: 'Trouvable',
        })).toBe('neutral_brand_check');
    });

    it('skeptical query text containing client name -> skeptical_brand_evaluation', () => {
        expect(inferDiscoveryMode({
            category: 'brand',
            intentFamily: 'brand',
            queryText: "Trouvable, c'est vraiment efficace ou c'est du vent ?",
            clientName: 'Trouvable',
        })).toBe('skeptical_brand_evaluation');
    });

    it('discovery category without client name → blind_discovery', () => {
        expect(inferDiscoveryMode({
            category: 'discovery',
            intentFamily: 'discovery',
            queryText: 'meilleur outil visibilite IA locale',
            clientName: 'Trouvable',
        })).toBe('blind_discovery');
    });

    it('local_intent without brand → blind_discovery', () => {
        expect(inferDiscoveryMode({
            category: 'local_intent',
            intentFamily: 'local_recommendation',
            queryText: 'meilleur dentiste a Montreal',
            clientName: 'CliniqueDental',
        })).toBe('blind_discovery');
    });

    it('service_intent without brand → blind_discovery', () => {
        expect(inferDiscoveryMode({
            category: 'service_intent',
            intentFamily: 'service_intent',
            queryText: 'comment ameliorer sa visibilite IA',
            clientName: 'Trouvable',
        })).toBe('blind_discovery');
    });

    it('unknown category defaults to brand_aware (conservative)', () => {
        expect(inferDiscoveryMode({ category: 'unknown', intentFamily: 'unknown', queryText: 'general question', clientName: 'X' }))
            .toBe('brand_aware');
    });
});

// ─── Visibility eligibility ─────────────────────────────────────────

describe('isVisibilityEligible', () => {
    it('blind_discovery is eligible for spontaneous visibility measurement', () => {
        expect(isVisibilityEligible('blind_discovery')).toBe(true);
    });

    it('brand_aware is NOT eligible for spontaneous visibility measurement', () => {
        expect(isVisibilityEligible('brand_aware')).toBe(false);
    });

    it('unknown mode is NOT eligible', () => {
        expect(isVisibilityEligible('unknown')).toBe(false);
        expect(isVisibilityEligible(undefined)).toBe(false);
    });
});

// ─── Measurement outcome classification ─────────────────────────────

describe('classifyMeasurementOutcome', () => {
    it('blind + target found → spontaneous_mention', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: true,
            runSignalTier: 'useful',
            competitorCount: 2,
            totalMentioned: 3,
        })).toBe('spontaneous_mention');
    });

    it('brand_aware + target found → assisted_mention', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'brand_aware',
            targetFound: true,
            runSignalTier: 'useful',
            competitorCount: 0,
            totalMentioned: 1,
        })).toBe('assisted_mention');
    });

    it('target NOT found + competitors present → competitor_dominated', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: false,
            runSignalTier: 'useful',
            competitorCount: 3,
            totalMentioned: 4,
        })).toBe('competitor_dominated');
    });

    it('target NOT found + no competitors + multiple mentions → competitor_dominated', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: false,
            runSignalTier: 'useful',
            competitorCount: 0,
            totalMentioned: 3,
        })).toBe('competitor_dominated');
    });

    it('target NOT found + no mentions → not_mentioned', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: false,
            runSignalTier: 'useful',
            competitorCount: 0,
            totalMentioned: 1,
        })).toBe('not_mentioned');
    });

    it('empty_signal tier → low_quality regardless of other fields', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: true,
            runSignalTier: 'empty_signal',
            competitorCount: 0,
            totalMentioned: 0,
        })).toBe('low_quality');
    });

    it('low_yield + target found → spontaneous_mention (still counts)', () => {
        expect(classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: true,
            runSignalTier: 'low_yield',
            competitorCount: 0,
            totalMentioned: 1,
        })).toBe('spontaneous_mention');
    });
});

// ─── Metadata and options completeness ──────────────────────────────

describe('DISCOVERY_MODE_META completeness', () => {
    it('has both modes defined with visibility_eligible flag', () => {
        expect(DISCOVERY_MODE_META.brand_aware).toBeDefined();
        expect(DISCOVERY_MODE_META.blind_discovery).toBeDefined();
        expect(DISCOVERY_MODE_META.brand_aware.key).toBe('brand_aware');
        expect(DISCOVERY_MODE_META.blind_discovery.key).toBe('blind_discovery');
        expect(DISCOVERY_MODE_META.brand_aware.visibility_eligible).toBe(false);
        expect(DISCOVERY_MODE_META.blind_discovery.visibility_eligible).toBe(true);
    });

    it('getDiscoveryModeOptions returns all generation modes plus legacy brand_aware', () => {
        const options = getDiscoveryModeOptions();
        expect(options.length).toBeGreaterThanOrEqual(7);
        expect(options.map((o) => o.key)).toEqual(expect.arrayContaining([
            'blind_discovery',
            'neutral_brand_check',
            'skeptical_brand_evaluation',
            'competitor_discovery',
            'source_grounded_evaluation',
            'controlled_context_answer',
            'brand_aware',
        ]));
    });
});

describe('MEASUREMENT_OUTCOMES completeness', () => {
    it('defines all 5 measurement outcomes', () => {
        const keys = Object.keys(MEASUREMENT_OUTCOMES);
        expect(keys).toEqual(expect.arrayContaining([
            'spontaneous_mention',
            'assisted_mention',
            'competitor_dominated',
            'not_mentioned',
            'low_quality',
        ]));
        expect(keys.length).toBe(5);
    });

    it('only spontaneous_mention counts_as_visibility', () => {
        const countsAsVisibility = Object.entries(MEASUREMENT_OUTCOMES)
            .filter(([, v]) => v.counts_as_visibility)
            .map(([k]) => k);
        expect(countsAsVisibility).toEqual(['spontaneous_mention']);
    });

    it('each outcome has key, label, description', () => {
        for (const [key, meta] of Object.entries(MEASUREMENT_OUTCOMES)) {
            expect(meta.key).toBe(key);
            expect(meta.label).toBeTruthy();
            expect(meta.description).toBeTruthy();
            expect(typeof meta.counts_as_visibility).toBe('boolean');
        }
    });
});

// ─── countsAsVisibilityOutcome — KPI alignment ─────────────────────

describe('countsAsVisibilityOutcome — KPI alignment with taxonomy', () => {
    it('spontaneous_mention counts as visibility', () => {
        expect(countsAsVisibilityOutcome('spontaneous_mention')).toBe(true);
    });

    it('assisted_mention does NOT count as visibility', () => {
        expect(countsAsVisibilityOutcome('assisted_mention')).toBe(false);
    });

    it('competitor_dominated does NOT count as visibility', () => {
        expect(countsAsVisibilityOutcome('competitor_dominated')).toBe(false);
    });

    it('not_mentioned does NOT count as visibility', () => {
        expect(countsAsVisibilityOutcome('not_mentioned')).toBe(false);
    });

    it('low_quality does NOT count as visibility', () => {
        expect(countsAsVisibilityOutcome('low_quality')).toBe(false);
    });

    it('null/undefined/unknown outcome does NOT count as visibility', () => {
        expect(countsAsVisibilityOutcome(null)).toBe(false);
        expect(countsAsVisibilityOutcome(undefined)).toBe(false);
        expect(countsAsVisibilityOutcome('garbage')).toBe(false);
    });

    it('target_found alone is insufficient — low_quality with target_found must not count', () => {
        // Simulate: blind run, target found, but empty_signal tier → low_quality outcome
        const outcome = classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: true,
            runSignalTier: 'empty_signal',
            competitorCount: 0,
            totalMentioned: 0,
        });
        expect(outcome).toBe('low_quality');
        expect(countsAsVisibilityOutcome(outcome)).toBe(false);
    });

    it('blind discovery + target_found + good signal → spontaneous_mention → counts', () => {
        const outcome = classifyMeasurementOutcome({
            discoveryMode: 'blind_discovery',
            targetFound: true,
            runSignalTier: 'useful',
            competitorCount: 1,
            totalMentioned: 2,
        });
        expect(outcome).toBe('spontaneous_mention');
        expect(countsAsVisibilityOutcome(outcome)).toBe(true);
    });

    it('brand_aware + target_found → assisted_mention → does NOT count as spontaneous visibility', () => {
        const outcome = classifyMeasurementOutcome({
            discoveryMode: 'brand_aware',
            targetFound: true,
            runSignalTier: 'useful',
            competitorCount: 0,
            totalMentioned: 1,
        });
        expect(outcome).toBe('assisted_mention');
        expect(countsAsVisibilityOutcome(outcome)).toBe(false);
    });

    it('agrees with MEASUREMENT_OUTCOMES taxonomy for every defined outcome', () => {
        for (const [key, meta] of Object.entries(MEASUREMENT_OUTCOMES)) {
            expect(countsAsVisibilityOutcome(key)).toBe(meta.counts_as_visibility);
        }
    });
});
