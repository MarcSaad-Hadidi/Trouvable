import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const authMock = {
    requireAdmin: vi.fn(),
};
vi.mock('@/lib/auth', () => authMock);

const dbMock = {
    getClientById: vi.fn(),
    getClientBySlug: vi.fn(),
    updateClient: vi.fn(),
    createTrackedQuery: vi.fn(),
    updateTrackedQuery: vi.fn(),
    getTrackedQueriesAll: vi.fn(),
    getLatestAudit: vi.fn(),
    getLastRunPerTrackedQuery: vi.fn(),
    getQueryRunsHistory: vi.fn(),
    logAction: vi.fn(),
    isTrackedQueryConstraintDrift: vi.fn(() => false),
};
vi.mock('@/lib/db/clients', () => dbMock);
vi.mock('@/lib/db/tracked-queries', () => dbMock);
vi.mock('@/lib/db/audits', () => dbMock);
vi.mock('@/lib/db/query-runs', () => dbMock);
vi.mock('@/lib/db/actions', () => dbMock);
vi.mock('@/lib/db/query-support', () => dbMock);

const supabaseMock = {
    from: vi.fn(),
};
vi.mock('@/lib/supabase-admin', () => ({
    getAdminSupabase: vi.fn(() => supabaseMock),
}));

vi.mock('@/lib/audit/run-audit', () => ({
    runFullAudit: vi.fn(),
}));
vi.mock('@/features/portal/server/access', () => ({
    upsertClientPortalAccess: vi.fn(async () => null),
}));

describe('prompt contract API integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authMock.requireAdmin.mockResolvedValue({ email: 'admin@trouvable.local' });
        dbMock.getClientById.mockResolvedValue({
            id: '8f5fc5ac-d07a-4764-bcb2-550ea60f6f7d',
            client_name: 'Trouvable',
            business_type: 'ai visibility software',
            target_region: 'Montreal',
            address: { city: 'Montreal' },
            business_details: { services: ['visibilite IA locale'], competitors: ['Agency X'] },
        });
        dbMock.getClientBySlug.mockResolvedValue(null);
        dbMock.updateClient.mockImplementation(async (_id, payload) => ({ id: _id, ...payload }));
        dbMock.logAction.mockResolvedValue(undefined);
    });

    it('create prompt API persists canonical v2 fields', async () => {
        dbMock.createTrackedQuery.mockImplementation(async (payload) => ({ id: 'q1', ...payload }));

        const { POST } = await import('../../app/api/admin/queries/create/route.js');
        const response = await POST(new Request('http://localhost/api/admin/queries/create', {
            method: 'POST',
            body: JSON.stringify({
                clientId: '8f5fc5ac-d07a-4764-bcb2-550ea60f6f7d',
                query_text: "Quels criteres et preuves demander avant de choisir Trouvable ?",
                category: 'discovery',
                locale: 'fr-CA',
                prompt_mode: 'user_like',
                is_active: true,
            }),
        }));

        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        const payload = dbMock.createTrackedQuery.mock.calls[0][0];
        expect(payload.prompt_mode).toBeDefined();
        expect(payload.validation_status).toBeDefined();
        expect(Array.isArray(payload.validation_reasons)).toBe(true);
        expect(payload.prompt_metadata.prompt_mode).toBe(payload.prompt_mode);
    }, 15000);

    it('update prompt API recalculates and persists canonical fields', async () => {
        supabaseMock.from.mockReturnValue({
            select: () => ({
                eq: () => ({
                    single: async () => ({
                        data: {
                            id: '11111111-1111-4111-8111-111111111111',
                            client_id: '8f5fc5ac-d07a-4764-bcb2-550ea60f6f7d',
                            query_text: 'Ancien prompt',
                            locale: 'fr-CA',
                            prompt_metadata: { prompt_mode: 'user_like' },
                        },
                        error: null,
                    }),
                }),
            }),
        });
        dbMock.updateTrackedQuery.mockImplementation(async (id, payload) => ({ id, ...payload, client_id: '8f5fc5ac-d07a-4764-bcb2-550ea60f6f7d' }));

        const { POST } = await import('../../app/api/admin/queries/update/route.js');
        const response = await POST(new Request('http://localhost/api/admin/queries/update', {
            method: 'POST',
            body: JSON.stringify({
                id: '11111111-1111-4111-8111-111111111111',
                query_text: 'Liste 3 alternatives a Trouvable et justifie chaque option.',
                prompt_mode: 'operator_probe',
                is_active: true,
            }),
        }));

        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        const payload = dbMock.updateTrackedQuery.mock.calls[0][1];
        expect(payload.prompt_mode).toBe('operator_probe');
        expect(payload.validation_status).toBeDefined();
        expect(payload.prompt_metadata.prompt_mode).toBe('operator_probe');
    }, 15000);

    it('onboarding activation keeps prompt_mode and validation fields', async () => {
        dbMock.getClientById.mockResolvedValueOnce({
            id: '8f5fc5ac-d07a-4764-bcb2-550ea60f6f7d',
            client_name: 'Trouvable',
            client_slug: 'trouvable',
            business_type: 'ai visibility software',
            target_region: 'Montreal',
        });
        dbMock.updateTrackedQuery.mockResolvedValue(null);
        dbMock.getTrackedQueriesAll.mockResolvedValue([]);
        dbMock.createTrackedQuery.mockImplementation(async (payload) => ({ id: `q-${payload.query_text}`, ...payload }));

        const { activateClientOnboarding } = await import('../onboarding/client-onboarding.js');
        const result = await activateClientOnboarding({
            clientId: '8f5fc5ac-d07a-4764-bcb2-550ea60f6f7d',
            profile: {
                client_name: 'Trouvable',
                client_slug: 'trouvable',
                business_type: 'ai visibility software',
                target_region: 'Montreal',
                seo_description: '',
            },
            promptSuggestions: [
                {
                    query_text: "Pour quels types d'entreprises Trouvable est-il pertinent ?",
                    category: 'brand',
                    locale: 'fr-CA',
                    is_active: true,
                    prompt_mode: 'user_like',
                    intent_family: 'brand',
                    quality_status: 'strong',
                    validation: { status: 'strong', reasons: [] },
                },
            ],
        });

        expect(result.createdPrompts).toBe(1);
        const payload = dbMock.createTrackedQuery.mock.calls[0][0];
        expect(payload.prompt_mode).toBe('user_like');
        expect(payload.validation_status).toBe('strong');
        expect(Array.isArray(payload.validation_reasons)).toBe(true);
    }, 15000);
});
