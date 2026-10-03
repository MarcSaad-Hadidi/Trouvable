import 'server-only';

import { z } from 'zod';
import { registerTask } from './registry.js';

/**
 * community-briefing — generates a concise operator briefing
 * from the latest collection run and persisted community data.
 *
 * Grounded: the LLM MUST NOT invent findings. It summarizes,
 * clusters, and explains based on concrete evidence provided.
 */

const briefingSchema = z.object({
    headline: z.string().describe('One-line reading of the community intelligence state'),
    key_findings: z.array(z.object({
        finding: z.string(),
        evidence: z.string(),
        importance: z.enum(['high', 'medium', 'low']),
    })).default([]),
    pain_points: z.array(z.string()).default([]),
    buying_signals: z.array(z.string()).default([]),
    recommended_actions: z.array(z.object({
        action: z.string(),
        reason: z.string(),
    })).default([]),
    seed_assessment: z.string().optional().describe('Brief assessment of seed quality and coverage'),
    run_explanation: z.string().optional().describe('Clear explanation of why the run was weak/empty if applicable'),
});

const outputSchema = z.object({
    briefing: briefingSchema,
});

function buildMessages(input) {
    const {
        clientName,
        businessType,
        city,
        runStatus,
        documentsCollected,
        documentsPersisted,
        seedDiagnostics,
        clusters,
        opportunities,
        querySeeds,
    } = input;

    const seedSummary = (querySeeds || []).length > 0
        ? `Seeds utilisés : ${querySeeds.join(', ')}`
        : 'Aucun seed configuré.';

    const seedDiagSummary = (seedDiagnostics || []).map((sd, i) =>
        `  ${i + 1}. "${sd.seed}" → ${sd.status === 'ok' ? `${sd.results} résultat(s)` : `erreur: ${sd.detail || 'inconnue'}`}`
    ).join('\n') || '  Aucun diagnostic de seed disponible.';

    const clusterSummary = (clusters || []).length > 0
        ? clusters.slice(0, 20).map((c, i) =>
            `  ${i + 1}. [${c.cluster_type}] "${c.label}" — ${c.mention_count} mentions (preuve: ${c.evidence_level || 'low'})`
        ).join('\n')
        : '  Aucun cluster détecté.';

    const oppSummary = (opportunities || []).length > 0
        ? opportunities.slice(0, 10).map((o, i) =>
            `  ${i + 1}. [${o.opportunity_type}] "${o.title}" — preuve: ${o.evidence_level || 'low'}, ${o.mention_count || 0} mentions`
        ).join('\n')
        : '  Aucune opportunité dérivée.';

    const isWeak = (documentsCollected || 0) === 0 || (clusters || []).length === 0;

    // Detect source access failure from seed diagnostics
    const errorSeeds = (seedDiagnostics || []).filter((sd) => sd.status === 'error');
    const accessBlockedSeeds = errorSeeds.filter((sd) => sd.http_status === 403 || sd.failure_class === 'source_access_failure');
    const isAccessBlocked = accessBlockedSeeds.length > 0 && accessBlockedSeeds.length >= errorSeeds.length * 0.5;
    const isAllBlocked = errorSeeds.length === (seedDiagnostics || []).length && errorSeeds.length > 0;

    return [
        {
            role: 'system',
            content: [
                'Tu es un analyste d\'intelligence communautaire pour un opérateur de visibilité locale.',
                'Tu rédiges un briefing opérateur concis et factuel à partir des données de collecte communautaire.',
                '',
                'Règles strictes :',
                '- NE PAS inventer de signaux communautaires. Utilise UNIQUEMENT les données fournies.',
                '- Si la collecte est vide ou faible, explique clairement pourquoi sans masquer la réalité.',
                '- headline : une phrase de synthèse de la situation actuelle.',
                '- key_findings : les 3-5 constats les plus importants, chacun avec une preuve concrète.',
                '- pain_points : les irritants récurrents détectés (vide si aucun).',
                '- buying_signals : les signaux d\'achat ou d\'évaluation détectés (vide si aucun).',
                '- recommended_actions : 2-4 actions concrètes que l\'opérateur peut prendre.',
                '- seed_assessment : évaluation brève de la qualité et couverture des seeds.',
                '- run_explanation : si la collecte est faible/vide, explication claire et rassurante.',
                '- Écris en français.',
                '- Réponds en JSON valide uniquement.',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `Entreprise : ${clientName || 'Inconnue'} (${businessType || 'entreprise locale'})`,
                `Ville : ${city || 'non précisée'}`,
                '',
                `État de la collecte : ${runStatus || 'inconnu'}`,
                `Documents collectés : ${documentsCollected ?? 0}`,
                `Documents persistés : ${documentsPersisted ?? 0}`,
                '',
                seedSummary,
                'Diagnostic par seed :',
                seedDiagSummary,
                '',
                `Clusters détectés (${(clusters || []).length}) :`,
                clusterSummary,
                '',
                `Opportunités dérivées (${(opportunities || []).length}) :`,
                oppSummary,
                '',
                isWeak
                    ? (isAccessBlocked || isAllBlocked)
                        ? [
                            'IMPORTANT : La collecte a échoué à cause d\'un blocage d\'accès technique (HTTP 403).',
                            `${accessBlockedSeeds.length} seed(s) sur ${(seedDiagnostics || []).length} ont été bloqués.`,
                            'Cela signifie que la source a rejeté les requêtes — ce n\'est PAS une absence de signal marché.',
                            'Dans ton briefing :',
                            '- headline doit clairement indiquer un échec d\'accès technique, pas un manque de signaux.',
                            '- run_explanation doit expliquer que la collecte a été bloquée par la source.',
                            '- recommended_actions doit être orienté remédiation technique (pas d\'ajustement de seeds ou de contenu).',
                            '- NE PAS conclure qu\'il n\'y a pas d\'opportunités ou de signaux marché.',
                        ].join('\n')
                        : 'NOTE : la collecte semble faible ou vide. Explique clairement pourquoi dans run_explanation et propose des actions correctives dans recommended_actions.'
                    : 'Synthétise les signaux les plus importants pour l\'opérateur.',
                '',
                'Génère le briefing en JSON : { "briefing": { "headline": "...", "key_findings": [...], "pain_points": [...], "buying_signals": [...], "recommended_actions": [...], "seed_assessment": "...", "run_explanation": "..." } }',
            ].join('\n'),
        },
    ];
}

