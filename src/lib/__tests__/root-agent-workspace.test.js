import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({
    overview: vi.fn(),
    readiness: vi.fn(),
    opportunities: vi.fn(),
    client: vi.fn(),
    audit: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/operator-intelligence/overview', () => ({ getOverviewSlice: io.overview }));
vi.mock('@/lib/operator-intelligence/geo-readiness', () => ({ getReadinessSlice: io.readiness }));
vi.mock('@/lib/operator-intelligence/opportunities', () => ({ getOpportunitySlice: io.opportunities }));
vi.mock('@/lib/db/clients', () => ({ getClientById: io.client }));
vi.mock('@/lib/db/audits', () => ({ getLatestAudit: io.audit }));

import { getAgentSlice } from '../agent/agent-slice.js';
import { getAgentFixesSlice } from '../agent/agent-fixes-slice.js';

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    io.overview.mockResolvedValue({
        status: 'available',
        dataSources: { audit: 'empty' },
        errors: [],
        kpis: { trackedPromptsTotal: 0, completedRunsTotal: 0 },
        visibility: {},
    });
    io.readiness.mockResolvedValue({ available: false, topBlockers: [] });
    io.opportunities.mockResolvedValue({
        status: 'available',
        summary: { open: 0, pendingMergeCount: 0, reviewQueueCount: 0, remediationDraftCount: 0 },
        items: [],
    });
    io.client.mockResolvedValue({ id: 'client-a', client_name: 'A' });
    io.audit.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe.each([
    ['overview', getAgentSlice],
    ['fixes', getAgentFixesSlice],
])('%s workspace projection', (_name, load) => {
    it('loads the same five sources once and preserves measured zero versus missing audit', async () => {
        const slice = await load('client-a');
        for (const source of Object.values(io)) expect(source.mock.calls).toEqual([['client-a']]);
        expect(slice.status).toBe('available');
        expect(slice.dataSources).toEqual({
            audit: 'empty',
            overview: 'available',
            readiness: 'available',
            opportunities: 'available',
            client: 'available',
            latestAudit: 'empty',
        });
        expect(slice.errors).toEqual([]);
        expect(slice.topFixes.map((fix) => fix.id)).toContain('visibility-no-prompts');
        if (slice.snapshot) {
            expect(slice.snapshot).toMatchObject({ completedRunsTotal: 0, trackedPromptsTotal: 0, lastAuditAt: null });
            expect(slice.inputs.actionability).toBeNull();
            expect(slice.inputs.advancedProtocols).toBeNull();
        } else expect(slice.summary).toMatchObject({ pendingMergeCount: 0, reviewQueueCount: 0, opportunityOpen: 0 });
    });

    it.each(['client', 'audit'])('keeps independent evidence after a rejected %s read', async (source) => {
        io.audit.mockResolvedValue({ created_at: '2026-10-03T00:00:00Z', scan_status: 'success', extracted_data: {} });
        io[source].mockRejectedValue(new Error('private SQL stack'));
        const slice = await load('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.dataSources[source === 'audit' ? 'latestAudit' : 'client']).toBe('unavailable');
        expect(JSON.stringify(slice.errors)).not.toMatch(/private|SQL|stack/);
        if (slice.inputs) {
            expect(slice.inputs.actionability).toBeNull();
            if (source === 'audit') expect(slice.inputs.advancedProtocols).toBeNull();
            else expect(slice.inputs.advancedProtocols).toEqual({ score: 0, reliability: 'calculated' });
        }
        expect(slice.topFixes.some((fix) => fix.source === 'actionability')).toBe(false);
    });

    it('preserves nested source prefixes, error ordering and unknown counts', async () => {
        io.overview.mockResolvedValue({
            status: 'partial',
            dataSources: { totalQueryRuns: 'unavailable' },
            errors: [{ source: 'totalQueryRuns', message: 'safe overview message' }],
            kpis: { completedRunsTotal: null, trackedPromptsTotal: null },
        });
        io.readiness.mockResolvedValue({
            status: 'unavailable',
            available: false,
            dataSources: { audit: 'unavailable' },
            errors: [{ source: 'audit', message: 'private nested SQL' }],
        });
        io.opportunities.mockResolvedValue({
            status: 'partial',
            dataSources: { merges: 'unavailable' },
            errors: [{ source: 'merges', message: 'private opportunity SQL' }],
            summary: { open: null, reviewQueueCount: null, pendingMergeCount: null },
        });
        const slice = await load('client-a');
        expect(slice.status).toBe('partial');
        expect(slice.dataSources).toMatchObject({
            totalQueryRuns: 'unavailable',
            'readiness.audit': 'unavailable',
            'opportunities.merges': 'unavailable',
        });
        expect(slice.errors).toEqual([
            { source: 'totalQueryRuns', message: 'safe overview message' },
            { source: 'readiness', message: 'Données temporairement indisponibles.' },
            { source: 'readiness.audit', message: 'Données temporairement indisponibles.' },
            { source: 'opportunities.merges', message: 'Données temporairement indisponibles.' },
        ]);
        expect(slice.topFixes.some((fix) => fix.id === 'visibility-no-prompts')).toBe(false);
        if (slice.snapshot) expect(slice.snapshot.completedRunsTotal).toBeNull();
        else expect(slice.summary).toMatchObject({ pendingMergeCount: null, reviewQueueCount: null });
    });

    it('reports total unavailability after all independent loads reject', async () => {
        for (const source of Object.values(io)) source.mockRejectedValue(new Error('private outage'));
        const slice = await load('client-a');
        expect(slice.status).toBe('unavailable');
        expect(Object.values(slice.dataSources)).toEqual(Array(5).fill('unavailable'));
        expect(slice.errors.map((error) => error.source)).toEqual([
            'overview',
            'readiness',
            'opportunities',
            'client',
            'latestAudit',
        ]);
        expect(slice.topFixes).toEqual([]);
    });

    it('waits for a late source without rerunning any load', async () => {
        let release;
        io.audit.mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = resolve;
                }),
        );
        let completed = false;
        const pending = load('client-a').then((slice) => {
            completed = true;
            return slice;
        });
        await Promise.resolve();
        expect(completed).toBe(false);
        for (const source of Object.values(io)) expect(source).toHaveBeenCalledOnce();
        release(null);
        expect((await pending).dataSources.latestAudit).toBe('empty');
    });

    it('does not derive audit reports from a failed scan', async () => {
        io.audit.mockResolvedValue({ created_at: '2026-10-03T00:00:00Z', scan_status: 'failed', extracted_data: {} });
        const slice = await load('client-a');
        expect(slice.topFixes.some((fix) => ['actionability', 'protocols'].includes(fix.source))).toBe(false);
        if (slice.inputs) {
            expect(slice.inputs.actionability).toBeNull();
            expect(slice.inputs.advancedProtocols).toBeNull();
        }
    });
});
