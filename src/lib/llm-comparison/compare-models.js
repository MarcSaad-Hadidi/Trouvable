import 'server-only';

import { runGeminiCompare, getGeminiCompareModel } from './adapters/gemini';
import { runGroqCompare, getGroqCompareModel } from './adapters/groq';
import { runMistralCompare, getMistralCompareModel } from './adapters/mistral';
import { runOpenRouterCompare, getOpenRouterCompareModel } from './adapters/openrouter';
import { extractInputContent } from './extract-content';
import { buildGoogleGroundingContext } from './google-grounding';
import {
    buildProviderErrorResult,
    buildProviderSuccessResult,
    COMPARE_PROVIDERS,
    LlmComparisonError,
    ProviderExecutionError,
} from './response-contract';

const DEFAULT_TIMEOUT_MS = 30_000;

const PROVIDER_ADAPTERS = {
    gemini: {
        run: runGeminiCompare,
        getModel: getGeminiCompareModel,
    },
    groq: {
        run: runGroqCompare,
        getModel: getGroqCompareModel,
    },
    mistral: {
        run: runMistralCompare,
        getModel: getMistralCompareModel,
    },
    openrouter: {
        run: runOpenRouterCompare,
        getModel: getOpenRouterCompareModel,
    },
};

function withTimeout(taskPromise, timeoutMs, provider) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new LlmComparisonError('timeout', `Timeout ${provider} apres ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([taskPromise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function executeProvider({ provider, prompt, content, timeoutMs }) {
    const adapter = PROVIDER_ADAPTERS[provider];
    if (!adapter) {
        throw new LlmComparisonError('runtime_error', `Provider compare inconnu: ${provider}`);
    }
    const start = Date.now();
    try {
        const output = await withTimeout(adapter.run({ prompt, content }), timeoutMs, provider);
        const latencyMs = Date.now() - start;
        return { output, latencyMs };
    } catch (error) {
        const latencyMs = Date.now() - start;
        throw new ProviderExecutionError(provider, adapter.getModel(), latencyMs, error);
    }
}

export async function compareModels({
    url = null,
    text = null,
    sourceType = null,
    prompt,
    providerTimeoutMs = DEFAULT_TIMEOUT_MS,
    maxContentChars = 16_000,
    enableGoogleGrounding = true,
}) {
    if (!String(prompt || '').trim()) {
        throw new LlmComparisonError('input_error', 'Le champ `prompt` est requis.');
    }

    const extractedInput = await extractInputContent({
        url,
        text,
        sourceType,
        maxContentChars,
    });

    const grounding = await buildGoogleGroundingContext({
        prompt,
        sourceUrl: extractedInput.url,
        enabled: enableGoogleGrounding,
    });

    const groundedContent = grounding?.text
        ? `${extractedInput.content}\n\n---\nContexte web externe (Google/Tavily):\n${grounding.text}`
        : extractedInput.content;

    const settled = await Promise.allSettled(
        COMPARE_PROVIDERS.map((provider) =>
            executeProvider({
                provider,
                prompt,
                content: groundedContent,
                timeoutMs: providerTimeoutMs,
            })
        )
    );

    const results = settled.map((entry, index) => {
        if (entry.status === 'fulfilled') {
            const provider = COMPARE_PROVIDERS[index];
            const adapter = PROVIDER_ADAPTERS[provider];
            return buildProviderSuccessResult({
                provider,
                model: entry.value.output.model || adapter.getModel(),
                latencyMs: entry.value.latencyMs,
                usage: entry.value.output.usage || null,
                content: entry.value.output.content || '',
            });
        }
        const reason = entry.reason;
        if (reason instanceof ProviderExecutionError) {
            return buildProviderErrorResult({
                provider: reason.provider,
                model: reason.model,
                latencyMs: reason.latencyMs,
                error: reason.cause || reason,
            });
        }
        const provider = COMPARE_PROVIDERS[index];
        const adapter = PROVIDER_ADAPTERS[provider];
        return buildProviderErrorResult({
            provider,
            model: adapter.getModel(),
            latencyMs: 0,
            error: reason,
        });
    });

    return {
        contract_version: 'v1',
        input: {
            source_type: extractedInput.source_type,
            url: extractedInput.url,
            prompt: String(prompt || '').trim(),
            content_preview: extractedInput.content_preview,
        },
        grounding: {
            enabled: Boolean(enableGoogleGrounding),
            used_provider: grounding?.used_provider || null,
            results_count: grounding?.items?.length || 0,
            error: grounding?.error || null,
        },
        results,
    };
}
