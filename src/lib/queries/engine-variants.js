import 'server-only';

import { callAiText } from '@/lib/ai/index';

export const ENGINE_VARIANTS = {
    tavily_orchestrated: {
        id: 'tavily_orchestrated',
        label: 'Tavily (Web orchestre)',
        mode: 'sandbox',
        description: 'Mode orchestration web: recupere de veritables resultats via Tavily.',
        provider: 'orchestrated',
        model: 'composite-free',
        is_available: () => !!process.env.TAVILY_API_KEY,
        web_enabled: true
    },
    groq_compound_mini: {
        id: 'groq_compound_mini',
        label: 'Groq compound (Web natif)',
        mode: 'sandbox',
        description: 'Variante web native LLama (si supportee) basee sur Groq pour reponse rapide.',
        provider: 'groq',
        model: process.env.GROQ_MODEL_BENCHMARK_COMPOUND_MINI || 'llama-3.3-70b-versatile',
        is_available: () => !!process.env.GROQ_API_KEY,
        web_enabled: true
    },
    gemini_free_non_grounded: {
        id: 'gemini_free_non_grounded',
        label: 'Gemini (Sans grounding natif)',
        mode: 'sandbox',
        description: 'Variante Gemini gratuite non-grounded pour comparaison interne de signaux SEO.',
        provider: 'gemini',
        model: process.env.GEMINI_MODEL_BENCHMARK_FREE || 'gemini-2.5-flash',
        is_available: () => !!process.env.GEMINI_API_KEY,
        web_enabled: false
    },
    mistral_small_non_grounded: {
        id: 'mistral_small_non_grounded',
        label: 'Mistral (Sans grounding natif)',
        mode: 'sandbox',
        description: 'Variante Mistral sandbox pour comparaison interne des signaux de reponse.',
        provider: 'mistral',
        model: process.env.MISTRAL_MODEL_BENCHMARK_COMPARE || process.env.MISTRAL_MODEL_COMPARE || 'mistral-small-2603',
        is_available: () => !!process.env.MISTRAL_API_KEY,
        web_enabled: false
    },
    mistral_geo_default: {
        id: 'mistral_geo_default',
        label: 'Mistral GEO (FR local)',
        mode: 'production_candidate',
        // Variante GEO optimisee pour Mistral (francais, requetes locales, extractions)
        description: 'Variante Mistral orientee GEO local pour la generation et l analyse de reponses.',
        provider: 'mistral',
        model: process.env.MISTRAL_MODEL_QUERY || process.env.MISTRAL_MODEL_COMPARE || 'mistral-small-2603',
        temperature: 0.15,
        max_tokens: 2300,
        is_available: () => !!process.env.MISTRAL_API_KEY,
        web_enabled: false
    },
    openrouter_non_grounded: {
        id: 'openrouter_non_grounded',
        label: 'OpenRouter (Sans grounding natif)',
        mode: 'sandbox',
        description: 'Variante OpenRouter non-grounded pour comparaison inter-provider.',
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL_BENCHMARK || process.env.OPENROUTER_MODEL_QUERY || 'openai/gpt-4o-mini',
        is_available: () => !!process.env.OPENROUTER_API_KEY,
        web_enabled: false
    },
};

function estimateCostUsd({ provider, usage }) {
    const promptTokens = Number(usage?.prompt_tokens || 0);
    const completionTokens = Number(usage?.completion_tokens || 0);

    if (provider === 'groq') {
        const total = (promptTokens + completionTokens) / 1_000_000;
        return Number((total * 0.27).toFixed(6));
    }
    if (provider === 'gemini') {
        const total = (promptTokens + completionTokens) / 1_000_000;
        return Number((total * 0.2).toFixed(6));
    }
    if (provider === 'mistral') {
        const total = (promptTokens + completionTokens) / 1_000_000;
        return Number((total * 0.6).toFixed(6));
    }
    if (provider === 'openrouter') {
        const total = (promptTokens + completionTokens) / 1_000_000;
        return Number((total * 0.5).toFixed(6));
    }
    return 0;
}

function isVariantEnabled() {
    const raw = String(process.env.BENCHMARK_ENABLE_FREE_SANDBOX ?? '1').trim().toLowerCase();
    return !['0', 'false', 'off', 'no'].includes(raw);
}

function resolveVariants(requestedVariants = []) {
    const values = Array.isArray(requestedVariants) && requestedVariants.length > 0
        ? requestedVariants
        : Object.keys(ENGINE_VARIANTS);

    return values.filter((variant) => ENGINE_VARIANTS[variant]);
}

