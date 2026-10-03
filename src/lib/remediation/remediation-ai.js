import { callAiText } from '@/lib/ai/index';

const MISTRAL_REMEDIATION_TYPES = new Set([
    'missing_faq_for_intent',
    'weak_local_clarity',
    'schema_missing_or_incoherent',
    'visibility_declining',
    'llms_txt_missing',
    'ai_crawlers_blocked',
]);

export function isMistralRemediationType(problemType) {
    return MISTRAL_REMEDIATION_TYPES.has(problemType);
}

/**
 * Calls Mistral for remediation text generation using existing provider wrappers.
 * Returns null on failure so the caller can persist a draft suggestion without AI output.
 */
export async function callMistralForRemediation({ system, user, clientId, problemType }) {
    try {
        const response = await callAiText({
            providerOverride: 'mistral',
            fallbackProvider: null,
            purpose: 'query',
            temperature: 0.2,
            maxTokens: 1400,
            messages: [
                { role: 'system', content: system },
                {
                    role: 'user',
                    content: [
                        `[Remediation] client_id=${clientId}`,
                        `[Remediation] problem_type=${problemType}`,
                        user,
                    ].join('\n\n'),
                },
            ],
        });

        return {
            text: String(response?.text || '').trim() || null,
            provider: 'mistral',
            model: response?.model || null,
        };
    } catch (error) {
        console.error('[Remediation/Mistral] generation failed:', {
            clientId,
            problemType,
            error: error?.message || error,
        });
        return null;
    }
}
