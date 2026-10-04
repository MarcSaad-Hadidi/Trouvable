import { beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ client: vi.fn(), audit: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: io.audit }));
import { getAgentActionabilitySlice } from '../agent/agent-actionability-slice';
import { getAgentProtocolsSlice } from '../agent/agent-protocols-slice';
beforeEach(() => {
    vi.clearAllMocks();
    io.client.mockResolvedValue({ client_name: 'Acme' });
    io.audit.mockResolvedValue(null);
});
describe('agent report sources', () => {
    it.each([getAgentActionabilitySlice, getAgentProtocolsSlice])(
        'retains a successful missing audit as an empty source',
        async (read) => {
            const report = await read('client-a');
            expect(report.status).toBe('available');
            expect(report.dataSources.latestAudit).toBe('empty');
            expect(report.available).toBe(false);
            expect(report.emptyState.description).toContain('Aucun audit');
        },
    );
    it.each([getAgentActionabilitySlice, getAgentProtocolsSlice])(
        'qualifies failed audit reads without leaking errors or reporting absence',
        async (read) => {
            io.audit.mockRejectedValue(new Error('private SQL token'));
            const report = await read('client-a');
            expect(report.dataSources.latestAudit).toBe('unavailable');
            expect(report.status).not.toBe('available');
            expect(report.available).toBe(false);
            expect(report.summary.globalScore).toBeNull();
            expect(report.emptyState.description).toContain('indisponibles');
            expect(report.emptyState.description).not.toContain('Aucun audit');
            expect(JSON.stringify(report)).not.toContain('private SQL token');
        },
    );
    it('does not derive profile gaps from a failed required client while retaining known audit freshness', async () => {
        io.client.mockImplementation(() => {
            throw new Error('private sync client');
        });
        io.audit.mockResolvedValue({ id: 'audit-a', created_at: '2026-01-01', extracted_data: {} });
        const report = await getAgentActionabilitySlice('client-a');
        expect(report.status).toBe('partial');
        expect(report.dataSources.client).toBe('unavailable');
        expect(report.dimensions).toEqual([]);
        expect(report.summary.globalScore).toBeNull();
        expect(report.freshness.auditCreatedAt).toBe('2026-01-01');
    });
    it.each(['client-a', 'client-b'])('scopes all reads to %s and preserves a known zero score', async (clientId) => {
        io.audit.mockResolvedValue({ extracted_data: {} });
        const report = await getAgentProtocolsSlice(clientId);
        expect(report.summary.globalScore).toBe(0);
        expect(report.status).toBe('available');
        expect(io.audit).toHaveBeenCalledWith(clientId);
        await getAgentActionabilitySlice(clientId);
        expect(io.client).toHaveBeenCalledWith(clientId);
    });
    it('qualifies complete source failure as unavailable', async () => {
        io.client.mockRejectedValue(new Error('private'));
        io.audit.mockRejectedValue(new Error('private'));
        expect((await getAgentActionabilitySlice('client-a')).status).toBe('unavailable');
    });
});
