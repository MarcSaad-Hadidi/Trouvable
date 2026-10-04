import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackedQueryUpdateSchema } from '@/lib/admin-schemas';

const fixture = vi.hoisted(() => ({ slots: [], cursor: 0, invalidate: vi.fn(), fetch: vi.fn() }));
vi.mock('react', async (importOriginal) => ({
    ...(await importOriginal()),
    useState: (initial) => {
        const slot = fixture.cursor++;
        if (!Object.hasOwn(fixture.slots, slot)) fixture.slots[slot] = initial;
        return [
            fixture.slots[slot],
            (next) => {
                fixture.slots[slot] = typeof next === 'function' ? next(fixture.slots[slot]) : next;
            },
        ];
    },
}));
const prompt = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    query_text: 'Quel artisan choisir ?',
    prompt_metadata: { prompt_mode: 'operator_probe' },
    is_active: true,
    discovery_mode: null,
    quality_status: null,
    quality_score: null,
    validation_status: null,
    lifecycle: { has_run: null },
};
vi.mock('@/features/admin/shared/context/ClientContext', () => ({
    useGeoClient: () => ({ clientId: 'fixture', client: null, invalidateWorkspace: fixture.invalidate }),
    useGeoWorkspaceSlice: () => ({
        loading: false,
        error: null,
        data: {
            status: 'partial',
            errors: [],
            prompts: [prompt],
            summary: {},
            categoryOptions: [],
            discoveryModeOptions: [],
        },
    }),
}));
import GeoPromptsView from '@/features/admin/geo/GeoPromptsView';

function walk(node, predicate) {
    if (Array.isArray(node)) return node.flatMap((child) => walk(child, predicate));
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function render() {
    fixture.cursor = 0;
    return GeoPromptsView();
}
function getRow(root = render()) {
    return walk(root, (node) => node.type?.name === 'TrackedPromptRow')[0];
}
function beginEdit() {
    const row = getRow();
    const tree = row.type(row.props);
    const edit = walk(tree, (node) => node.type === 'button' && node.props.title === 'Modifier le prompt')[0];
    expect(edit).toBeDefined();
    edit.props.onClick();
    const editing = getRow();
    editing.props.setEditingForm((form) => ({ ...form, query_text: 'Quel artisan local contacter ?' }));
    return getRow();
}

beforeEach(() => {
    fixture.slots = [];
    fixture.cursor = 0;
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fixture.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('partial prompt editing through the actual component handlers', () => {
    it('sends only editable fields and a payload accepted by the real update schema', async () => {
        fixture.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
        const editing = beginEdit();
        await editing.props.onSave(prompt.id);
        const [url, options] = fixture.fetch.mock.calls[0];
        expect(url).toBe('/api/admin/queries/update');
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body);
        expect(trackedQueryUpdateSchema.safeParse(body).success).toBe(true);
        expect(body).toEqual({
            id: prompt.id,
            query_text: 'Quel artisan local contacter ?',
            prompt_mode: 'operator_probe',
        });
        expect(fixture.invalidate).toHaveBeenCalledOnce();
        expect(getRow().props.isEditing).toBe(false);
    });
    it.each([400, 500])('preserves the edit and surfaces a safe HTTP %s failure', async (status) => {
        fixture.fetch.mockResolvedValue(
            new Response(JSON.stringify({ error: 'Sauvegarde indisponible.' }), { status }),
        );
        await beginEdit().props.onSave(prompt.id);
        expect(getRow().props.isEditing).toBe(true);
        expect(getRow().props.editingForm.query_text).toBe('Quel artisan local contacter ?');
        expect(fixture.invalidate).not.toHaveBeenCalled();
        expect(walk(render(), (node) => node.props?.role === 'alert').map((node) => node.props.children)).toContain(
            'Sauvegarde indisponible.',
        );
    });
    it('keeps network failure visible and allows a later retry', async () => {
        fixture.fetch.mockRejectedValueOnce(new Error('Réseau indisponible.'));
        await beginEdit().props.onSave(prompt.id);
        expect(getRow().props.isEditing).toBe(true);
        expect(fixture.invalidate).not.toHaveBeenCalled();
        expect(walk(render(), (node) => node.props?.role === 'alert').map((node) => node.props.children)).toContain(
            'Réseau indisponible.',
        );
        fixture.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
        await getRow().props.onSave(prompt.id);
        expect(getRow().props.isEditing).toBe(false);
        expect(walk(render(), (node) => node.props?.role === 'alert')).toHaveLength(0);
        expect(fixture.invalidate).toHaveBeenCalledOnce();
    });
    it('keeps an AI suggestion when the same update endpoint refuses to save', async () => {
        const row = getRow();
        // Seed through the exposed improvement callback's state using a real mocked response.
        fixture.fetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ suggestion: 'Suggestion locale.' }), { status: 200 }),
        );
        await row.props.onImprove(prompt);
        fixture.fetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'Sauvegarde indisponible.' }), { status: 500 }),
        );
        await getRow().props.onUseImproved(prompt.id, 'Suggestion locale.');
        expect(getRow().props.improvedText).toBe('Suggestion locale.');
        expect(fixture.invalidate).not.toHaveBeenCalled();
        expect(walk(render(), (node) => node.props?.role === 'alert').map((node) => node.props.children)).toContain(
            'Sauvegarde indisponible.',
        );
    });
});
