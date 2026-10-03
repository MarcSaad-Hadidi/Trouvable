import { describe, expect, it } from 'vitest';

import {
    ACTIONABILITY_DIMENSION_WEIGHTS,
    buildActionabilityReport,
    deriveActionabilityInput,
    __internal__,
} from '../agent/actionability.js';

const DIM_KEYS = [
    'offer_clarity',
    'contact_booking',
    'local_coverage',
    'trust_proof',
    'content_actionability',
];

function makeAudit(overrides = {}) {
    return {
        id: 'audit-1',
        created_at: new Date().toISOString(),
        scan_status: 'success',
        extracted_data: {
            phones: [],
            emails: [],
            social_links: [],
            faq_pairs: [],
            schema_entities: [],
            h2_clusters: [],
            local_signals: {},
            trust_signals: {},
            service_signals: {},
            page_stats: {},
            ...(overrides.extracted_data || {}),
        },
        ...overrides,
    };
}

function makeClient(overrides = {}) {
    return {
        business_details: {},
        contact_info: {},
        address: {},
        seo_data: {},
        geo_ai_data: {},
        social_profiles: [],
        geo_faqs: [],
        ...overrides,
    };
}

describe('actionability weights', () => {
    it('sums to 1.0', () => {
        const sum = Object.values(ACTIONABILITY_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    });

    it('locks the exact Phase 2 weights', () => {
        expect(ACTIONABILITY_DIMENSION_WEIGHTS.offer_clarity).toBe(0.30);
        expect(ACTIONABILITY_DIMENSION_WEIGHTS.contact_booking).toBe(0.25);
        expect(ACTIONABILITY_DIMENSION_WEIGHTS.local_coverage).toBe(0.20);
        expect(ACTIONABILITY_DIMENSION_WEIGHTS.trust_proof).toBe(0.15);
        expect(ACTIONABILITY_DIMENSION_WEIGHTS.content_actionability).toBe(0.10);
    });
});

describe('buildActionabilityReport — unavailable paths', () => {
    it('returns unavailable when no audit is provided', () => {
        const report = buildActionabilityReport({ client: makeClient(), audit: null });
        expect(report.available).toBe(false);
        expect(report.emptyState).toBeTruthy();
        expect(report.summary.globalScore).toBe(null);
    });

    it('returns unavailable when the last audit failed', () => {
        const report = buildActionabilityReport({
            client: makeClient(),
            audit: makeAudit({ scan_status: 'failed' }),
        });
        expect(report.available).toBe(false);
        expect(report.emptyState).toBeTruthy();
    });
});

describe('buildActionabilityReport — empty audit', () => {
    it('produces all 5 dimensions with low scores and plenty of gaps', () => {
        const report = buildActionabilityReport({
            client: makeClient(),
            audit: makeAudit(),
        });
        expect(report.available).toBe(true);
        expect(report.dimensions).toHaveLength(5);
        for (const key of DIM_KEYS) {
            const dim = report.dimensions.find((d) => d.key === key);
            expect(dim).toBeTruthy();
            expect(dim.score).toBeLessThanOrEqual(60);
            expect(dim.gaps.length).toBeGreaterThan(0);
        }
        expect(report.summary.globalScore).toBeLessThan(50);
    });
});

describe('buildActionabilityReport — observed signal guardrail', () => {
    it('declared-only profile cannot exceed the 60 ceiling on any dimension without audit evidence', () => {
        const client = makeClient({
            business_details: {
                services: ['Service A', 'Service B', 'Service C'],
                short_desc: 'Cabinet spécialisé en conseil stratégique local.',
                long_desc: 'Texte long de présentation détaillée très complet avec beaucoup de contenu explicatif utile pour les moteurs.',
                areas_served: ['Montréal', 'Laval', 'Longueuil'],
                opening_hours: ['Lun-Ven 09h-17h'],
                maps_url: 'https://maps.example.com/foo',
            },
            contact_info: {
                phone: '+1-514-555-0000',
                public_email: 'contact@example.com',
            },
            address: {
                city: 'Montréal',
                region: 'Québec',
                street: '100 rue Saint-Denis',
            },
            geo_ai_data: {
                proofs: ['Certification ISO', 'Membre de la Chambre'],
                guarantees: ['Garantie satisfait ou remboursé'],
            },
            social_profiles: ['https://linkedin.com/example', 'https://twitter.com/example'],
            geo_faqs: [{ q: 'Q', a: 'A' }],
        });

        const report = buildActionabilityReport({ client, audit: makeAudit() });
        for (const dim of report.dimensions) {
            expect(dim.score).toBeLessThanOrEqual(60);
        }
    });
});

describe('buildActionabilityReport — rich observed data', () => {
    it('surfaces high scores and top strengths when audit has strong evidence', () => {
        const client = makeClient({
            business_details: {
                services: ['Consulting', 'Formation', 'Coaching'],
                short_desc: 'Cabinet indépendant spécialisé en stratégie numérique locale.',
                long_desc: 'Description longue approfondie '.repeat(20),
                areas_served: ['Montréal', 'Laval'],
                opening_hours: ['Lun-Ven 09h-17h'],
            },
            contact_info: {
                phone: '+1-514-555-0000',
                public_email: 'contact@example.com',
            },
            address: { city: 'Montréal', region: 'Québec', street: '1 rue X' },
            geo_ai_data: { proofs: ['ISO', 'Chambre'] },
            social_profiles: ['https://linkedin.com/x'],
        });

        const audit = makeAudit({
            created_at: new Date().toISOString(),
            extracted_data: {
                phones: ['+1-514-555-0000'],
                emails: ['contact@example.com'],
                social_links: ['https://linkedin.com/x', 'https://facebook.com/x', 'https://instagram.com/x'],
                faq_pairs: [
                    { q: 'Q1', a: 'A1' },
                    { q: 'Q2', a: 'A2' },
                    { q: 'Q3', a: 'A3' },
                ],
                has_faq_schema: true,
                has_organization_schema: true,
                has_local_business_schema: true,
                schema_entities: [
                    { '@type': 'Service' },
                    { '@type': 'Review' },
                    { '@type': 'LocalBusiness' },
                ],
                h2_clusters: [['A', 'B', 'C', 'D']],
                local_signals: {
                    cities: ['Montréal', 'Laval', 'Longueuil'],
                    regions: ['Québec'],
                    area_served: ['Grand Montréal'],
                },
                trust_signals: {
                    proof_terms: ['certifié', 'accrédité', 'membre', 'reconnu'],
                    review_terms: ['avis', 'témoignages', 'note'],
                    social_networks: ['linkedin', 'facebook', 'instagram'],
                },
                service_signals: { service_terms: ['conseil', 'stratégie', 'coaching'] },
                page_stats: {
                    service_pages: 4,
                    contact_pages: 2,
                    about_pages: 1,
                    faq_pages: 1,
                    total_word_count: 8000,
                    success_count: 15,
                },
            },
        });

        const report = buildActionabilityReport({ client, audit });

        expect(report.available).toBe(true);
        expect(report.summary.globalScore).toBeGreaterThanOrEqual(70);
        expect(report.summary.globalStatus).toBe('couvert');
        expect(report.topStrengths.length).toBeGreaterThan(0);
        expect(report.reliability).toBe('calculated');
    });
});

describe('buildActionabilityReport — freshness reliability tiers', () => {
    it('is stale between 60 and 180 days', () => {
        const audit = makeAudit({
            created_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        });
        const report = buildActionabilityReport({ client: makeClient(), audit });
        expect(report.reliability).toBe('stale');
    });

    it('is low above 180 days', () => {
        const audit = makeAudit({
            created_at: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
        });
        const report = buildActionabilityReport({ client: makeClient(), audit });
        expect(report.reliability).toBe('low');
    });
});

describe('deriveActionabilityInput', () => {
    it('returns null when report is unavailable', () => {
        const report = buildActionabilityReport({ client: makeClient(), audit: null });
        expect(deriveActionabilityInput(report)).toBe(null);
    });

    it('returns { score, reliability } when report is available', () => {
        const report = buildActionabilityReport({ client: makeClient(), audit: makeAudit() });
        const input = deriveActionabilityInput(report);
        expect(input).toBeTruthy();
        expect(input.score).toBe(report.summary.globalScore);
        expect(input.reliability).toBe(report.reliability);
    });
});

describe('collectTopFixes', () => {
    const { collectTopFixes } = __internal__;
    it('prioritizes high-weight dimensions with low scores', () => {
        const dims = [
            { key: 'offer_clarity', label: 'Offre', score: 30, topFix: 'fix offer' },
            { key: 'contact_booking', label: 'Contact', score: 20, topFix: 'fix contact' },
            { key: 'local_coverage', label: 'Local', score: 50, topFix: 'fix local' },
            { key: 'trust_proof', label: 'Trust', score: 70, topFix: null },
            { key: 'content_actionability', label: 'Content', score: 10, topFix: 'fix content' },
        ];
        const fixes = collectTopFixes(dims, 3);
        expect(fixes).toHaveLength(3);
        expect(fixes[0].dimensionKey).toBe('contact_booking');
        expect(fixes[1].dimensionKey).toBe('offer_clarity');
        expect(fixes[2].dimensionKey).toBe('local_coverage');
    });
});
