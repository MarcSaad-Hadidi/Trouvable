import 'server-only';

import { getBusinessShortDescription } from '@/lib/client-profile';
import { getTrendSlice } from '@/lib/continuous/jobs';
import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getRecentQueryRuns as dbGetRecentQueryRuns } from '@/lib/db/query-runs';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { problemsFromAuditResult, problemsFromGeoRun, problemsFromGeoRuns, problemsFromJobRun, problemsFromTrendSlice } from '@/lib/remediation/problem-mapper';
import { createProblem } from '@/lib/remediation/problem-types';
import { buildRemediationPrompt } from '@/lib/remediation/prompt-builder';
import { callMistralForRemediation, isMistralRemediationType } from '@/lib/remediation/remediation-ai';
import { insertRemediationSuggestion, listRemediationSuggestionsForClient } from '@/lib/remediation/remediation-store';

const PROBLEM_ID_MARKER = 'Problem-ID:';
const MAX_SUGGESTIONS_PER_RUN = 5;

function buildClientContext(client) {
    return {
        company_name: client?.client_name || null,
        company_short_description: getBusinessShortDescription(client?.business_details) || client?.seo_description || null,
        company_city: typeof client?.address === 'object' ? (client.address?.city || client.address?.region || null) : null,
        company_website: client?.website_url || null,
    };
}

function withClientContext(problem, context) {
    return {
        ...problem,
        context: {
            ...problem.context,
            ...context,
        },
    };
}

function extractProblemIdFromPromptUser(promptUser) {
    const raw = String(promptUser || '');
    const markerIndex = raw.indexOf(PROBLEM_ID_MARKER);
    if (markerIndex === -1) return null;
    const line = raw.slice(markerIndex).split('\n')[0] || '';
    const value = line.replace(PROBLEM_ID_MARKER, '').trim();
    return value || null;
}

function appendProblemMarker(prompt, problemId) {
    return {
        ...prompt,
        user: `${PROBLEM_ID_MARKER} ${problemId}\n\n${prompt.user}`,
    };
}

/**
 * Generates review-only AI remediation suggestions and stores them in remediation_suggestions.
 * Never applies AI output to client content or production data.
 */
export async function generateRemediationSuggestionsForClient(clientId, options = {}) {
    const client = await dbGetClientById(clientId);
    const [recentRuns, trendSlice, existingSuggestions, latestAudit] = await Promise.all([
        dbGetRecentQueryRuns(clientId, 120),
        getTrendSlice(clientId),
        listRemediationSuggestionsForClient(clientId),
        dbGetLatestAudit(clientId).catch(() => null),
    ]);

    const clientContext = buildClientContext(client);

    const problems = [];

    for (const run of recentRuns || []) {
        const mapped = problemsFromGeoRun(run, clientId).map((problem) => withClientContext(problem, clientContext));
        problems.push(...mapped);
    }

    const aggregateGeoProblems = problemsFromGeoRuns(recentRuns || [], clientId)
        .map((problem) => withClientContext(problem, clientContext));
    problems.push(...aggregateGeoProblems);

    const jobs = trendSlice?.jobs?.jobs || [];
    const jobRuns = trendSlice?.jobs?.runs || [];
    const latestRunByJobId = new Map();
    for (const run of jobRuns) {
        if (!run?.job_id) continue;
        if (!latestRunByJobId.has(run.job_id)) latestRunByJobId.set(run.job_id, run);
    }

    for (const job of jobs) {
        const latestRun = latestRunByJobId.get(job.id) || null;
        const mapped = problemsFromJobRun(latestRun, job, clientId).map((problem) => withClientContext(problem, clientContext));
        problems.push(...mapped);
    }

    const trendProblems = problemsFromTrendSlice(trendSlice, clientId).map((problem) => withClientContext(problem, clientContext));
    problems.push(...trendProblems);

    // Audit-originated problems (llms.txt, crawler access)
    if (latestAudit) {
        const auditProblems = problemsFromAuditResult(latestAudit, clientId)
            .map((problem) => withClientContext(problem, clientContext));
        problems.push(...auditProblems);
    }

    const deduped = [];
    const seen = new Set();
    for (const problem of problems) {
        if (!problem?.id || seen.has(problem.id)) continue;
        seen.add(problem.id);
        deduped.push(problem);
    }

    const requestedProblemType = options.problemType ? String(options.problemType).trim() : null;
    let candidateProblems = requestedProblemType
        ? deduped.filter((problem) => problem?.type === requestedProblemType)
        : deduped;

    // Fallback: when llms_txt_missing is explicitly requested but no audit-derived
    // problem exists (e.g. no audit has been run yet), synthesize a problem from
    // client context so the generate button always works.
    if (candidateProblems.length === 0 && requestedProblemType === 'llms_txt_missing') {
        const syntheticProblem = withClientContext(
            createProblem({
                clientId,
                source: 'audit',
                type: 'llms_txt_missing',
                severity: 'medium',
                context: { synthetic: true },
            }),
            clientContext,
        );
        candidateProblems = [syntheticProblem];
    }

    const existingDraftProblemIds = new Set(
        (existingSuggestions || [])
            .filter((item) => item?.status === 'draft')
            .map((item) => extractProblemIdFromPromptUser(item?.prompt_user))
            .filter(Boolean)
    );

    const notAlreadyDrafted = candidateProblems.filter((problem) => !existingDraftProblemIds.has(problem.id));

    // Limite MVP: on genere au plus 5 suggestions par client et par execution
    // pour controler les couts AI et garder la revue humaine praticable.
    const selectedProblems = notAlreadyDrafted.slice(0, MAX_SUGGESTIONS_PER_RUN);

    const suggestions = [];

    for (const problem of selectedProblems) {
        const promptBase = buildRemediationPrompt(problem);
        const prompt = appendProblemMarker(promptBase, problem.id);
        let aiOutput = null;

        if (isMistralRemediationType(problem.type)) {
            const mistralResult = await callMistralForRemediation({
                system: promptBase.system,
                user: promptBase.user,
                clientId,
                problemType: problem.type,
            });
            aiOutput = mistralResult?.text || null;
        } else {
            // Les types techniques restent conservateurs pour ce MVP.
            // TODO: brancher un flux dedie dev/code assistant pour les problemes techniques.
            aiOutput = null;
        }

        const stored = await insertRemediationSuggestion({
            clientId,
            problem,
            prompt,
            aiOutput,
        });

        suggestions.push(stored);
    }

    return {
        clientId,
        problemType: requestedProblemType,
        generatedAt: new Date().toISOString(),
        totalProblems: deduped.length,
        candidateProblems: candidateProblems.length,
        skippedExistingDraft: candidateProblems.length - notAlreadyDrafted.length,
        selectedProblems: selectedProblems.length,
        maxSuggestionsPerRun: MAX_SUGGESTIONS_PER_RUN,
        totalSuggestions: suggestions.length,
        suggestions,
    };
}
