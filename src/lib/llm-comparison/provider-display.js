/**
 * Provider / model display normalisation for GEO Compare surfaces.
 *
 * Raw provider keys ('gemini', 'groq', …) are technical identifiers.
 * This module maps them to premium-grade, operator-readable labels
 * while keeping enough technical detail for confident identification.
 *
 * The model-level normaliser collapses noisy versioned slugs (e.g.
 * 'mistral-small-2603') into short, scannable names.
 */

const PROVIDER_META = {
    gemini: {
        label: 'Gemini',
        short: 'Gemini',
        initials: 'Ge',
        color: 'bg-blue-500/25',
        accent: 'text-blue-300',
    },
    groq: {
        label: 'Groq',
        short: 'Groq',
        initials: 'Gq',
        color: 'bg-orange-500/25',
        accent: 'text-orange-300',
    },
    mistral: {
        label: 'Mistral',
        short: 'Mistral',
        initials: 'Mi',
        color: 'bg-amber-500/25',
        accent: 'text-amber-300',
    },
    openrouter: {
        label: 'OpenRouter',
        short: 'OR',
        initials: 'OR',
        color: 'bg-violet-500/25',
        accent: 'text-violet-300',
    },
};

const FALLBACK_META = {
    label: null,
    short: null,
    initials: '??',
    color: 'bg-white/10',
    accent: 'text-white/60',
};

/**
 * Return display metadata for a raw provider key.
 * @param {string} rawProvider  e.g. 'gemini', 'openrouter'
 */
export function getProviderMeta(rawProvider) {
    const key = String(rawProvider || '').toLowerCase();
    return PROVIDER_META[key] || { ...FALLBACK_META, label: rawProvider, short: rawProvider };
}

/**
 * Collapse verbose model slugs into short, readable names.
 *
 *   'gemini-2.5-flash'         → 'Gemini 2.5 Flash'
 *   'llama-3.3-70b-versatile'  → 'Llama 3.3 70B'
 *   'mistral-small-2603'       → 'Mistral Small'
 *   'openai/gpt-4o-mini'       → 'GPT-4o Mini'
 */
export function normalizeModelLabel(model) {
    if (!model) return 'n.d.';
    let m = String(model).trim();

    // Strip org prefix from OpenRouter-style 'openai/gpt-4o-mini'
    if (m.includes('/')) {
        const last = m.split('/').pop();
        if (last) m = last;
    }

    // Drop trailing date-version suffixes like -2603, -2501, -2402
    m = m.replace(/-\d{4}$/, '');
    // Drop '-versatile', '-preview', '-latest' noise
    m = m.replace(/-(versatile|preview|latest)$/i, '');

    // Humanise separators
    m = m
        .replace(/-/g, ' ')
        .replace(/\b(\d+)b\b/i, (_, n) => `${n}B`)  // 70b → 70B
        .replace(/\bgpt\b/i, 'GPT')
        .replace(/\bllama\b/i, 'Llama')
        .replace(/\bgemini\b/i, 'Gemini')
        .replace(/\bmistral\b/i, 'Mistral')
        .replace(/\bflash\b/i, 'Flash')
        .replace(/\bmini\b/i, 'Mini')
        .replace(/\bsmall\b/i, 'Small')
        .replace(/\bmedium\b/i, 'Medium')
        .replace(/\blarge\b/i, 'Large');

    return m.trim() || model;
}

/** Signal-tier label for operator reading. */
export function signalTierLabel(tier) {
    switch (tier) {
        case 'useful': return 'Exploitable';
        case 'weak': return 'Faible';
        case 'low_yield': return 'Peu exploitable';
        case 'failed': return 'Échec';
        default: return tier || 'n.d.';
    }
}
