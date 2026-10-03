import 'server-only';

export const COMPARE_PROVIDERS = ['gemini', 'groq', 'mistral', 'openrouter'];
export const SOURCE_TYPES = {
    URL: 'url',
    TEXT: 'text',
};

export class LlmComparisonError extends Error {
    constructor(errorClass, message, metadata = null) {
        super(message);
        this.name = 'LlmComparisonError';
        this.errorClass = errorClass || 'runtime_error';
        this.metadata = metadata;
    }
}

export class ProviderExecutionError extends Error {
    constructor(provider, model, latencyMs, cause) {
        super(cause?.message || `Provider ${provider} failed`);
        this.name = 'ProviderExecutionError';
        this.provider = provider;
        this.model = model || null;
        this.latencyMs = Number(latencyMs || 0);
        this.cause = cause;
    }
}

export function classifyProviderError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('timeout') || message.includes('aborted')) return 'timeout';
    if (message.includes('rate') || message.includes('429') || message.includes('too many requests')) return 'rate_limit';
    if (message.includes('api key') || message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
        return 'provider_auth_error';
    }
    return 'provider_error';
}

export function toStructuredError(error) {
    if (!error) return null;
    const rawMessage = String(error?.message || 'Unknown provider error');
    const sanitizedMessage = sanitizeErrorMessage(rawMessage);
    if (error instanceof LlmComparisonError) {
        return {
            class: error.errorClass,
            message: sanitizeErrorMessage(error.message),
        };
    }
    return {
        class: classifyProviderError(error),
        message: sanitizedMessage,
    };
}

function sanitizeErrorMessage(message = '') {
    let sanitized = String(message || '');
    sanitized = sanitized.replace(/bearer\s+[a-z0-9._\-]+/gi, 'Bearer [redacted]');
    const candidateSecrets = [
        process.env.GOOGLE_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GROQ_API_KEY,
        process.env.MISTRAL_API_KEY,
        process.env.OPENROUTER_API_KEY,
    ].filter(Boolean);
    for (const secret of candidateSecrets) {
        sanitized = sanitized.replaceAll(secret, '[redacted]');
    }
    return sanitized;
}

export function buildProviderSuccessResult({ provider, model, latencyMs, usage, content }) {
    return {
        provider,
        model,
        ok: true,
        status: 'success',
        latency_ms: latencyMs,
        usage: usage || null,
        content: content || '',
        error: null,
    };
}

export function buildProviderErrorResult({ provider, model, latencyMs, error }) {
    return {
        provider,
        model,
        ok: false,
        status: 'error',
        latency_ms: latencyMs,
        usage: null,
        content: null,
        error: toStructuredError(error),
    };
}
