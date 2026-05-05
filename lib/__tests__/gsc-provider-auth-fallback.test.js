import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const queryMock = vi.fn();

vi.mock('googleapis', () => {
    class OAuth2 {
        constructor() {
            this.kind = 'oauth';
        }

        setCredentials(credentials) {
            this.credentials = credentials;
        }
    }

    class JWT {
        constructor(options) {
            this.kind = 'jwt';
            this.options = options;
        }
    }

    return {
        google: {
            auth: { OAuth2, JWT },
            webmasters: ({ auth }) => ({
                searchanalytics: {
                    query: (request) => queryMock({ auth, request }),
                },
            }),
        },
    };
});

describe('GSC provider auth fallback', () => {
    beforeEach(() => {
        vi.resetModules();
        queryMock.mockReset();
        process.env.GOOGLE_OAUTH_CLIENT_ID = 'oauth-client-id';
        process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'oauth-client-secret';
        process.env.GOOGLE_SC_CLIENT_EMAIL = 'search-console@example.iam.gserviceaccount.com';
        process.env.GOOGLE_SC_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    });

    it('retries with the server service account when OAuth refresh fails with invalid_client', async () => {
        queryMock
            .mockRejectedValueOnce(Object.assign(new Error('invalid_client'), {
                response: { data: { error: 'invalid_client' } },
            }))
            .mockResolvedValueOnce({
                data: {
                    rows: [{
                        keys: ['test query'],
                        clicks: 3,
                        impressions: 30,
                        ctr: 0.1,
                        position: 2,
                    }],
                },
            });

        const { queryGscSearchAnalyticsRaw } = await import('@/lib/connectors/providers/gsc');
        const result = await queryGscSearchAnalyticsRaw({
            siteUrl: 'https://www.trouvable.app/',
            startDate: '2026-04-05',
            endDate: '2026-05-04',
            dimensions: ['query'],
            googleRefreshToken: 'stale-refresh-token',
        });

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].dimensions.query).toBe('test query');
        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(queryMock.mock.calls[0][0].auth.kind).toBe('oauth');
        expect(queryMock.mock.calls[1][0].auth.kind).toBe('jwt');
    });
});
