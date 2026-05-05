import { buildGeoPromptForMode } from './geo-prompt-templates.js';

export {
    PROMPT_TEMPLATE_VERSION,
    getGeoPromptTemplate,
    buildGeoPromptForMode,
} from './geo-prompt-templates.js';

/**
 * Prompts IA pour Trouvable.
 * Regles: JSON strict, aucune invention de faits, distinguer observed / inferred / recommended / non trouve.
 */

export function buildAuditAnalysisPrompt(siteData) {
    const system = `Tu es un analyste expert en SEO, GEO et answerability pour Trouvable.
Tu recois un resume de crawl deja nettoye. Tu dois produire un JSON strict, utile meme si certaines donnees sont faibles.

REGLES ABSOLUES:
- N'invente aucun fait.
- Utilise "observed" seulement pour ce qui est clairement present dans les donnees.
- Utilise "inferred" seulement pour une deduction prudente basee sur plusieurs signaux.
- Utilise "recommended" pour une action conseillee non observee.
- Si un point est absent, traite-le comme "non trouve" plutot que d'inventer.
- Reste conscient du site type detecte. N'applique pas des attentes locales tres fortes a un site dont la relevance locale est faible.
- Les opportunites doivent etre actionnables, precises et non vagues.
- Les merge_suggestions doivent rester modestes et defensives.
- Le score llm_comprehension_score est un score entier de 0 a 15.
- Reponds UNIQUEMENT en JSON valide, sans texte autour.

CONTRAT JSON:
- business_summary: string bref et factuel
- geo_recommendability: "strong" | "moderate" | "weak" | "unclear"
- geo_recommendability_rationale: string
- llm_comprehension_score: integer 0-15
- answerability_summary: string court
- opportunities: array of objects with title, description, priority, category, source, evidence_summary, recommended_fix
- faq_suggestions: array of objects with question, suggested_answer, source, rationale
- merge_suggestions: array of objects with field_name, suggested_value, confidence, rationale, source
- detected_services: array of strings
- detected_areas: array of strings
- detected_business_name: string ou null

CATEGORIES AUTORISEES POUR opportunities:
- seo
- geo
- content
- technical
- trust

CHAMPS DE MERGE POSSIBLES:
- seo_title
- seo_description
- business_type
- address
- geo_faqs
- social_profiles
- contact_info.phone
- contact_info.public_email
- business_details.short_desc
- business_details.services
- business_details.areas_served`;

    const user = `Voici les donnees extraites du site:

URL source: ${siteData.source_url}
URL resolue: ${siteData.resolved_url || 'N/A'}
Pages scannees: ${siteData.pages_scanned || 0}

SITE TYPE DETECTE:
${JSON.stringify(siteData.site_classification || {}, null, 2)}

PAGES RESUMEES:
${JSON.stringify(siteData.page_summaries || [], null, 2)}

TITRES: ${JSON.stringify(siteData.titles?.slice(0, 5) || [])}
META DESCRIPTIONS: ${JSON.stringify(siteData.descriptions?.slice(0, 3) || [])}
H1: ${JSON.stringify(siteData.h1s?.slice(0, 5) || [])}
H2 CLUSTERS: ${JSON.stringify(siteData.h2_clusters?.slice(0, 3)?.map((cluster) => cluster.slice(0, 6)) || [])}

BUSINESS NAMES: ${JSON.stringify(siteData.business_names || [])}
PHONES: ${JSON.stringify(siteData.phones || [])}
EMAILS: ${JSON.stringify(siteData.emails || [])}
SOCIAL LINKS: ${JSON.stringify(siteData.social_links?.slice(0, 6) || [])}

LOCAL SIGNALS:
${JSON.stringify(siteData.local_signals || {}, null, 2)}

SERVICE SIGNALS:
${JSON.stringify(siteData.service_signals || {}, null, 2)}

TRUST SIGNALS:
${JSON.stringify(siteData.trust_signals || {}, null, 2)}

SCHEMA ENTITIES:
${JSON.stringify(siteData.schema_entities || [], null, 2)}

FAQ PAIRS:
${JSON.stringify(siteData.faq_pairs || [], null, 2)}

TECHNOLOGY SIGNALS:
${JSON.stringify(siteData.technology_signals || {}, null, 2)}

PAGE STATS:
${JSON.stringify(siteData.page_stats || {}, null, 2)}

EVIDENCE SUMMARY:
${JSON.stringify(siteData.evidence_summary || [], null, 2)}

TEXT SAMPLE:
${(siteData.text_content || '').slice(0, 3200)}

Produis maintenant le JSON strict.`;

    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}
