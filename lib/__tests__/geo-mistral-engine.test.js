import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const callAiTextMock = vi.fn();
const callAiJsonMock = vi.fn();

const dbMock = {
    getClientById: vi.fn(),
    getTrackedQueries: vi.fn(),
    getTrackedQueriesAll: vi.fn(),
    getCompetitorAliases: vi.fn(),
    createQueryRun: vi.fn(),
    updateQueryRun: vi.fn(),
    createQueryMentions: vi.fn(),
    deleteQueryMentionsByRunId: vi.fn(),
    getQueryRunById: vi.fn(),
    logAction: vi.fn(),
    countQueryRunsForClientSince: vi.fn(),
};

vi.mock('@/lib/ai/index', () => ({
    callAiText: (...args) => callAiTextMock(...args),
    callAiJson: (...args) => callAiJsonMock(...args),
}));

vi.mock('@/lib/db', () => dbMock);

vi.mock('@/lib/ai/prompts', () => ({
    buildGeoPromptForMode: vi.fn(() => ({
        messages: [
            { role: 'system', content: 'system' },
            { role: 'user', content: 'user' },
        ],
        metadata: {
            discovery_mode: 'brand_aware',
            answer_generation_mode: 'controlled_context_answer',
            context_injected: true,
            business_context_used: true,
            source_grounded: false,
            sources_provided: [],
            bias_risk: 'context_injected',
            evidence_level: 'weak',
            answer_type: 'evaluation',
            target_brand: 'Client Test',
            prompt_version: 'geo-v3.0.0',
            prompt_template_id: 'geo.controlled_context_answer.geo-v3.0.0',
        },
    })),
    buildGeoQueryPrompt: vi.fn(() => [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
    ]),
    buildGeoQueryAnalysisPrompt: vi.fn(() => [
        { role: 'system', content: 'analysis-system' },
        { role: 'user', content: 'analysis-user' },
    ]),
}));

vi.mock('@/lib/ai/normalize', () => ({
    normalizeGeoQueryAnalysis: vi.fn((data) => ({
        success: true,
        data,
        errors: null,
    })),
}));

vi.mock('@/lib/client-profile', () => ({
    getBusinessShortDescription: vi.fn(() => 'Description courte'),
}));

vi.mock('@/lib/queries/extraction-v2', () => ({
    getExtractionVersion: vi.fn(() => 'v2-test'),
    buildExtractionArtifacts: vi.fn(() => ({
        targetDetection: {
            target_found: true,
            target_position: 1,
        },
        counts: {
            total: 1,
            sources: 1,
            competitors: 0,
        },
        diagnostics: {
            run_signal_tier: 'medium',
            zero_citation_reason: null,
            zero_competitor_reason: null,
            operator_reason_codes: [],
        },
        parseStatus: 'parsed_ok',
        parseWarnings: [],
        parseConfidence: 0.9,
        mentionRows: [
            {
                business_name: 'Client Test',
                position: 1,
                context: 'Mention principale',
                is_target: true,
                sentiment: 'positive',
                entity_type: 'company',
                mention_kind: 'mentioned',
            },
        ],
        normalizedResponse: {
            ok: true,
        },
        rawLayer: {},
        parsedLayer: {},
        normalizedLayer: {},
        verifiedLayer: {},
        extractionVersion: 'v2-test',
    })),
}));

const ORIGINAL_ENV = { ...process.env };

describe('GEO Mistral engine wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
        process.env.GEO_USE_MISTRAL_ENGINE = '1';
        process.env.MISTRAL_API_KEY = 'test-key';
        process.env.MISTRAL_MODEL_QUERY = 'mistral-test-model';

        dbMock.getClientById.mockResolvedValue({
            id: 'client-1',
            client_name: 'Client Test',
            website_url: 'https://client.test',
            seo_description: 'Description SEO',
            business_details: {
                services: ['Audit GEO'],
            },
            address: {
                city: 'Paris',
            },
        });
        dbMock.getTrackedQueries.mockResolvedValue([
            {
                id: 'query-1',
                query_text: 'Meilleure agence SEO locale a Paris',
                locale: 'fr-FR',
            },
        ]);
        dbMock.getTrackedQueriesAll.mockResolvedValue([]);
        dbMock.getCompetitorAliases.mockResolvedValue([]);
        dbMock.countQueryRunsForClientSince.mockResolvedValue(0);
        dbMock.createQueryRun.mockResolvedValue({ id: 'run-1' });
        dbMock.updateQueryRun.mockResolvedValue({ id: 'run-1' });
        dbMock.createQueryMentions.mockResolvedValue([]);
        dbMock.logAction.mockResolvedValue(undefined);

        callAiTextMock.mockResolvedValue({
            provider: 'mistral',
            model: 'mistral-test-model',
            text: 'Voici des options locales avec sources.',
            usage: {
                prompt_tokens: 120,
                completion_tokens: 80,
            },
        });

        callAiJsonMock.mockResolvedValue({
            provider: 'mistral',
            model: 'mistral-test-model',
            usage: {
                prompt_tokens: 40,
                completion_tokens: 60,
            },
            data: {
                query: 'Meilleure agence SEO locale a Paris',
                response_text: 'Voici des options locales avec sources.',
                mentioned_businesses: [
                    {
                        name: 'Client Test',
                        position: 1,
                        context: 'Mention principale',
                        is_target: true,
                        sentiment: 'positive',
                    },
                ],
                total_businesses_mentioned: 1,
                target_found: true,
                target_position: 1,
            },
        });
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('defines mistral_geo_default variant in engine variants', async () => {
        const { ENGINE_VARIANTS } = await import('../queries/engine-variants.js');
        expect(ENGINE_VARIANTS.mistral_geo_default).toBeDefined();
        expect(ENGINE_VARIANTS.mistral_geo_default.provider).toBe('mistral');
        expect(ENGINE_VARIANTS.mistral_geo_default.model).toBe('mistral-test-model');
    });

    it('uses Mistral overrides for GEO query + analysis when enabled', async () => {
        const { runTrackedQueriesForClient } = await import('../queries/run-tracked-queries.js');

        const result = await runTrackedQueriesForClient({
            clientId: 'client-1',
            runMode: 'standard',
        });

        expect(result.variants).toEqual(['mistral_geo_default']);
        expect(dbMock.createQueryRun).toHaveBeenCalledWith(expect.objectContaining({
            parse_status: null,
        }));
        expect(callAiTextMock).toHaveBeenCalledWith(expect.objectContaining({
            providerOverride: 'mistral',
            fallbackProvider: null,
            modelOverride: 'mistral-test-model',
        }));
        expect(callAiJsonMock).toHaveBeenCalledWith(expect.objectContaining({
            providerOverride: 'mistral',
            fallbackProvider: null,
            modelOverride: expect.any(String),
        }));
    });

    it('preserves failed execution status when reparsing a stored run', async () => {
        dbMock.getQueryRunById.mockResolvedValue({
            id: 'run-1',
            client_id: 'client-1',
            tracked_query_id: 'query-1',
            query_text: 'Meilleure agence SEO locale a Paris',
            raw_response_full: 'Réponse brute utile.',
            response_text: 'Réponse brute utile.',
            raw_analysis: { analysis_data: {} },
            status: 'failed',
        });

        const { reparseStoredQueryRun } = await import('../queries/run-tracked-queries.js');

        await reparseStoredQueryRun({
            clientId: 'client-1',
            runId: 'run-1',
            performedBy: 'operator@test.dev',
        });

        expect(dbMock.updateQueryRun).toHaveBeenCalledWith('run-1', expect.objectContaining({
            status: 'failed',
        }));
    });
});