export async function runBenchmarkVariant({
    variant,
    messages,
    purpose = 'query',
    maxTokens = 2048,
}) {
    const variantMeta = ENGINE_VARIANTS[variant];
    if (!variantMeta) {
        return {
            ok: false,
            variant,
            error_class: 'unknown_variant',
            error_message: `Variante benchmark inconnue: ${variant}`,
        };
    }

    if (!isVariantEnabled()) {
        return {
            ok: false,
            variant,
            error_class: 'benchmark_disabled',
            error_message: 'Le sandbox benchmark est desactive par configuration.',
            provider: variantMeta.provider,
            model: variantMeta.model,
        };
    }

    if (variantMeta.is_available && typeof variantMeta.is_available === 'function' && !variantMeta.is_available()) {
        return {
            ok: false,
            variant,
            error_class: 'variant_unavailable',
            error_message: `Cette variante est temporairement non disponible (cle API manquante ou invalide).`,
            provider: variantMeta.provider,
            model: variantMeta.model,
        };
    }

    try {
        if (variant === 'tavily_orchestrated') {
            const response = await callAiText({
                messages,
                purpose,
                maxTokens,
                temperature: 0.2,
            });
            return {
                ok: true,
                variant,
                provider: response.provider,
                model: response.model || variantMeta.model,
                text: response.text,
                usage: response.usage || {},
                cost_estimate_usd: estimateCostUsd({ provider: response.provider, usage: response.usage || {} }),
                sandbox_caveat: 'Variante sandbox orchestratee (pas une integration native Tavily en production).',
            };
        }

        if (variant === 'groq_compound_mini') {
            const response = await callAiText({
                messages,
                purpose,
                maxTokens,
                temperature: 0.2,
                providerOverride: 'groq',
                fallbackProvider: null,
                modelOverride: variantMeta.model,
            });
            return {
                ok: true,
                variant,
                provider: response.provider,
                model: response.model || variantMeta.model,
                text: response.text,
                usage: response.usage || {},
                cost_estimate_usd: estimateCostUsd({ provider: 'groq', usage: response.usage || {} }),
            };
        }

        if (variant === 'gemini_free_non_grounded') {
            const response = await callAiText({
                messages,
                purpose,
                maxTokens,
                temperature: 0.2,
                providerOverride: 'gemini',
                fallbackProvider: null,
                modelOverride: variantMeta.model,
            });
            return {
                ok: true,
                variant,
                provider: response.provider,
                model: response.model || variantMeta.model,
                text: response.text,
                usage: response.usage || {},
                cost_estimate_usd: estimateCostUsd({ provider: 'gemini', usage: response.usage || {} }),
                sandbox_caveat: 'Variante gratuite non-grounded, utile pour comparaison de signal interne uniquement.',
            };
        }

        if (variant === 'mistral_small_non_grounded') {
            const response = await callAiText({
                messages,
                purpose,
                maxTokens,
                temperature: 0.2,
                providerOverride: 'mistral',
                fallbackProvider: null,
                modelOverride: variantMeta.model,
            });
            return {
                ok: true,
                variant,
                provider: response.provider,
                model: response.model || variantMeta.model,
                text: response.text,
                usage: response.usage || {},
                cost_estimate_usd: estimateCostUsd({ provider: 'mistral', usage: response.usage || {} }),
                sandbox_caveat: 'Variante Mistral non-grounded pour comparaison operator interne.',
            };
        }

        if (variant === 'mistral_geo_default') {
            const response = await callAiText({
                messages,
                purpose,
                maxTokens: Number(variantMeta.max_tokens || maxTokens || 2300),
                temperature: Number(variantMeta.temperature ?? 0.15),
                providerOverride: 'mistral',
                fallbackProvider: null,
                modelOverride: variantMeta.model,
            });
            return {
                ok: true,
                variant,
                provider: response.provider,
                model: response.model || variantMeta.model,
                text: response.text,
                usage: response.usage || {},
                cost_estimate_usd: estimateCostUsd({ provider: 'mistral', usage: response.usage || {} }),
                sandbox_caveat: null,
            };
        }

        if (variant === 'openrouter_non_grounded') {
            const response = await callAiText({
                messages,
                purpose,
                maxTokens,
                temperature: 0.2,
                providerOverride: 'openrouter',
                fallbackProvider: null,
                modelOverride: variantMeta.model,
            });
            return {
                ok: true,
                variant,
                provider: response.provider,
                model: response.model || variantMeta.model,
                text: response.text,
                usage: response.usage || {},
                cost_estimate_usd: estimateCostUsd({ provider: 'openrouter', usage: response.usage || {} }),
                sandbox_caveat: 'Variante OpenRouter non-grounded pour calibration provider.',
            };
        }

        return {
            ok: false,
            variant,
            error_class: 'not_implemented',
            error_message: `Variante ${variant} non implemantee.`,
            provider: variantMeta.provider,
            model: variantMeta.model,
        };
    } catch (error) {
        return {
            ok: false,
            variant,
            error_class: 'provider_error',
            error_message: error?.message || 'Execution benchmark impossible',
            provider: variantMeta.provider,
            model: variantMeta.model,
        };
    }
}

export function listBenchmarkVariants(requestedVariants = []) {
    return resolveVariants(requestedVariants).map((key) => {
        const v = ENGINE_VARIANTS[key];
        return {
            ...v,
            is_available: typeof v.is_available === 'function' ? v.is_available() : true
        };
    });
}

export function resolveRequestedBenchmarkVariants(requestedVariants = []) {
    return resolveVariants(requestedVariants);
}