/**
 * Legacy wrapper kept for existing imports. It now maps to the explicit
 * controlled_context_answer mode so context injection remains visible in metadata.
 */
export function buildGeoQueryPrompt(query, businessContext) {
    return buildGeoPromptForMode({
        query,
        mode: 'controlled_context_answer',
        businessContext,
    }).messages;
}

/**
 * Blind discovery GEO query prompt.
 * Does NOT inject any business context — no company name, no description,
 * no services, no competitors. The question is sent as a pure market query.
 *
 * This mode measures spontaneous mention / true visibility.
 * Target-aware evaluation still happens afterward in the analysis layer.
 */
export function buildBlindGeoQueryPrompt(query) {
    return buildGeoPromptForMode({
        query,
        mode: 'blind_discovery',
        businessContext: {},
    }).messages;
}

export function buildGeoQueryAnalysisPrompt(query, aiResponse, targetBusiness) {
    const system = `Tu es un extracteur structure. Tu analyses une reponse deja produite par un modele IA.
Tu ne dois pas reecrire la reponse, ni produire une nouvelle reponse utilisateur.
Reponds UNIQUEMENT en JSON strict, sans markdown.

CONTRAT JSON (tous les champs requis):
{
  "query": string,
  "response_text": string,
  "mentioned_businesses": [
    {
      "name": string,
      "position": integer >= 1,
      "context": string,
      "is_target": boolean,
      "sentiment": "positive" | "neutral" | "negative"
    }
  ],
  "total_businesses_mentioned": integer,
  "target_found": boolean,
  "target_position": integer | null,
  "brand_mentioned": boolean,
  "brand_position": integer | null,
  "competitors_mentioned": string[],
  "urls_cited": string[],
  "sentiment": "positive" | "neutral" | "negative",
  "evidence_level": "none" | "weak" | "source_provided" | "cited_url" | "verified_source",
  "claims": string[],
  "unsupported_claims": string[],
  "citations": [{"url": string, "claim": string, "evidence_span": string}],
  "uncertainty_flags": string[],
  "hallucination_risk": "low" | "medium" | "high"
}

REGLES:
- "response_text" doit reprendre integralement le texte de la reponse analysee (copie fidele).
- Liste tout business / marque / etablissement nomme de facon identifiable (y compris concurrents potentiels).
- "position" = ordre d'apparition des noms dans la reponse (1 = premier nom propre pertinent).
- "context" = extrait verbatim (copier-coller) de 120 a 260 caracteres autour de la mention; inclus des indices si c'est une recommandation, une alternative ("vs", "plutot que", "autre option") ou une simple citation.
- "is_target": true uniquement pour "${targetBusiness}" (ou sa forme evidente).
- Si aucune autre entreprise nommee: tableau vide autorise seulement si la reponse ne contient vraiment aucun nom hors cible.
- Ne cree pas de faux noms pour remplir le tableau.
- Detecte explicitement les signaux locaux presents dans la reponse (ville, quartier, region, code postal, zone desservie, type d'etablissement), puis injecte ces indices dans "context" pour chaque mention concernee.
- Si la cible n'est pas citee, preserve dans les contexts les indices qui expliquent la non-citation (manque de precision locale, offre hors intent, alternatives plus saillantes).
- "competitors_mentioned" doit contenir seulement des marques nommees dans la reponse, jamais des concurrents inventes.
- "urls_cited" doit contenir seulement les URLs presentes dans la reponse analysee.
- "unsupported_claims" doit lister les affirmations fortes sans preuve ou sans URL citee dans la reponse.
- "evidence_level" vaut "cited_url" seulement si la reponse contient au moins une URL explicite.
- "hallucination_risk" monte a "high" si la reponse cite des faits precis, classements, avis ou sources sans preuve visible.
- Ne modifie jamais le contrat JSON et n'ajoute aucun champ hors schema.`;

    const user = `REQUETE: "${query}"
BUSINESS CIBLE: "${targetBusiness}"

REPONSE DU MODELE:
${aiResponse}

Analyse et produis le JSON conforme au contrat.`;

    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}
