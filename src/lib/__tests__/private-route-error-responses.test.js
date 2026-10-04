import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => Object.fromEntries([
    'auth', 'opportunities', 'updateOpportunity', 'log', 'clearRuns', 'inspectRun', 'rerun', 'reparse',
    'health', 'tick', 'worker', 'queue', 'setActive', 'cadence', 'snapshot', 'updateConnector',
].map(name => [name, vi.fn()])));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ requireAdmin: io.auth }));
vi.mock('@/lib/db/opportunities', () => ({ getOpportunities: io.opportunities, updateOpportunity: io.updateOpportunity }));
vi.mock('@/lib/db/actions', () => ({ logAction: io.log }));
vi.mock('@/lib/db/query-runs', () => ({ deleteProblematicQueryRuns: io.clearRuns }));
vi.mock('@/lib/operator-intelligence/runs', () => ({ getRunInspectorSlice: io.inspectRun }));
vi.mock('@/lib/queries/run-tracked-queries', () => ({ rerunStoredQueryRun: io.rerun, reparseStoredQueryRun: io.reparse }));
vi.mock('@/lib/continuous/jobs', () => ({
    getRecurringJobHealthSlice: io.health, processContinuousTick: io.tick, processContinuousWorkerTick: io.worker,
    queueRecurringRunNow: io.queue, setRecurringJobActive: io.setActive, updateRecurringJobCadence: io.cadence,
    upsertVisibilitySnapshotForClient: io.snapshot,
}));
vi.mock('@/lib/connectors/repository', () => ({ updateConnectorState: io.updateConnector }));
import { POST as opportunityPost } from '../../app/api/admin/geo/client/[clientId]/opportunities/[opportunityId]/route.js';
import { POST as clearPost } from '../../app/api/admin/geo/client/[clientId]/runs/actions/route.js';
import { GET as inspectorGet, POST as runPost } from '../../app/api/admin/geo/client/[clientId]/runs/[runId]/route.js';
import { POST as continuousPost } from '../../app/api/admin/geo/client/[clientId]/continuous/actions/route.js';

const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const jobId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const endpoints = [
    { name: 'opportunity POST', handler: opportunityPost, params: { clientId, opportunityId: 'opportunity-a' }, body: { status: 'done' }, failing: io.opportunities },
    { name: 'runs actions POST', handler: clearPost, params: { clientId }, body: { action: 'clear_errors' }, failing: io.clearRuns },
    { name: 'run inspector GET', handler: inspectorGet, params: { clientId, runId: 'run-a' }, body: null, failing: io.inspectRun },
    { name: 'run POST', handler: runPost, params: { clientId, runId: 'run-a' }, body: { action: 'rerun' }, failing: io.rerun },
    { name: 'continuous POST', handler: continuousPost, params: { clientId }, body: { action: 'capture_snapshot' }, failing: io.snapshot },
];
const postEndpoints = endpoints.filter(endpoint => endpoint.body !== null);
const requestFor = body => ({ json: vi.fn().mockResolvedValue(body) });
const contextFor = params => ({ params: Promise.resolve(params) });
const dataIo = Object.entries(io).filter(([name]) => name !== 'auth').map(([, mock]) => mock);
const mutations = [io.updateOpportunity, io.log, io.clearRuns, io.rerun, io.reparse, io.tick, io.worker, io.queue, io.setActive, io.cadence, io.snapshot, io.updateConnector];
async function expectJson(response, status, payload) {
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
    const actual = await response.json();
    if (payload) expect(actual).toEqual(payload);
    return actual;
}

