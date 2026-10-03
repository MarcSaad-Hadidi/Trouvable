import {
    insertRemediationSuggestion as insertRemediationSuggestionRow,
    listRemediationSuggestionsForClient as listRemediationSuggestionsRows,
} from '@/lib/db/remediation';

/**
 * @typedef {Object} RemediationSuggestion
 * @property {string} id
 * @property {string} client_id
 * @property {string} problem_type
 * @property {string} problem_source
 * @property {string} severity
 * @property {'draft' | 'approved' | 'applied' | 'discarded'} status
 * @property {string} prompt_system
 * @property {string} prompt_user
 * @property {string | null} ai_output
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Persists one remediation suggestion as review-only draft.
 * @param {{
 *  clientId: string,
 *  problem: import('./problem-types').Problem,
 *  prompt: import('./prompt-builder').RemediationPrompt,
 *  aiOutput: string | null,
 * }} input
 * @returns {Promise<RemediationSuggestion>}
 */
export async function insertRemediationSuggestion(input) {
    return insertRemediationSuggestionRow(input);
}

/**
 * Lists remediation suggestions for one client.
 * @param {string} clientId
 * @returns {Promise<RemediationSuggestion[]>}
 */
export async function listRemediationSuggestionsForClient(clientId) {
    return listRemediationSuggestionsRows(clientId);
}