function normalize(raw) {
    const b = raw?.briefing || {};
    return {
        headline: String(b.headline || '').slice(0, 300),
        key_findings: (b.key_findings || []).slice(0, 5).map((f) => ({
            finding: String(f.finding || '').slice(0, 200),
            evidence: String(f.evidence || '').slice(0, 200),
            importance: ['high', 'medium', 'low'].includes(f.importance) ? f.importance : 'medium',
        })),
        pain_points: (b.pain_points || []).slice(0, 8).map((p) => String(p).slice(0, 150)),
        buying_signals: (b.buying_signals || []).slice(0, 5).map((s) => String(s).slice(0, 150)),
        recommended_actions: (b.recommended_actions || []).slice(0, 4).map((a) => ({
            action: String(a.action || '').slice(0, 200),
            reason: String(a.reason || '').slice(0, 200),
        })),
        seed_assessment: b.seed_assessment ? String(b.seed_assessment).slice(0, 300) : null,
        run_explanation: b.run_explanation ? String(b.run_explanation).slice(0, 400) : null,
    };
}

registerTask({
    taskId: 'community-briefing',
    mode: 'json',
    provider: 'mistral',
    fallbackProvider: 'gemini',
    purpose: 'query',
    temperature: 0.25,
    maxTokens: 2048,
    buildMessages,
    outputSchema,
    normalize,
});
