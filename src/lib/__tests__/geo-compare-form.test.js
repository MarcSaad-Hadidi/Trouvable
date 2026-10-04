import { describe, expect, it } from 'vitest';

import {
    applyPromptMode,
    applyTrackedPromptSelection,
    buildClientPromptPrefill,
    defaultGeoCompareForm,
} from '@/lib/llm-comparison/geo-compare-form';

describe('geo compare form helpers', () => {
    it('keeps URL as default source in client-linked mode', () => {
        const form = defaultGeoCompareForm({ clientLinked: true, defaultUrl: 'https://example.com' });
        expect(form.source_type).toBe('url');
        expect(form.prompt_mode).toBe('tracked');
        expect(form.url).toBe('https://example.com');
    });

    it('defaults to free prompt mode in global mode', () => {
        const form = defaultGeoCompareForm({ clientLinked: false });
        expect(form.prompt_mode).toBe('free');
        expect(form.source_type).toBe('url');
    });

    it('switches prompt mode to free and clears tracked prompt id', () => {
        const form = {
            ...defaultGeoCompareForm({ clientLinked: true }),
            tracked_query_id: 'abc',
            prompt_mode: 'tracked',
        };
        const next = applyPromptMode(form, 'free');
        expect(next.prompt_mode).toBe('free');
        expect(next.tracked_query_id).toBe('');
    });

    it('selecting tracked prompt fills active prompt content', () => {
        const form = defaultGeoCompareForm({ clientLinked: true });
        const next = applyTrackedPromptSelection(form, { id: 'q1', query_text: 'Prompt suivi' });
        expect(next.prompt_mode).toBe('tracked');
        expect(next.tracked_query_id).toBe('q1');
        expect(next.prompt).toBe('Prompt suivi');
    });

    it('builds richer prompt prefill from client context', () => {
        const prefill = buildClientPromptPrefill({
            clientName: 'Trouvable',
            domain: 'trouvable.com',
            competitors: ['A', 'B'],
        });
        expect(prefill).toContain('Calibration GEO');
        expect(prefill).toContain('Trouvable');
        expect(prefill).toContain('Cible principale');
        expect(prefill).toContain('Concurrents connus');
    });

    it('keeps tracked prompt text when available', () => {
        const prefill = buildClientPromptPrefill({
            clientName: 'Trouvable',
            trackedPromptText: 'prompt deja suivi',
        });
        expect(prefill).toBe('prompt deja suivi');
    });
});
