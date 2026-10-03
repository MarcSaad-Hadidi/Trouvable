import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { scoreAuditV2 } from '../audit/score.js';
import { buildCanonicalBusinessDetection } from '../truth/detection.js';
import { normalizeAuditProblem } from '../truth/problems.js';

describe('buildCanonicalBusinessDetection', () => {
    it('marks explicit profile business type as observed and canonical category as derived', () => {
        const detection = buildCanonicalBusinessDetection({
            clientName: 'Bistro du Coin',
            rawBusinessType: 'Restaurant',
            siteClassification: {
                type: 'local_business',
                label: 'Local business',
                confidence: 0.88,
            },
            servicesPreview: ['Brunch', 'Terrasse'],
            shortDescription: 'Restaurant de quartier avec terrasse et cuisine de saison.',
            address: { city: 'Montreal', region: 'QC' },
            targetRegion: 'Montreal',
            localSignals: {
                cities: ['Montreal'],
                regions: ['QC'],
                address_lines: ['123 rue Principale'],
            },
            pageSummaries: [{ page_type: 'contact', url: 'https://bistro.example/contact', title: 'Contact' }],
        });

        expect(detection.facts.business_type.truth_class).toBe('observed');
        expect(detection.facts.canonical_category.truth_class).toBe('derived');
        expect(detection.facts.canonical_category.review_status).toBe('auto_accepted');
        expect(detection.facts.locality.truth_class).toBe('observed');
        expect(detection.facts.key_pages[0].truth_class).toBe('observed');
    });

    it('blocks unresolved category signals for review', () => {
        const detection = buildCanonicalBusinessDetection({
            clientName: 'Entreprise Test',
            rawBusinessType: '',
            siteClassification: {
                type: 'generic_business',
                label: 'Entreprise generaliste',
                confidence: 0.3,
            },
            servicesPreview: [],
            shortDescription: '',
            targetRegion: '',
        });

        expect(detection.facts.canonical_category.truth_class).toBe('uncertain');
        expect(detection.facts.canonical_category.review_status).toBe('blocked');
        expect(detection.review_queue).toContain('canonical_category');
    });
});

describe('normalizeAuditProblem', () => {
    it('adds canonical problem metadata while preserving legacy text fields', () => {
        const problem = normalizeAuditProblem({
            title: 'Homepage title is missing or too weak',
            description: 'The homepage title is missing or too short.',
            severity: 'medium',
            priority: 'high',
            category: 'technical',
            dimension: 'technical_seo',
            provenance: 'observed',
            evidence_summary: 'No title tag was observed on the homepage.',
            recommended_fix: 'Add a stronger title.',
        }, {
            auditId: 'audit_123',
            clientId: 'client_123',
            sourceUrl: 'https://example.com',
        });

        expect(problem.type).toContain('technical_seo');
        expect(problem.family).toBe('technical_seo');
        expect(problem.impact).toBe('discoverability');
        expect(problem.surface).toBe('site');
        expect(problem.truth_class).toBe('observed');
        expect(problem.confidence).toBe('high');
        expect(problem.review_status).toBe('auto_accepted');
        expect(problem.affected_entity.audit_id).toBe('audit_123');
        expect(problem.metadata.truth_engine_version).toBe('v1');
        expect(problem.title).toBe('Homepage title is missing or too weak');
    });
});

describe('scoreAuditV2', () => {
    it('returns normalized issues with truth metadata in the audit path', () => {
        const scanResults = {
            resolved_url: 'https://example.com',
            source_url: 'https://example.com',
            scanned_pages: [{ success: true }],
            extracted_data: {
                titles: ['ABC Plumbing Montreal'],
                descriptions: ['Plombier a Montreal pour urgences, debouchage, inspection et reparation residentielle.'],
                h1s: ['Plombier a Montreal'],
                canonicals: ['https://example.com'],
                has_noindex: false,
                has_faq_schema: false,
                faq_pairs: [],
                has_local_business_schema: false,
                local_signals: {
                    cities: ['Montreal'],
                    regions: ['QC'],
                    address_lines: ['123 rue Principale'],
                },
                trust_signals: {
                    proof_terms: ['10 ans d experience'],
                    review_terms: ['5 etoiles'],
                },
                service_signals: {
                    services: ['Urgence plomberie', 'Inspection'],
                    keywords: ['plombier'],
                },
                business_names: ['ABC Plumbing'],
                phones: ['514-555-0000'],
                emails: ['contact@example.com'],
                social_links: ['https://facebook.com/abcplumbing'],
                schema_entities: [{ '@type': 'Organization' }],
                page_summaries: [
                    { page_type: 'homepage', title: 'ABC Plumbing Montreal', description: 'Service de plomberie a Montreal' },
                    { page_type: 'contact', title: 'Contact', url: 'https://example.com/contact' },
                ],
                page_stats: {
                    total_word_count: 620,
                    service_pages: 1,
                    contact_pages: 1,
                    about_pages: 1,
                    faq_pages: 0,
                },
                technology_signals: {
                    app_shell_pages: 0,
                    hydration_hints: [],
                },
                h2_clusters: [['urgence', 'inspection', 'drain']],
            },
        };

        const siteClassification = {
            type: 'local_business',
            label: 'Local business',
            confidence: 0.86,
            reasons: ['Observed local service signals'],
            applicability: {
                local_schema: 'high',
                service_area: 'high',
                public_contact: 'high',
            },
            weight_profile: {
                technical_seo: 0.28,
                local_readiness: 0.28,
                ai_answerability: 0.18,
                trust_signals: 0.14,
                identity_completeness: 0.12,
            },
            evidence_summary: ['Observed service area and contactability signals'],
        };

        const result = scoreAuditV2(scanResults, siteClassification, {
            auditId: 'audit_456',
            clientId: 'client_456',
            sourceUrl: 'https://example.com',
        });

        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues.every((issue) => typeof issue.id === 'string' && issue.id.length > 0)).toBe(true);
        expect(result.issues.every((issue) => typeof issue.truth_class === 'string')).toBe(true);
        expect(result.issues.every((issue) => typeof issue.review_status === 'string')).toBe(true);
        expect(result.issues.some((issue) => issue.metadata.truth_engine_version === 'v1')).toBe(true);
        expect(result.issues.some((issue) => issue.affected_entity.audit_id === 'audit_456')).toBe(true);
    });
});