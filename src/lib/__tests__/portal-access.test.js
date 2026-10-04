import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
    auth: vi.fn(),
    currentUser: vi.fn(),
    from: vi.fn(),
    calls: [],
    updates: [],
    rows: {},
    failures: {},
    dashboard: vi.fn(),
    redirect: vi.fn(),
    notFound: vi.fn(),
    sendEmail: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: boundary.auth, currentUser: boundary.currentUser }));
vi.mock('@/lib/dev-bypass-server', () => ({
    getDevAdminForCurrentRequest: async () => null,
    isCurrentRequestCloudflareBypassEnabled: async () => false,
}));
vi.mock('@/lib/supabase-admin', () => ({ getAdminSupabase: () => ({ from: boundary.from }) }));
vi.mock('@/features/portal/server/data', () => ({ getPortalDashboardData: boundary.dashboard }));
vi.mock('@/features/portal/dashboard/PortalDashboard', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ redirect: boundary.redirect, notFound: boundary.notFound }));
vi.mock('resend', () => ({
    Resend: class {
        emails = { send: boundary.sendEmail };
    },
}));

import { getVerifiedClerkEmails, resolvePortalMembership } from '../../features/portal/server/access.js';
import PortalClientPage from '../../features/portal/PortalClientPage.jsx';
import { sendPortalInvitationEmail } from '../../features/portal/server/email.js';

