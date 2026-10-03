import { describe, it, expect } from 'vitest';
import { resolveBusinessType } from '@/lib/ai/business-type-resolver';

// ──────────────────────────────────────────────────────────────
// Business type resolver — canonical resolution tests
// ──────────────────────────────────────────────────────────────

describe('resolveBusinessType', () => {
    // ── Trouvable (service-led) ──────────────────────────────
    it('resolves Trouvable as operated_service with ai_visibility_services category', () => {
        // Trouvable is a service-led firm, not a self-serve SaaS product
        const result = resolveBusinessType('', {}, 'Trouvable');
        expect(result.canonical_category).toBe('ai_visibility_services');
        expect(result.canonical_subcategory).toBe('local_visibility_strategy');
        expect(result.business_model_detected).toBe('operated_service');
        expect(result.target_audience).toBe('b2b');
        expect(result.category_confidence).toBe('strong');
        expect(result.needs_review).toBe(false);
    });

    it('resolves Trouvable with generic LocalBusiness schema type as service-led', () => {
        const result = resolveBusinessType('LocalBusiness', { type: 'generic_business' }, 'Trouvable');
        expect(result.canonical_category).toBe('ai_visibility_services');
        expect(result.business_model_detected).toBe('operated_service');
        expect(result.target_audience).toBe('b2b');
        expect(result.category_confidence).toBe('strong');
    });

    it('resolves Trouvable with explicit SEO signals as service-led, not SaaS', () => {
        const result = resolveBusinessType('', { type: 'saas_software', label: 'SEO platform' }, 'Trouvable');
        expect(result.canonical_category).toBe('ai_visibility_services');
        expect(result.business_model_detected).toBe('operated_service');
        expect(result.category_confidence).toBe('strong');
    });

    // ── Generic / unknown clients ────────────────────────────
    it('returns unknown for generic client with empty profile', () => {
        const result = resolveBusinessType('', {}, 'Acme Corp');
        expect(result.canonical_category).toBe('unknown');
        expect(result.needs_review).toBe(true);
        expect(result.category_confidence).toBe('weak');
    });

    // ── Local service ────────────────────────────────────────
    it('resolves descriptive Schema.org types correctly', () => {
        const result = resolveBusinessType('Restaurant', {}, 'Le Petit Bistro');
        expect(result.business_model_detected).toBe('local_service');
        expect(result.target_audience).toBe('b2c');
        expect(result.category_confidence).toBe('high');
    });

    it('uses client name as part of resolution signals', () => {
        // Client name "Salon" triggers local_service detection because clientName is now included in typeHay
        const result = resolveBusinessType('', {}, 'Salon Beauté Montreal');
        expect(result.business_model_detected).toBe('local_service');
    });

    // ── True SaaS (must remain SaaS) ────────────────────────
    it('resolves pure SaaS product from services — no agency/consulting override', () => {
        const result = resolveBusinessType('', {
            type: 'generic_business',
            services_preview: ['Cloud platform', 'API integration'],
        }, 'TechCo');
        expect(result.business_model_detected).toBe('saas');
        expect(result.target_audience).toBe('b2b');
    });

    it('preserves SaaS for a self-serve software product with no service-led signals', () => {
        const result = resolveBusinessType('SoftwareApplication', {
            type: 'saas_software',
            label: 'Project management tool',
        }, 'TaskMaster Pro');
        expect(result.business_model_detected).toBe('saas');
        expect(result.canonical_category).not.toBe('unknown');
    });

    // ── Service-led / operated-service (generalizable) ──────
    it('overrides SaaS to operated_service when agency/consulting signals are present', () => {
        // A digital agency that uses a platform internally but sells services
        const result = resolveBusinessType('', {
            type: 'generic_business',
            services_preview: ['Consulting stratégique', 'Cloud platform'],
        }, 'Agence Digitale XYZ');
        expect(result.business_model_detected).toBe('operated_service');
        expect(result.target_audience).toBe('b2b');
    });

    it('detects operated_service for a cabinet/firme with SaaS-like services', () => {
        const result = resolveBusinessType('', {
            type: 'generic_business',
            services_preview: ['Platform SaaS', 'Accompagnement stratégique'],
        }, 'Cabinet Stratégie Numérique');
        expect(result.business_model_detected).toBe('operated_service');
        expect(result.target_audience).toBe('b2b');
    });
});
