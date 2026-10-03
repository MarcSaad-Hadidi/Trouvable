/**
 * @typedef {Object} RemediationPrompt
 * @property {string} system
 * @property {string} user
 */

function buildSystemPrompt() {
    return [
        'Tu es un expert senior SEO/GEO et remediation technique pour une equipe interne.',
        'Tu proposes uniquement des suggestions actionnables, prudentes, en francais professionnel.',
        'N invente aucun fait: base-toi sur le contexte fourni.',
        'Ne propose jamais d application automatique en production.',
    ].join(' ');
}

function fallbackBusinessSummary(problem) {
    const companyName = problem?.context?.company_name || 'Entreprise non precisee';
    const shortDescription = problem?.context?.company_short_description || 'Description non disponible';
    const city = problem?.context?.company_city || 'Ville non precisee';
    const website = problem?.context?.company_website || 'URL non renseignee';

    return [
        `Entreprise: ${companyName}`,
        `Activite: ${shortDescription}`,
        `Ville/zone: ${city}`,
        `Site: ${website}`,
    ].join('\n');
}

function buildMissingFaqPrompt(problem) {
    const intent = problem?.context?.query_text || 'Intention non specifiee';

    return {
        system: buildSystemPrompt(),
        user: [
            fallbackBusinessSummary(problem),
            '',
            `Intent detectee: ${intent}`,
            '',
            'Instruction:',
            'Propose 5 a 7 questions/reponses au format FAQ, adaptees pour un site de cabinet de services,',
            'orientees clarte metier et pertinence locale. Reponds en francais, style concis et professionnel.',
            'Ajoute une courte note de priorisation (FAQ prioritaire -> optionnelle).',
        ].join('\n'),
    };
}

function buildSchemaPrompt(problem) {
    return {
        system: buildSystemPrompt(),
        user: [
            fallbackBusinessSummary(problem),
            '',
            'Instruction:',
            'Propose un bloc JSON-LD coherent pour LocalBusiness ou Service (choisis le plus pertinent),',
            'incluant les champs indispensables et des valeurs placeholders explicites lorsque des donnees manquent.',
            'Explique ensuite en 4 a 6 points les incoherences a verifier avant publication.',
        ].join('\n'),
    };
}

function buildWeakLocalClarityPrompt(problem) {
    const intent = problem?.context?.query_text || 'Intention non specifiee';
    return {
        system: buildSystemPrompt(),
        user: [
            fallbackBusinessSummary(problem),
            '',
            `Intent detectee: ${intent}`,
            '',
            'Instruction:',
            'Propose 6 a 8 ameliorations de clarte locale pour le contenu du site.',
            'Reponds sous forme de liste courte avec:',
            '- probleme observe',
            '- correction redactionnelle proposee',
            '- impact attendu (faible, moyen, fort).',
            'Style: francais professionnel, concret, sans blabla.',
        ].join('\n'),
    };
}

function buildVisibilityDecliningPrompt(problem) {
    const signals = Array.isArray(problem?.context?.action_center_signals)
        ? problem.context.action_center_signals
        : [];

    return {
        system: buildSystemPrompt(),
        user: [
            fallbackBusinessSummary(problem),
            '',
            `Signaux de baisse detectes: ${JSON.stringify(signals, null, 2)}`,
            '',
            'Instruction:',
            'Propose un mini plan de redressement sur 30 jours en 3 blocs:',
            '1) actions immediates (J1-J7)',
            '2) actions de consolidation (J8-J21)',
            '3) verification finale (J22-J30).',
            'Pour chaque action, indique une metrique de suivi simple.',
            'Format attendu: plan structure en listes, francais concis.',
        ].join('\n'),
    };
}

function buildJobAuditFlakyPrompt(problem) {
    const jobType = problem?.context?.job_type || 'audit_refresh';
    const lastError = problem?.context?.last_error || 'Aucune erreur detaillee';
    const retryCount = Number(problem?.context?.retry_count || 0);

    return {
        system: buildSystemPrompt(),
        user: [
            'Contexte technique job continu:',
            `- Type de job: ${jobType}`,
            `- Erreur recente: ${lastError}`,
            `- Nombre de retries observes: ${retryCount}`,
            '',
            'Instruction:',
            'Fais une analyse de robustesse du job et propose des pistes de correction prioritisees.',
            'Pas de code final obligatoire dans cette reponse: privilegie strategie, hypotheses de cause racine,',
            'instrumentation conseillee et plan de verification.',
        ].join('\n'),
    };
}

