export function defaultGeoCompareForm({ clientLinked = false, defaultUrl = '' } = {}) {
    return {
        client_id: '',
        source_type: 'url',
        prompt_mode: clientLinked ? 'tracked' : 'free',
        prompt: '',
        tracked_query_id: '',
        url: defaultUrl || '',
        text: '',
        provider_timeout_ms: 30000,
        advanced_text_open: false,
    };
}

export function buildClientPromptPrefill({ clientName, domain, competitors = [], trackedPromptText = '' }) {
    const competitorPreview = competitors.filter(Boolean).slice(0, 3).join(', ');
    const contextLine = competitorPreview
        ? `Concurrents connus: ${competitorPreview}.`
        : 'Concurrents connus: non renseignés.';

    if (trackedPromptText) return trackedPromptText;
    return [
        `Calibration GEO pour ${clientName || 'ce client'}: compare la qualité de réponse entre providers.`,
        domain ? `Cible principale: ${domain}.` : 'Cible principale: non fournie.',
        contextLine,
        'Retour attendu: mention de la marque, acteurs concurrents, citations URL, points faibles du prompt.',
    ].join(' ');
}

export function applyTrackedPromptSelection(form, trackedPrompt) {
    if (!trackedPrompt) return form;
    return {
        ...form,
        prompt_mode: 'tracked',
        tracked_query_id: trackedPrompt.id,
        prompt: trackedPrompt.query_text || '',
    };
}

export function applyPromptMode(form, mode) {
    if (mode === 'free') {
        return {
            ...form,
            prompt_mode: 'free',
            tracked_query_id: '',
        };
    }
    return {
        ...form,
        prompt_mode: 'tracked',
    };
}