beforeEach(() => {
    for (const mock of Object.values(io)) mock.mockReset();
    io.auth.mockResolvedValue({ email: 'operator@example.test' });
    io.opportunities.mockResolvedValue([{ id: 'opportunity-a' }]);
    io.health.mockResolvedValue({ jobs: [{ id: jobId }] });
    io.clearRuns.mockResolvedValue({ deleted: 0 });
    io.inspectRun.mockResolvedValue({ run: { id: 'run-a', clicks: 0 } });
    io.updateOpportunity.mockResolvedValue({ id: 'opportunity-a', status: 'done', priority_score: 0 });
    io.rerun.mockResolvedValue({ count: 0 });
    io.reparse.mockResolvedValue({ mention_count: 0 });
    io.tick.mockResolvedValue({ queued: 0 });
    io.worker.mockResolvedValue({ executed: 0 });
    io.snapshot.mockResolvedValue({ visibility_score: 0 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('private route error responses preserve boundaries', () => {
    for (const message of ['SQL select service_role=private-fixture', 'Provider access_token=private-fixture']) {
        it.each(endpoints)(`returns generic no-store 500 for ${message} in $name`, async endpoint => {
            const failure = new Error(message);
            endpoint.failing.mockRejectedValue(failure);
            const response = await endpoint.handler(requestFor(endpoint.body), contextFor(endpoint.params));
            await expectJson(response, 500, { error: 'Erreur interne du serveur.' });
            expect(console.error).toHaveBeenCalledWith(expect.any(String), failure);
        });
    }
    it.each(endpoints)('denies unauthorized access before parameters, JSON or data IO in $name', async endpoint => {
        io.auth.mockResolvedValue(null);
        const request = requestFor(endpoint.body);
        const params = vi.fn(() => { throw new Error('Parameters must not be read'); });
        const context = { params: { then: params } };
        await expectJson(await endpoint.handler(request, context), 401, { error: 'Non autorise' });
        expect(params).not.toHaveBeenCalled();
        expect(request.json).not.toHaveBeenCalled();
        for (const mock of dataIo) expect(mock).not.toHaveBeenCalled();
    });
    it.each(endpoints)('rejects missing client parameters before data IO in $name', async endpoint => {
        await expectJson(await endpoint.handler(requestFor(endpoint.body), contextFor({ ...endpoint.params, clientId: '' })), 400);
        for (const mock of dataIo) expect(mock).not.toHaveBeenCalled();
    });
    it.each(postEndpoints)('rejects malformed JSON without data IO in $name', async endpoint => {
        const request = { json: vi.fn().mockRejectedValue(new Error('Malformed fixture JSON')) };
        await expectJson(await endpoint.handler(request, contextFor(endpoint.params)), 400, { error: 'JSON invalide' });
        for (const mock of dataIo) expect(mock).not.toHaveBeenCalled();
    });
    it.each(postEndpoints)('rejects invalid actions or statuses without data IO in $name', async endpoint => {
        await expectJson(await endpoint.handler(requestFor({ action: 'unknown', status: 'unknown' }), contextFor(endpoint.params)), 400);
        for (const mock of dataIo) expect(mock).not.toHaveBeenCalled();
    });
    it('rejects invalid continuous client UUID before reading the request body', async () => {
        const request = requestFor({ action: 'capture_snapshot' });
        await expectJson(await continuousPost(request, contextFor({ clientId: 'invalid' })), 400, { error: 'ID client invalide' });
        expect(request.json).not.toHaveBeenCalled();
        for (const mock of dataIo) expect(mock).not.toHaveBeenCalled();
    });
    it('does not mutate an opportunity absent from the requested client listing', async () => {
        io.opportunities.mockResolvedValue([{ id: 'other-opportunity' }]);
        await expectJson(await opportunityPost(requestFor({ status: 'done' }), contextFor({ clientId, opportunityId: 'opportunity-a' })), 404,
            { error: 'Opportunity introuvable pour ce client' });
        expect(io.opportunities).toHaveBeenCalledWith(clientId);
        for (const mock of mutations) expect(mock).not.toHaveBeenCalled();
    });
    it.each([
        { action: 'run_now', jobId },
        { action: 'toggle_job', jobId, is_active: false },
        { action: 'update_cadence', jobId, cadence_minutes: 15, retry_limit: 0 },
    ])('does not mutate a job absent from the client health slice for $action', async body => {
        io.health.mockResolvedValue({ jobs: [{ id: 'other-job' }] });
        await expectJson(await continuousPost(requestFor(body), contextFor({ clientId })), 500, { error: 'Erreur interne du serveur.' });
        expect(io.health).toHaveBeenCalledWith(clientId);
        for (const mock of mutations) expect(mock).not.toHaveBeenCalled();
    });
    it('preserves the client scope and an observed zero on successful opportunity update', async () => {
        await expectJson(await opportunityPost(requestFor({ status: 'done' }), contextFor({ clientId, opportunityId: 'opportunity-a' })), 200,
            { success: true, opportunity: { id: 'opportunity-a', status: 'done', priority_score: 0 } });
        expect(io.opportunities).toHaveBeenCalledWith(clientId);
        expect(io.updateOpportunity).toHaveBeenCalledWith('opportunity-a', { status: 'done' });
        expect(io.log).toHaveBeenCalledWith({ client_id: clientId, action_type: 'opportunity_status_updated', details: { opportunity_id: 'opportunity-a', status: 'done' }, performed_by: 'operator@example.test' });
    });
    it('preserves a successful zero deletion count with no-store', async () => {
        await expectJson(await clearPost(requestFor({ action: 'clear_errors' }), contextFor({ clientId })), 200, { success: true, action: 'clear_errors', deleted: 0 });
        expect(io.clearRuns).toHaveBeenCalledWith(clientId);
    });
    it('preserves the client and run scope and a zero in the inspector response', async () => {
        await expectJson(await inspectorGet(undefined, contextFor({ clientId, runId: 'run-a' })), 200, { run: { id: 'run-a', clicks: 0 } });
        expect(io.inspectRun).toHaveBeenCalledWith(clientId, 'run-a');
    });
    it.each(['rerun', 'reparse'])('preserves client/run/admin parameters on a successful $action with zero', async action => {
        const expectedResult = action === 'rerun' ? { count: 0 } : { mention_count: 0 };
        await expectJson(await runPost(requestFor({ action }), contextFor({ clientId, runId: 'run-a' })), 200, { success: true, action, result: expectedResult });
        expect(action === 'rerun' ? io.rerun : io.reparse).toHaveBeenCalledWith({ clientId, runId: 'run-a', performedBy: 'operator@example.test' });
    });
    it('preserves a mocked successful dispatch zero and manual dispatch options', async () => {
        await expectJson(await continuousPost(requestFor({ action: 'dispatch_tick' }), contextFor({ clientId })), 200, { success: true, result: { queued: 0 } });
        expect(io.tick).toHaveBeenCalledWith({ source: 'manual', maxJobsToQueue: 20 });
        expect(io.worker).not.toHaveBeenCalled();
        expect(io.log).toHaveBeenCalledWith({ client_id: clientId, action_type: 'continuous_operator_action', details: { action: 'dispatch_tick' }, performed_by: 'operator@example.test' });
    });
    it('preserves a scoped snapshot capture with zero', async () => {
        await expectJson(await continuousPost(requestFor({ action: 'capture_snapshot' }), contextFor({ clientId })), 200, { success: true, result: { visibility_score: 0 } });
        expect(io.snapshot).toHaveBeenCalledWith({ clientId, source: 'manual', metadata: { reason: 'operator_manual_capture', triggered_by: 'operator@example.test' } });
    });
});
