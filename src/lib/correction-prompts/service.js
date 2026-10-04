import 'server-only';

import { getClientById as dbGetClientById } from '@/lib/db/clients';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import '@/lib/ai/tasks/generate-correction-prompt';
import { executeTask } from '@/lib/ai/tasks/registry';
import { getSeoHealthIssues } from '@/lib/operator-intelligence/seo-health-issues';

import { CorrectionPromptValidationError } from './render';
import { buildSeoHealthCorrectionPromptContext } from './seo-health-context';
import { getContextBuilderForSource } from './builders';
import { validateProblemRef, normalizeProblemRef } from './problem-ref';

export class CorrectionPromptServiceError extends Error {
    constructor(message, { status = 500, details = null } = {}) {
        super(message);
        this.name = 'CorrectionPromptServiceError';
        this.status = status;
        this.details = details;
    }
}

function buildTaskInput(context, { taskType, presetVariant } = {}) {
    return {
        issueId: context.problem.issueId,
        clientName: context.source.clientName,
        problemTitle: context.problem.title,
        problemCategory: context.problem.category,
        truthState: context.problem.truthState,
        sourceUrl: context.evidence.sourceUrl || null,
        categoryInstruction: context.constraints.categoryInstruction,
        taskType: taskType || 'correction',
        presetVariant: presetVariant || null,
        context,
    };
}

function buildContextSummary(context) {
    return {
        issueId: context.problem.issueId,
        title: context.problem.title,
        category: context.problem.category,
        truthState: context.problem.truthState,
        confidence: context.problem.confidence,
        evidenceSummary: context.evidence.summary,
        recommendedFix: context.evidence.recommendedFix,
        sourceUrl: context.evidence.sourceUrl || null,
        inspectionTargets: context.inspectionTargets,
        verifiedPaths: context.verifiedPaths,
        repoFacts: context.repoFacts,
        validationTargets: context.validationTargets,
        missingFields: context.missingFields,
    };
}

async function loadClientAndAudit(clientId) {
    const [client, audit] = await Promise.all([
        dbGetClientById(clientId).catch(() => null),
        dbGetLatestAudit(clientId).catch(() => null),
    ]);

    if (!client) {
        throw new CorrectionPromptServiceError('Client introuvable.', { status: 404 });
    }

    if (!audit) {
        throw new CorrectionPromptServiceError("Aucun audit exploitable n'est disponible pour ce client.", {
            status: 404,
        });
    }

    return { client, audit };
}

function runTaskAndShape(context, { taskType, presetVariant, clientId, triggerSource }) {
    return executeTask('generate-correction-prompt', buildTaskInput(context, { taskType, presetVariant }), {
        clientId,
        triggerSource,
    })
        .then((result) => ({ context, result }))
        .catch((error) => {
            if (error instanceof CorrectionPromptValidationError) {
                throw new CorrectionPromptServiceError("La generation Mistral n'a pas produit un prompt exploitable.", {
                    status: 422,
                    details: error.details,
                });
            }
            throw error;
        });
}

function buildResponsePayload({ context, result, issue, ref }) {
    const issuePayload = issue
        ? {
              id: issue.id,
              title: issue.title,
              priority: issue.priority,
              category: issue.category,
              dimension: issue.dimension,
              truth_class: issue.truth_class,
              confidence: issue.confidence,
          }
        : {
              id: context.problem.issueId,
              title: context.problem.title,
              priority: context.problem.severity,
              category: context.problem.category,
              dimension: context.problem.dimension,
              truth_class: context.problem.truthState,
              confidence: context.problem.confidence,
          };

    return {
        issue: issuePayload,
        problemRef: ref || null,
        contextSummary: buildContextSummary(context),
        prompts: result.data,
        meta: result.meta,
        runId: result.runId,
        validation: result.validation,
    };
}

/**
 * Ancien point d'entrée — conservé pour compatibilité ascendante avec les
 * appels `{ issueId }` existants (clients fetch + composant CorrectionPromptGenerator).
 */
export async function generateSeoHealthCorrectionPrompt({ clientId, issueId, triggerSource = 'manual' }) {
    if (!clientId) {
        throw new CorrectionPromptServiceError('clientId manquant.', { status: 400 });
    }

    if (!issueId) {
        throw new CorrectionPromptServiceError('issueId manquant.', { status: 400 });
    }

    const { client, audit } = await loadClientAndAudit(clientId);

    const issues = getSeoHealthIssues(audit, { limit: null });
    const issue = issues.find((candidate) => candidate.id === issueId);

    if (!issue) {
        throw new CorrectionPromptServiceError('Probleme SEO Health introuvable dans le dernier audit.', {
            status: 404,
        });
    }

    const context = buildSeoHealthCorrectionPromptContext({ client, audit, issue });

    try {
        const { result } = await runTaskAndShape(context, {
            taskType: 'correction',
            presetVariant: null,
            clientId,
            triggerSource,
        });

        return buildResponsePayload({ context, result, issue, ref: null });
    } catch (error) {
        if (error instanceof CorrectionPromptServiceError) throw error;
        if (error instanceof CorrectionPromptValidationError) {
            throw new CorrectionPromptServiceError("La generation Mistral n'a pas produit un prompt exploitable.", {
                status: 422,
                details: error.details,
            });
        }
        throw error;
    }
}

/**
 * Nouveau point d'entrée unifié basé sur un ProblemRef. Dispatch via le
 * registry de builders selon `ref.source`.
 */
export async function generateCorrectionPromptFromRef({ ref, triggerSource = 'manual' }) {
    const normalized = normalizeProblemRef(ref);
    const validation = validateProblemRef(normalized);

    if (!validation.ok) {
        throw new CorrectionPromptServiceError(validation.error || 'ProblemRef invalide.', {
            status: 400,
        });
    }

    const builder = getContextBuilderForSource(normalized.source);
    if (!builder) {
        throw new CorrectionPromptServiceError(`Source non supportée : ${normalized.source}`, { status: 400 });
    }

    const { client, audit } = await loadClientAndAudit(normalized.clientId);

    let context;
    try {
        context = await builder({ client, audit, ref: normalized });
    } catch (buildError) {
        throw new CorrectionPromptServiceError(
            buildError.message || 'Impossible de construire le contexte correctif.',
            { status: 404 },
        );
    }

    try {
        const { result } = await runTaskAndShape(context, {
            taskType: normalized.taskType,
            presetVariant: normalized.presetVariant,
            clientId: normalized.clientId,
            triggerSource,
        });

        return buildResponsePayload({ context, result, issue: null, ref: normalized });
    } catch (error) {
        if (error instanceof CorrectionPromptServiceError) throw error;
        if (error instanceof CorrectionPromptValidationError) {
            throw new CorrectionPromptServiceError("La generation Mistral n'a pas produit un prompt exploitable.", {
                status: 422,
                details: error.details,
            });
        }
        throw error;
    }
}
