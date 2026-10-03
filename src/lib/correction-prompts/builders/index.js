import 'server-only';

import { buildSeoHealthCorrectionPromptContext } from '../seo-health-context';
import { getSeoHealthIssues } from '@/lib/operator-intelligence/seo-health-issues';

import { buildCannibalizationCorrectionPromptContext } from './cannibalization';
import { buildLayer1CorrectionPromptContext } from './lab-layer1';
import { buildLayer2CorrectionPromptContext } from './lab-layer2';
import { buildOpportunityCorrectionPromptContext } from './opportunities';

/**
 * Registry de builders par source ProblemRef.
 *
 * Chaque builder reçoit `{ client, audit, ref }` et doit retourner le
 * contexte canonique (même shape que `buildSeoHealthCorrectionPromptContext`).
 *
 * Phase 1 — les sources non encore couvertes (opportunités, cannibalisation,
 * GEO readiness, alertes, agent fixes) retombent sur le builder SEO Health
 * par défaut lorsque `issueId` est fourni, sinon lèvent une erreur explicite.
 */

function compactString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildSeoHealthFromRef({ client, audit, ref }) {
    const issueId = compactString(ref.issueId);
    if (!issueId) {
        throw new Error('seo_health_issue nécessite issueId.');
    }
    const issues = getSeoHealthIssues(audit, { limit: null });
    const issue = issues.find((candidate) => candidate.id === issueId);
    if (!issue) {
        throw new Error('Problème SEO Health introuvable dans le dernier audit.');
    }
    return buildSeoHealthCorrectionPromptContext({ client, audit, issue });
}

function buildAuditPriorityProblem({ client, audit, ref }) {
    // Fallback intelligent : si on a un issueId, on rejoue via SEO Health.
    // Sinon si on a un checkId, on passe par le builder Layer 1.
    if (compactString(ref.issueId)) {
        return buildSeoHealthFromRef({ client, audit, ref });
    }
    if (compactString(ref.checkId)) {
        return buildLayer1CorrectionPromptContext({ client, audit, ref });
    }
    throw new Error('audit_priority_problem nécessite issueId ou checkId.');
}

/**
 * Pour Phase 1, les sources d'opportunités SEO/GEO sans payload
 * spécifique dégradent proprement :
 *  - si issueId présent → builder SEO Health
 *  - sinon → erreur claire demandant plus de contexte
 */
function buildFallbackOpportunity({ client, audit, ref }) {
    if (compactString(ref.issueId)) {
        return buildSeoHealthFromRef({ client, audit, ref });
    }
    throw new Error(
        `Source ${ref.source} n'expose pas encore de builder dédié. Rattacher un issueId depuis SEO Health pour utiliser le builder par défaut.`,
    );
}

const BUILDERS = {
    seo_health_issue: buildSeoHealthFromRef,
    lab_layer1_check: buildLayer1CorrectionPromptContext,
    lab_layer2_finding: buildLayer2CorrectionPromptContext,
    audit_priority_problem: buildAuditPriorityProblem,
    seo_opportunity: buildOpportunityCorrectionPromptContext,
    seo_cannibalization: buildCannibalizationCorrectionPromptContext,
    seo_on_page: buildFallbackOpportunity,
    geo_opportunity: buildOpportunityCorrectionPromptContext,
    geo_readiness_blocker: buildFallbackOpportunity,
    geo_consistency_gap: buildFallbackOpportunity,
    geo_alert: buildFallbackOpportunity,
    agent_fix: buildFallbackOpportunity,
};

export function getContextBuilderForSource(source) {
    return BUILDERS[source] || null;
}

export function listSupportedSources() {
    return Object.keys(BUILDERS);
}
