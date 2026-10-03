import { describe, it, expect } from 'vitest';

import {
    PROTOCOL_DIMENSION_WEIGHTS,
    buildProtocolsReport,
    deriveProtocolsInput,
} from '../agent/protocols.js';

function makeAudit(overrides = {}) {
    return {
        id: 'audit-1',
        created_at: new Date().toISOString(),
        scan_status: 'success',
        extracted_data: {
            has_faq_schema: false,
            has_organization_schema: false,
            has_local_business_schema: false,
            schema_entities: [],
            layered_v1: {
                site_level_expert: {
                    llms_txt_deep: null,
                    ai_discovery_endpoints: null,
                    brand_entity: null,
                },
                subsystem_scores: {
                    crawler_access_score: null,
                },
            },
        },
        ...overrides,
    };
}

describe('protocols weights', () => {
    it('sum to 1', () => {
        const sum = Object.values(PROTOCOL_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
    });
});

describe('buildProtocolsReport — unavailable states', () => {
    it('returns unavailable when no audit', () => {
        const report = buildProtocolsReport({ audit: null });
        expect(report.available).toBe(false);
        expect(report.reliability).toBe('unavailable');
        expect(report.summary.globalScore).toBeNull();
        expect(report.emptyState).toBeTruthy();
    });

    it('returns unavailable when audit failed', () => {
        const report = buildProtocolsReport({ audit: makeAudit({ scan_status: 'failed' }) });
        expect(report.available).toBe(false);
    });
});

describe('buildProtocolsReport — observed signal guardrail', () => {
    it('caps global score at 40 when nothing observed', () => {
        const report = buildProtocolsReport({ audit: makeAudit() });
        expect(report.available).toBe(true);
        expect(report.summary.globalScore).toBeLessThanOrEqual(40);
    });

    it('accepts high score when observed llms.txt + schema + crawler', () => {
        const audit = makeAudit({
            extracted_data: {
                has_faq_schema: true,
                has_organization_schema: true,
                has_local_business_schema: true,
                schema_entities: [{ type: 'Organization' }, { type: 'LocalBusiness' }, { type: 'FAQPage' }],
                layered_v1: {
                    site_level_expert: {
                        llms_txt_deep: {
                            score: 85,
                            details: {
                                found: true,
                                full_variant_found: true,
                                h1_count: 1,
                                h2_count: 5,
                                internal_links: 10,
                                external_links: 2,
                                sections_detected: { overview: true, products: true, docs: true, contact: true },
                                red_flags: [],
                            },
                        },
                        ai_discovery_endpoints: {
                            score: 60,
                            endpoints: [
                                { key: 'ai_well_known', url: '/.well-known/ai.txt', found: true, parse_ok: true },
                                { key: 'ai_faq_json', url: '/ai/faq.json', found: true, parse_ok: true },
                            ],
                        },
                        brand_entity: { score: 80, details: { has_organization_schema: true, has_local_business_schema: true } },
                    },
                    subsystem_scores: { crawler_access_score: 100 },
                },
            },
        });
        const report = buildProtocolsReport({ audit });
        expect(report.summary.globalScore).toBeGreaterThanOrEqual(70);
        expect(report.summary.globalStatus).toBe('couvert');
    });
});

describe('buildProtocolsReport — per-dimension behaviour', () => {
    it('llms.txt missing produces a high-priority fix', () => {
        const report = buildProtocolsReport({ audit: makeAudit() });
        const llms = report.dimensions.find((d) => d.key === 'llms_txt');
        expect(llms.score).toBe(0);
        expect(llms.gaps.length).toBeGreaterThan(0);
        expect(report.topFixes.some((fix) => fix.dimensionKey === 'llms_txt')).toBe(true);
    });

    it('crawler_access returns 0 when score absent', () => {
        const report = buildProtocolsReport({ audit: makeAudit() });
        const crawler = report.dimensions.find((d) => d.key === 'crawler_access');
        expect(crawler.score).toBe(0);
    });

    it('schema_entity rewards FAQ + Organization combo', () => {
        const audit = makeAudit({
            extracted_data: {
                ...makeAudit().extracted_data,
                has_faq_schema: true,
                has_organization_schema: true,
                schema_entities: [{ type: 'Organization' }, { type: 'FAQPage' }, { type: 'Article' }],
            },
        });
        const report = buildProtocolsReport({ audit });
        const schema = report.dimensions.find((d) => d.key === 'schema_entity');
        expect(schema.score).toBeGreaterThanOrEqual(70);
    });
});

describe('reliability tiers', () => {
    it('calculated for fresh audit', () => {
        const report = buildProtocolsReport({ audit: makeAudit() });
        expect(report.reliability).toBe('calculated');
    });

    it('stale for audit older than 60 days', () => {
        const audit = makeAudit({ created_at: new Date(Date.now() - 80 * 24 * 3600 * 1000).toISOString() });
        const report = buildProtocolsReport({ audit });
        expect(report.reliability).toBe('stale');
    });

    it('low for audit older than 180 days', () => {
        const audit = makeAudit({ created_at: new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString() });
        const report = buildProtocolsReport({ audit });
        expect(report.reliability).toBe('low');
    });
});

describe('deriveProtocolsInput', () => {
    it('returns null when unavailable', () => {
        expect(deriveProtocolsInput(null)).toBeNull();
        expect(deriveProtocolsInput({ available: false })).toBeNull();
    });

    it('returns score + reliability when available', () => {
        const audit = makeAudit({
            extracted_data: {
                ...makeAudit().extracted_data,
                layered_v1: {
                    site_level_expert: {
                        llms_txt_deep: {
                            score: 80,
                            details: {
                                found: true,
                                h2_count: 4,
                                internal_links: 6,
                                sections_detected: { overview: true, products: true, docs: true },
                                red_flags: [],
                            },
                        },
                        ai_discovery_endpoints: { score: 40, endpoints: [{ key: 'ai_well_known', url: '/.well-known/ai.txt', found: true, parse_ok: true }] },
                    },
                    subsystem_scores: { crawler_access_score: 80 },
                },
            },
        });
        const report = buildProtocolsReport({ audit });
        const input = deriveProtocolsInput(report);
        expect(input).not.toBeNull();
        expect(input.score).toBe(report.summary.globalScore);
        expect(input.reliability).toBe('calculated');
    });
});
