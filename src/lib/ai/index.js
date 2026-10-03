import 'server-only';

import { callGemini } from './providers/gemini.js';
import { callGroq } from './providers/groq.js';
import { callMistral } from './providers/mistral.js';
import { callOpenRouter } from './providers/openrouter.js';

const PROVIDERS = {
    groq: callGroq,
    gemini: callGemini,
    mistral: callMistral,
    openrouter: callOpenRouter,
};

function getProvider(name) {
    const fn = PROVIDERS[name];
    if (!fn) throw new Error(`[AI] Provider inconnu: "${name}"`);
    return fn;
}

function getPrimary() {
    return process.env.AI_PRIMARY_PROVIDER || 'groq';
}

function getFallback() {
    return process.env.AI_FALLBACK_PROVIDER || 'gemini';
}

export async function callAiText({
    messages,
    purpose = 'audit',
    temperature = 0.2,
    maxTokens = 4096,
    providerOverride = null,
    fallbackProvider = undefined,
    modelOverride = null,
}) {
    const primary = providerOverride || getPrimary();
    const fallback = fallbackProvider === undefined ? getFallback() : fallbackProvider;

    try {
        const result = await getProvider(primary)({
            messages,
            purpose,
            jsonMode: false,
            temperature,
            maxTokens,
            modelOverride,
        });
        return {
            ...result,
            provider: primary,
            model: result.model || modelOverride || null,
        };
    } catch (primaryErr) {
        if (!fallback) {
            throw primaryErr;
        }

        console.warn(`[AI] ${primary} echoue: ${primaryErr.message}. Fallback -> ${fallback}`);
        try {
            const result = await getProvider(fallback)({
                messages,
                purpose,
                jsonMode: false,
                temperature,
                maxTokens,
            });
            return {
                ...result,
                provider: fallback,
                model: result.model || null,
            };
        } catch (fallbackErr) {
            throw new Error(
                `[AI] Tous les providers ont echoue. Primary(${primary}): ${primaryErr.message} | Fallback(${fallback}): ${fallbackErr.message}`
            );
        }
    }
}

export async function callAiJson({
    messages,
    purpose = 'audit',
    temperature = 0.1,
    maxTokens = 4096,
    providerOverride = null,
    fallbackProvider = undefined,
    modelOverride = null,
}) {
    const primary = providerOverride || getPrimary();
    const fallback = fallbackProvider === undefined ? getFallback() : fallbackProvider;

    async function tryProvider(name) {
        const result = await getProvider(name)({
            messages,
            purpose,
            jsonMode: true,
            temperature,
            maxTokens,
            modelOverride,
        });
        const parsed = parseJsonResponse(result.text);
        return {
            data: parsed,
            usage: result.usage,
            provider: name,
            model: result.model || null,
        };
    }

    try {
        return await tryProvider(primary);
    } catch (primaryErr) {
        if (!fallback) {
            throw primaryErr;
        }

        console.warn(`[AI] ${primary} JSON echoue: ${primaryErr.message}. Fallback -> ${fallback}`);
        try {
            return await tryProvider(fallback);
        } catch (fallbackErr) {
            throw new Error(
                `[AI] JSON: tous echoues. Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`
            );
        }
    }
}

export async function callAiWithFallback(params) {
    if (params.jsonMode) return callAiJson(params);
    return callAiText(params);
}

function parseJsonResponse(text) {
    if (!text || !text.trim()) {
        throw new Error('[AI] Reponse vide, impossible de parser en JSON');
    }

    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx > startIdx) {
            try {
                return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
            } catch {
                // fall through
            }
        }

        const arrStart = cleaned.indexOf('[');
        const arrEnd = cleaned.lastIndexOf(']');
        if (arrStart !== -1 && arrEnd > arrStart) {
            try {
                return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
            } catch {
                // fall through
            }
        }

        throw new Error(`[AI] JSON invalide: ${cleaned.slice(0, 200)}...`);
    }
}