function buildLlmsTxtMissingPrompt(problem) {
    return {
        system: [
            'Tu es un expert SEO/GEO specialise dans l\'optimisation de visibilite IA.',
            'Tu generes directement le contenu du fichier llms.txt au format Markdown.',
            'Le fichier doit etre complet, pret a deployer, en francais professionnel.',
            'N invente aucun fait: base-toi uniquement sur le contexte fourni.',
        ].join(' '),
        user: [
            fallbackBusinessSummary(problem),
            '',
            'Instruction:',
            'Genere le contenu COMPLET d\'un fichier llms.txt au format Markdown.',
            'Le fichier doit suivre la specification llms.txt:',
            '- H1 avec le nom de l\'entreprise',
            '- Blockquote avec une description courte de l\'activite',
            '- Section "## Services" avec les services cles',
            '- Section "## Zone desservie" avec la ville/region',
            '- Section "## Contact" avec les coordonnees disponibles',
            '- Section "## FAQ" avec 3 a 5 questions/reponses pertinentes',
            '',
            'Le resultat est le contenu exact du fichier, pas un conseil.',
            'Ne rajoute pas de blocs de code ni de commentaires — uniquement le contenu Markdown du fichier.',
        ].join('\n'),
    };
}

function buildAiCrawlersBlockedPrompt(problem) {
    return {
        system: buildSystemPrompt(),
        user: [
            fallbackBusinessSummary(problem),
            '',
            `Probleme detecte: ${problem?.context?.issue_title || 'Crawlers IA bloques dans robots.txt'}`,
            problem?.context?.evidence_summary ? `Evidence: ${problem.context.evidence_summary}` : '',
            '',
            'Instruction:',
            'Propose un extrait robots.txt corrige qui autorise les crawlers IA critiques.',
            'Les crawlers a autoriser obligatoirement:',
            '- GPTBot (OpenAI search)',
            '- OAI-SearchBot (OpenAI search)',
            '- ChatGPT-User (ChatGPT browse)',
            '- ClaudeBot (Anthropic)',
            '- PerplexityBot (Perplexity AI)',
            '',
            'Fournis:',
            '1) L\'extrait robots.txt corrige (User-agent / Allow)',
            '2) Une courte explication du risque actuel (2-3 phrases)',
            '3) Les crawlers optionnels qu\'on pourrait aussi autoriser (Google-Extended, Bytespider)',
            '',
            'Format: texte structure, pas de JSON. Francais professionnel.',
        ].join('\n'),
    };
}

function buildGenericPrompt(problem) {
    return {
        system: buildSystemPrompt(),
        user: [
            fallbackBusinessSummary(problem),
            '',
            `Probleme detecte: ${problem.type}`,
            `Source: ${problem.source}`,
            `Severite: ${problem.severity}`,
            `Contexte JSON: ${JSON.stringify(problem.context || {}, null, 2)}`,
            '',
            'Instruction:',
            'Propose une remediation concrete et prudente en 5 a 8 actions,',
            'avec priorites court terme / moyen terme et risques eventuels.',
        ].join('\n'),
    };
}

/**
 * Builds a structured remediation prompt tailored to the normalized Problem type.
 * @param {import('./problem-types').Problem} problem
 * @returns {RemediationPrompt}
 */
export function buildRemediationPrompt(problem) {
    if (!problem || !problem.type) {
        return {
            system: buildSystemPrompt(),
            user: 'Probleme incomplet. Propose une strategie de diagnostic prudente et des verifications humaines.',
        };
    }

    if (problem.type === 'missing_faq_for_intent') return buildMissingFaqPrompt(problem);
    if (problem.type === 'weak_local_clarity') return buildWeakLocalClarityPrompt(problem);
    if (problem.type === 'schema_missing_or_incoherent') return buildSchemaPrompt(problem);
    if (problem.type === 'visibility_declining') return buildVisibilityDecliningPrompt(problem);
    if (problem.type === 'job_audit_flaky') return buildJobAuditFlakyPrompt(problem);
    if (problem.type === 'llms_txt_missing') return buildLlmsTxtMissingPrompt(problem);
    if (problem.type === 'ai_crawlers_blocked') return buildAiCrawlersBlockedPrompt(problem);
    return buildGenericPrompt(problem);
}
