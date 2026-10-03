export const PROMPT_TEMPLATE_VERSION = 'geo-v3.0.0';

const GEO_GLOBAL_FIDELITY_RULES = `REGLES DE FIDELITE:
- N'invente pas d'entreprises, d'avis, de resultats, de benchmarks ou de faits precis.
- Ne cite aucune URL sauf si elle est fournie dans le prompt ou deja presente dans une source fournie.
- Si aucune source fiable n'est disponible, dis clairement que ce n'est pas verifiable.
- Ne traite jamais un contexte fourni par l'entreprise comme une preuve independante.
- Distingue faits verifiables, affirmations, hypotheses prudentes et incertitudes.
- Quand tu compares ou listes des options, nomme explicitement les entreprises connues seulement si tu as une base raisonnable.
- Si la question appelle des alternatives et que tu n'en connais pas de solides, dis-le au lieu d'inventer.
- Adapte la reponse a la langue, a la localite et au niveau de preuve disponibles.`;

const GEO_BASE_SYSTEM_PROMPT = `Tu es un assistant conversationnel prudent, non promotionnel et utile pour evaluer des recherches GEO et locales.
Reponds naturellement a la question de l'utilisateur.

${GEO_GLOBAL_FIDELITY_RULES}`;

const GEO_PROMPT_MODE_ALIASES = {
    brand_aware: 'controlled_context_answer',
    assisted_brand_answer: 'controlled_context_answer',
    context_answer: 'controlled_context_answer',
    source_grounded: 'source_grounded_evaluation',
    extraction: 'operator_extraction',
};

const GEO_PROMPT_TEMPLATES = {
    blind_discovery: {
        id: `geo.blind_discovery.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Blind discovery',
        bias_risk: 'no_context',
        evidence_level: 'none',
        answer_type: 'discovery',
        context_injected: false,
        business_context_used: false,
        source_grounded: false,
    },
    neutral_brand_check: {
        id: `geo.neutral_brand_check.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Neutral brand check',
        bias_risk: 'brand_name_only',
        evidence_level: 'none',
        answer_type: 'evaluation',
        context_injected: false,
        business_context_used: false,
        source_grounded: false,
    },
    skeptical_brand_evaluation: {
        id: `geo.skeptical_brand_evaluation.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Skeptical brand evaluation',
        bias_risk: 'brand_name_only',
        evidence_level: 'none',
        answer_type: 'evaluation',
        context_injected: false,
        business_context_used: false,
        source_grounded: false,
    },
    competitor_discovery: {
        id: `geo.competitor_discovery.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Competitor discovery',
        bias_risk: 'no_context',
        evidence_level: 'none',
        answer_type: 'comparison',
        context_injected: false,
        business_context_used: false,
        source_grounded: false,
    },
    source_grounded_evaluation: {
        id: `geo.source_grounded_evaluation.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Source-grounded evaluation',
        bias_risk: 'source_grounded',
        evidence_level: 'source_provided',
        answer_type: 'source_grounded',
        context_injected: false,
        business_context_used: false,
        source_grounded: true,
    },
    controlled_context_answer: {
        id: `geo.controlled_context_answer.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Controlled context answer',
        bias_risk: 'context_injected',
        evidence_level: 'weak',
        answer_type: 'evaluation',
        context_injected: true,
        business_context_used: true,
        source_grounded: false,
    },
    operator_extraction: {
        id: `geo.operator_extraction.${PROMPT_TEMPLATE_VERSION}`,
        version: PROMPT_TEMPLATE_VERSION,
        label: 'Operator extraction',
        bias_risk: 'no_context',
        evidence_level: 'none',
        answer_type: 'extraction',
        context_injected: false,
        business_context_used: false,
        source_grounded: false,
    },
};