function installFilteringDatabase() {
    boundary.from.mockImplementation((table) => {
        const call = { table, filters: [], update: null };
        boundary.calls.push(call);
        const query = {
            select() {
                return query;
            },
            eq(key, value) {
                call.filters.push(['eq', key, value]);
                return query;
            },
            neq(key, value) {
                call.filters.push(['neq', key, value]);
                return query;
            },
            in(key, values) {
                call.filters.push(['in', key, values]);
                return query;
            },
            update(payload) {
                call.update = payload;
                return query;
            },
            then(resolve, reject) {
                if (boundary.failures[table])
                    return Promise.resolve({ data: null, error: { message: boundary.failures[table] } }).then(
                        resolve,
                        reject,
                    );
                const rows = (boundary.rows[table] || []).filter((row) =>
                    call.filters.every(([op, key, value]) =>
                        op === 'eq' ? row[key] === value : op === 'neq' ? row[key] !== value : value.includes(row[key]),
                    ),
                );
                if (call.update) {
                    boundary.updates.push({ table, payload: call.update, ids: rows.map((row) => row.id) });
                    rows.forEach((row) => Object.assign(row, call.update));
                }
                return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
        };
        return query;
    });
}
const verifiedUser = () => ({
    id: 'user-a',
    emailAddresses: [
        { id: 'email-a', emailAddress: ' MEMBER@example.test ', verification: { status: 'verified' } },
        { id: 'email-b', emailAddress: 'unverified@example.test', verification: { status: 'unverified' } },
    ],
});
const membership = (overrides = {}) => ({
    id: 'membership-a',
    client_id: 'client-a',
    clerk_user_id: 'user-a',
    contact_email: 'member@example.test',
    status: 'active',
    member_type: 'client_contact',
    portal_role: 'viewer',
    ...overrides,
});

describe('actual portal membership and client boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('React', React);
        boundary.auth.mockResolvedValue({ userId: 'user-a' });
        boundary.currentUser.mockResolvedValue(verifiedUser());
        boundary.calls = [];
        boundary.updates = [];
        boundary.failures = {};
        boundary.rows = {
            client_portal_access: [membership()],
            client_geo_profiles: [
                { id: 'client-a', client_name: 'A', client_slug: 'client-a', lifecycle_status: 'active' },
                { id: 'client-b', client_name: 'B', client_slug: 'client-b', lifecycle_status: 'active' },
                { id: 'archived', client_name: 'Archived', client_slug: 'archived', lifecycle_status: 'archived' },
            ],
        };
        boundary.redirect.mockImplementation((url) => {
            throw new Error(`REDIRECT:${url}`);
        });
        boundary.notFound.mockImplementation(() => {
            throw new Error('NOT_FOUND');
        });
        boundary.dashboard.mockResolvedValue({ client: { id: 'client-a' } });
        boundary.sendEmail.mockResolvedValue({ error: null });
        installFilteringDatabase();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('does not query service-role data for an anonymous identity', async () => {
        boundary.auth.mockResolvedValue({ userId: null });
        const state = await resolvePortalMembership();
        expect(state.memberships).toEqual([]);
        expect(boundary.currentUser).not.toHaveBeenCalled();
        expect(boundary.from).not.toHaveBeenCalled();
    });
    it('normalizes only verified Clerk emails', () => {
        expect(getVerifiedClerkEmails(verifiedUser())).toEqual(['member@example.test']);
    });
    it('scopes active direct memberships to Clerk ID and excludes other users, inactive and archived clients', async () => {
        boundary.rows.client_portal_access.push(
            membership({ id: 'other-user', client_id: 'client-b', clerk_user_id: 'user-b' }),
            membership({ id: 'inactive', client_id: 'client-b', status: 'revoked' }),
            membership({ id: 'old', client_id: 'archived' }),
        );
        const state = await resolvePortalMembership();
        expect(state.resolvedBy).toBe('clerk_user_id');
        expect(state.memberships.map((row) => row.client_id)).toEqual(['client-a']);
        expect(boundary.calls[0]).toMatchObject({
            table: 'client_portal_access',
            filters: [
                ['eq', 'status', 'active'],
                ['eq', 'clerk_user_id', 'user-a'],
            ],
        });
        expect(boundary.calls[1]).toMatchObject({
            table: 'client_geo_profiles',
            filters: [
                ['in', 'id', ['client-a', 'archived']],
                ['neq', 'lifecycle_status', 'archived'],
            ],
        });
        expect(boundary.updates).toEqual([]);
    });
    it('uses verified-email fallback and preserves the default identity backfill', async () => {
        boundary.rows.client_portal_access = [
            membership({ clerk_user_id: null }),
            membership({
                id: 'unverified',
                client_id: 'client-b',
                contact_email: 'unverified@example.test',
                clerk_user_id: null,
            }),
        ];
        const state = await resolvePortalMembership();
        expect(state.resolvedBy).toBe('verified_email');
        expect(state.memberships.map((row) => row.client_id)).toEqual(['client-a']);
        expect(state.memberships[0].clerk_user_id).toBe('user-a');
        expect(boundary.updates).toEqual([
            { table: 'client_portal_access', payload: { clerk_user_id: 'user-a' }, ids: ['membership-a'] },
        ]);
    });
    it('resolves verified-email scope without writes when backfill is disabled', async () => {
        boundary.rows.client_portal_access = [membership({ clerk_user_id: null })];
        const state = await resolvePortalMembership({ backfill: false });
        expect(state.memberships.map((row) => row.client_id)).toEqual(['client-a']);
        expect(state.memberships[0].clerk_user_id).toBeNull();
        expect(boundary.updates).toEqual([]);
    });
    it('never grants unverified-email fallback membership', async () => {
        boundary.rows.client_portal_access = [
            membership({ clerk_user_id: null, contact_email: 'unverified@example.test' }),
        ];
        expect((await resolvePortalMembership()).memberships).toEqual([]);
        expect(boundary.calls.some((call) => call.table === 'client_geo_profiles')).toBe(false);
        expect(boundary.updates).toEqual([]);
    });
    it('does not grant access after a failed membership lookup', async () => {
        boundary.failures.client_portal_access = 'database unavailable';
        await expect(resolvePortalMembership()).rejects.toThrow('direct lookup');
        expect(boundary.calls.some((call) => call.table === 'client_geo_profiles')).toBe(false);
    });
    it('redirects client B requests to the sole authorized client A before loading dashboard data', async () => {
        await expect(PortalClientPage({ params: Promise.resolve({ clientSlug: 'client-b' }) })).rejects.toThrow(
            'REDIRECT:/portal/client-a',
        );
        expect(boundary.dashboard).not.toHaveBeenCalled();
    });
    it('returns notFound for an unauthorized slug when multiple memberships exist', async () => {
        boundary.rows.client_portal_access.push(membership({ id: 'membership-b', client_id: 'client-b' }));
        await expect(PortalClientPage({ params: Promise.resolve({ clientSlug: 'client-c' }) })).rejects.toThrow(
            'NOT_FOUND',
        );
        expect(boundary.dashboard).not.toHaveBeenCalled();
    });
    it('loads a permitted dashboard with the server-derived client ID', async () => {
        await PortalClientPage({ params: Promise.resolve({ clientSlug: 'client-a' }) });
        expect(boundary.dashboard).toHaveBeenCalledWith('client-a');
        expect(boundary.dashboard).toHaveBeenCalledTimes(1);
    });
    it('routes email Google CTA through authenticated portal without exposing a connector API capability', async () => {
        vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
        await sendPortalInvitationEmail({
            contactEmail: 'member@example.test',
            clientName: 'A',
            clientId: 'client-a',
            clientSlug: 'client-a',
        });
        const { html } = boundary.sendEmail.mock.calls[0][0];
        expect(html).toContain('href="http://localhost:3000/portal/client-a"');
        expect(html).not.toContain('/api/connectors/google/auth');
        expect(html).toContain('Connecter Google Search Console');
    });
});
