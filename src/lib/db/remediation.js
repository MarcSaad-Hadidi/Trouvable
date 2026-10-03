import 'server-only';

import { db } from '@/lib/db/core';

export async function insertRemediationSuggestion(input) {
    const payload = {
        client_id: input.clientId,
        problem_type: input.problem.type,
        problem_source: input.problem.source,
        severity: input.problem.severity,
        status: 'draft',
        prompt_system: input.prompt.system,
        prompt_user: input.prompt.user,
        ai_output: input.aiOutput,
    };

    const { data, error } = await db()
        .from('remediation_suggestions')
        .insert(payload)
        .select('*')
        .single();

    if (error) throw new Error(`[DB/remediation] insertRemediationSuggestion: ${error.message}`);
    return data;
}

export async function listRemediationSuggestionsForClient(clientId) {
    const { data, error } = await db()
        .from('remediation_suggestions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`[DB/remediation] listRemediationSuggestionsForClient: ${error.message}`);
    return data || [];
}
