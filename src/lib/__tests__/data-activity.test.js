import { beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ audits: vi.fn(), actions: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/audits', () => ({ getRecentAudits: io.audits }));
vi.mock('@/lib/db/actions', () => ({ getActions: io.actions }));
import { getRecentSafeActivity } from '../operator-intelligence/activity';

const copies = [
    ['geo_queries_run', 'Cycle de prompts terminé', '0/0 prompts suivis exécutés'],
    ['geo_query_run_single', 'Exécution unitaire terminée', 'Prompt exécuté avec erreurs.'],
    ['geo_query_run_rerun', "Relance d'exécution", "Une exécution existante a été relancée depuis l'inspecteur."],
    ['geo_query_reparse', 'Reparse effectué', 'Le pipeline extraction/citations/concurrents a été réappliqué sur une exécution stockée.'],
    ['geo_queries_benchmark_run', 'Benchmark sandbox exécuté', 'Comparaison multi-variantes terminée en mode sandbox gratuit.'],
    ['tracked_query_created', 'Prompt suivi ajouté', 'Un nouveau prompt suivi a été ajouté.'],
    ['tracked_query_updated', 'Prompt suivi mis à jour', 'Le texte ou la classification du prompt a été mis à jour.'],
    ['tracked_query_toggled', 'Statut prompt modifié', 'Prompt mis en pause.'],
    ['tracked_query_deleted', 'Prompt suivi supprimé', 'Un prompt suivi a été retire de ce client.'],
    ['publication_state_changed', 'Profil public mis à jour', 'Le profil public repasse en brouillon.'],
    ['client_onboarding_started', 'Onboarding démarré', 'Intake capture puis enrichissement automatique lancé.'],
    ['client_onboarding_activated', 'Onboarding activé', 'Le profil brouillon a été finalise avec revue opérateur.'],
];
beforeEach(() => {
    io.audits.mockReset().mockResolvedValue([]);
    io.actions.mockReset().mockResolvedValue([]);
});

describe('safe activity projection', () => {
    it.each(copies)('preserves the copy and observed envelope for %s', async (type, title, description) => {
        io.actions.mockResolvedValue([{ id: 'a', action_type: type, created_at: '2026-10-01' }]);
        const data = await getRecentSafeActivity('client-a');
        expect(data.items).toEqual([{ id: 'action-a', type, title, description, created_at: '2026-10-01', provenance: data.provenance }]);
        expect(data.items[0].provenance.key).toBe('observed');
        expect(io.actions).toHaveBeenCalledWith('client-a', copies.map(([key]) => key), 8);
    });

    it.each([
        ['geo_queries_run', { successful: '2', total_queries: '3' }, '2/3 prompts suivis exécutés'],
        ['geo_query_run_single', { successful: '1' }, 'Prompt exécuté avec succès.'],
        ['tracked_query_toggled', { is_active: true }, 'Prompt réactivé.'],
        ['publication_state_changed', { is_published: true }, 'Le profil public est publié.'],
    ])('preserves conditional details for %s', async (type, details, description) => {
        io.actions.mockResolvedValue([{ id: 'a', action_type: type, details }]);
        expect((await getRecentSafeActivity('client-a')).items[0].description).toBe(description);
    });

    it('omits unknown actions and unfinished audits while preserving zero scores, ordering and limit', async () => {
        io.actions.mockResolvedValue([
            { id: 'unknown', action_type: 'constructor', created_at: '2026-10-04' },
            { id: 'a', action_type: 'tracked_query_created', created_at: '2026-10-01' },
        ]);
        io.audits.mockResolvedValue([
            { id: 'running', scan_status: 'running', created_at: '2026-10-05' },
            { id: 'audit', scan_status: 'partial_error', seo_score: 0, geo_score: null, created_at: '2026-10-02' },
        ]);
        const data = await getRecentSafeActivity('client-a', 1);
        expect(data.items).toHaveLength(1);
        expect(data.items[0]).toMatchObject({ id: 'audit-audit', description: 'SEO 0 · GEO -' });
        expect(io.audits).toHaveBeenCalledWith('client-a', 1);
    });

    it('keeps successful actions when audits fail and sanitizes source failures', async () => {
        io.audits.mockRejectedValue(new Error('private SQL'));
        io.actions.mockResolvedValue([{ id: 'a', action_type: 'tracked_query_created' }]);
        const data = await getRecentSafeActivity('client-a');
        expect(data).toMatchObject({ status: 'partial', dataSources: { audits: 'unavailable', actions: 'available' } });
        expect(data.items[0].id).toBe('action-a');
        expect(JSON.stringify(data)).not.toContain('private SQL');
    });
});