function normalizePromptMode(mode) {
    const raw = String(mode || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const mapped = GEO_PROMPT_MODE_ALIASES[raw] || raw;
    return GEO_PROMPT_TEMPLATES[mapped] ? mapped : 'controlled_context_answer';
}

function safeString(value) {
    return String(value || '').trim();
}

function uniqueStrings(values = []) {
    const seen = new Set();
    const output = [];
    for (const rawValue of values || []) {
        const value = safeString(rawValue);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(value);
    }
    return output;
}

function normalizeSourceItems(sources = []) {
    return (Array.isArray(sources) ? sources : [])
        .map((source, index) => {
            if (typeof source === 'string') {
                return { rank: index + 1, url: safeString(source), title: '', snippet: '' };
            }
            return {
                rank: Number.isFinite(Number(source?.rank)) ? Number(source.rank) : index + 1,
                url: safeString(source?.url),
                title: safeString(source?.title),
                snippet: safeString(source?.snippet || source?.content),
            };
        })
        .filter((source) => source.url);
}

function serializeSources(sources = []) {
    if (!sources.length) return 'Aucune source fiable fournie.';
    return sources
        .map((source) => {
            const parts = [`[${source.rank}] ${source.title || 'Source fournie'}`, `URL: ${source.url}`];
            if (source.snippet) parts.push(`Extrait: ${source.snippet}`);
            return parts.join('\n');
        })
        .join('\n\n');
}

function buildBrandOnlyContext(businessContext = {}) {
    const brandName = safeString(businessContext.name);
    const area = safeString(businessContext.area);
    const parts = [];
    if (brandName) parts.push(`Marque: ${brandName}`);
    if (area) parts.push(`Zone: ${area}`);
    return parts.join('\n') || 'Marque: non fournie';
}

function buildControlledBusinessContext(businessContext = {}) {
    const knownCompetitors = Array.isArray(businessContext.known_competitors)
        ? uniqueStrings(businessContext.known_competitors).slice(0, 15)
        : [];

    return [
        'Contexte fourni par l entreprise (utile pour ce run controle, mais pas une preuve independante):',
        `Nom: ${safeString(businessContext.name) || 'N/A'}`,
        `Activite: ${safeString(businessContext.description) || 'N/A'}`,
        `Zone: ${safeString(businessContext.area) || 'N/A'}`,
        `Services: ${JSON.stringify(Array.isArray(businessContext.services) ? businessContext.services : [])}`,
        knownCompetitors.length
            ? `Concurrents declares dans le profil interne: ${knownCompetitors.join(', ')}.`
            : 'Aucun concurrent declare dans le profil interne.',
    ].join('\n');
}

function buildPromptMetadata({ requestedMode, modeKey, template, businessContext, locale, language, sources }) {
    const sourceUrls = sources.map((source) => source.url);
    const evidenceLevel = modeKey === 'source_grounded_evaluation'
        ? (sourceUrls.length > 0 ? 'source_provided' : 'none')
        : template.evidence_level;

    return {
        discovery_mode: requestedMode,
        answer_generation_mode: modeKey,
        prompt_version: PROMPT_TEMPLATE_VERSION,
        prompt_template_id: template.id,
        extraction_version: modeKey === 'operator_extraction' ? PROMPT_TEMPLATE_VERSION : undefined,
        context_injected: template.context_injected,
        business_context_used: template.business_context_used,
        source_grounded: template.source_grounded,
        sources_provided: sourceUrls,
        bias_risk: template.bias_risk,
        evidence_level: evidenceLevel,
        answer_type: template.answer_type,
        target_brand: safeString(businessContext?.name) || null,
        locale: locale || 'fr-CA',
        language: language || null,
    };
}

export function normalizeGeoPromptMode(mode) {
    return normalizePromptMode(mode);
}

export function getGeoPromptTemplate(mode) {
    return GEO_PROMPT_TEMPLATES[normalizePromptMode(mode)];
}

export function buildGeoPromptForMode({
    query,
    mode = 'controlled_context_answer',
    businessContext = {},
    locale = 'fr-CA',
    language = null,
    sources = [],
}) {
    const requestedMode = String(mode || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') || 'controlled_context_answer';
    const modeKey = normalizePromptMode(mode);
    const template = GEO_PROMPT_TEMPLATES[modeKey];
    const sourceItems = normalizeSourceItems(sources);
    const question = safeString(query);

    let system;
    let user;

    if (modeKey === 'blind_discovery') {
        system = `${GEO_BASE_SYSTEM_PROMPT}
- Reponds sans preference pour une marque ou un prestataire specifique.
- N'utilise aucun profil business, aucune liste interne de concurrents et aucun pitch de marque.`;
        user = `${question}`;
    } else if (modeKey === 'neutral_brand_check') {
        system = `${GEO_BASE_SYSTEM_PROMPT}
- Evalue la marque nommee avec prudence, sans promotion et sans supposer qu'elle est efficace.
- Utilise seulement le nom de marque et la zone fournis comme contexte minimal.`;
        user = `${buildBrandOnlyContext(businessContext)}

Question utilisateur:
${question}`;
    } else if (modeKey === 'skeptical_brand_evaluation') {
        system = `${GEO_BASE_SYSTEM_PROMPT}
- Adopte une posture sceptique, prudente et non promotionnelle.
- Ne suppose pas qu'une marque est efficace sans preuves externes.
- Distingue preuves, affirmations, incertitudes et limites.
- Ne cite aucune URL non fournie.`;
        user = `${buildBrandOnlyContext(businessContext)}

Question utilisateur:
${question}

Reponds avec un verdict nuance, les preuves manquantes et les incertitudes.`;
    } else if (modeKey === 'competitor_discovery') {
        system = `${GEO_BASE_SYSTEM_PROMPT}
- Identifie les alternatives naturellement mentionnables sans forcer une marque cible.
- Ne reprends pas de liste de concurrents interne.
- Si tu ne connais pas d'alternatives solides, dis-le clairement.`;
        user = `${question}`;
    } else if (modeKey === 'source_grounded_evaluation') {
        system = `${GEO_BASE_SYSTEM_PROMPT}
- Reponds uniquement a partir des sources fournies et de connaissances generales prudentes.
- Cite seulement les URLs fournies ci-dessous.
- Si les sources ne permettent pas de conclure, dis-le clairement.
- Ne traite jamais une description fournie par l'entreprise comme preuve independante.`;
        user = `Question utilisateur:
${question}

Sources fournies:
${serializeSources(sourceItems)}

${sourceItems.length > 0
        ? 'Reponds avec preuves, limites et URLs fournies uniquement.'
        : "Aucune source fiable n'est fournie: explique que la reponse n'est pas verifiable au lieu d'inventer des liens."}`;
    } else if (modeKey === 'operator_extraction') {
        system = `Tu es un extracteur structure. Tu ne dois pas generer de nouvelle reponse utilisateur.
Extrais uniquement les marques, concurrents, URLs, sentiment, position de la marque cible, niveau de preuve, claims, incertitudes et risque d hallucination.`;
        user = `Question analysee:
${question}

Reponse a analyser:
${safeString(businessContext.response_text || '')}

Marque cible: ${safeString(businessContext.name) || 'N/A'}`;
    } else {
        system = `${GEO_BASE_SYSTEM_PROMPT}
- Ce run est volontairement assiste par contexte business.
- Le contexte fourni peut aider a comprendre l'offre, mais il ne prouve pas la performance de l'entreprise.
- Ne compare pas ce run a une mesure de visibilite naturelle.`;
        user = `${buildControlledBusinessContext(businessContext)}

Question utilisateur:
${question}

Reponds de facon prudente et exploitable. Marque les limites si aucune preuve externe n'est disponible.`;
    }

    return {
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
        metadata: buildPromptMetadata({
            requestedMode,
            modeKey,
            template,
            businessContext,
            locale,
            language,
            sources: sourceItems,
        }),
    };
}
