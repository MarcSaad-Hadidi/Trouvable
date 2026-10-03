import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { callAiJson } from '@/lib/ai/index';
import { DISCOVERY_MODE_META, normalizeDiscoveryMode } from '@/lib/operator-intelligence/prompt-taxonomy';

const MAX_PROMPT_COUNT = 6;
const MIN_PROMPT_COUNT = 3;

const listSchema = z.object({
    intent: z.string().max(500).optional().or(z.literal('')),
    category: z.string().max(100).optional().or(z.literal('')),
    locale: z.string().max(100).optional().or(z.literal('')),
    prompt_mode: z.string().max(60).optional().or(z.literal('')),
    count: z.number().int().min(MIN_PROMPT_COUNT).max(MAX_PROMPT_COUNT).optional(),
    business_name: z.string().max(200).optional().or(z.literal('')),
    business_type: z.string().max(300).optional().or(z.literal('')),
    target_region: z.string().max(200).optional().or(z.literal('')),
    seo_description: z.string().max(1000).optional().or(z.literal('')),
    services: z.string().max(1000).optional().or(z.literal('')),
    discovery_mode: z.string().max(80).optional().or(z.literal('')),
});

const VALID_MODES = new Set(['user_like', 'operator_probe']);

const GENERATION_BLOCKED_DISCOVERY = new Set(['operator_extraction']);

function measurementInstructions(discoveryMode) {
    if (!discoveryMode) return '';
    const meta = DISCOVERY_MODE_META[discoveryMode];
    if (!meta) return '';

    const label = meta.label || discoveryMode;

    /** @type {Record<string, string>} */
    const rules = {
        blind_discovery:
            'Ne jamais inclure le nom de l\'entreprise cliente ni un pitch sur elle. Questions de marché pures ; le but est de mesurer une mention spontanee eventuelle.',
        neutral_brand_check:
            'Le nom de la marque peut apparaitre comme sujet neutre (« X a Montreal », verification factuelle courte). Pas de reformulation marketing du mandat.',
        skeptical_brand_evaluation:
            'Inclure le nom de la marque dans une posture critique ou prudente (fiabilite, promesses, comparaisons dures). Langage utilisateur reel.',
        competitor_discovery:
            'Ne pas cadrer la reponse sur la marque cliente comme sujet principal. Alternatives, « meilleurs choix », comparaisons de segment avec ancrage geo.',
        source_grounded_evaluation:
            'Formuler comme une demande d\'evaluation ou de synthese basee sur des sources, avis ou faits verifiables (sans inventer de sources).',
        controlled_context_answer:
            'Questions qui supposent un contexte connu sur l\'entreprise ou son offre (tests internes, QA). Peuvent etre plus directes sur le positionnement.',
        brand_aware:
            'Le nom de la marque et le contexte metier peuvent etre presupposes dans la question, comme en mode marque explicite historique.',
    };

    const body = rules[discoveryMode] || meta.description || '';
    return `

## TYPE DE MESURE — ${label}
${body}

Tous les prompts generes doivent respecter strictement ce cadre de mesure.`;
}

function buildSystemPrompt(count, discoveryMode) {
    return `Tu es expert en GEO (Generative Engine Optimization) — la visibilité d'une entreprise dans les réponses IA (ChatGPT, Perplexity, Gemini, Claude).

## MISSION

Générer exactement ${count} prompts de recherche distincts basés sur le contexte du mandat client fourni.
Chaque prompt reproduit ce qu'un vrai utilisateur taperait dans ChatGPT ou Perplexity.
${measurementInstructions(discoveryMode)}

## RÈGLE #1 — NATURALITÉ
- Langage quotidien québécois/canadien-français
- Pas de jargon marketing, pas de ton corporatif
- Tournures naturelles : « c'est quoi », « je cherche », « quelqu'un connaît », « comment faire pour »
- OK d'avoir des phrases incomplètes si c'est naturel

## RÈGLE #2 — LONGUEUR
8 à 28 mots par prompt. Zone optimale : 12–22 mots.

## RÈGLE #3 — ANCRAGE GÉOGRAPHIQUE
Chaque prompt DOIT contenir un signal géographique naturel (ville, quartier, région).

## RÈGLE #4 — MODE
- Si le mode est « user_like » : question naturelle, NE PAS commencer par un verbe d'action
- Si le mode est « operator_probe » : COMMENCER par un verbe d'action (Donne, Liste, Compare, Évalue)
- Si aucun mode spécifié : varier entre les deux naturellement

## RÈGLE #5 — DIVERSITÉ
Chaque prompt DOIT couvrir un angle différent. Aucun doublon conceptuel, aucune reformulation.
Varier les intentions : exploration, évaluation, comparaison, coûts, choix, processus.

## RÈGLE #6 — SPÉCIFICITÉ
Chaque prompt inclut un scénario ou besoin concret, pas de questions génériques.

## RÈGLE #7 — QUALITÉ
Chaque prompt doit être immédiatement utilisable. Pas de placeholder, pas de [X].

${discoveryMode ? '' : `## RÈGLE #8 — NOM D'ENTREPRISE (si aucun type de mesure impose)
- Par defaut : ne pas mentionner le nom de l'entreprise cliente dans le texte du prompt, sauf consigne explicite de l'operateur.
`}

## FORMAT DE SORTIE — JSON STRICT

Réponds UNIQUEMENT avec un tableau JSON de ${count} objets. Aucun texte avant/après, aucun markdown.

[{"query_text":"le prompt exact","intent_family":"discovery|brand|competitor|pricing|buyer_guidance|implementation","prompt_mode":"user_like|operator_probe","rationale":"1 phrase courte sur l'angle couvert"}]

## STRICTEMENT INTERDIT
- Prompts que personne ne taperait dans la vraie vie
- Doublons conceptuels ou reformulations
${discoveryMode ? '- Contredire le type de mesure impose ci-dessus' : "- Mentionner le nom de l'entreprise SAUF si l'opérateur le demande explicitement"}
- Jargon technique (SEO, GEO, schema.org, tracking)`;
}

function buildUserMessage(data) {
    const parts = [];
    const hasMandate = data.business_name || data.business_type || data.target_region;

    if (hasMandate) {
        parts.push(`## Contexte du mandat`);
        if (data.business_name) parts.push(`Entreprise : ${data.business_name}`);
        if (data.business_type) parts.push(`Type : ${data.business_type}`);
        if (data.target_region) parts.push(`Région : ${data.target_region}`);
        if (data.seo_description) parts.push(`Description : ${data.seo_description}`);
        if (data.services) parts.push(`Services : ${data.services}`);
    }

    if (data.intent && data.intent.trim()) {
        parts.push(`\n## Consigne additionnelle de l'opérateur`);
        parts.push(data.intent.trim());
    } else if (hasMandate) {
        parts.push(`\n## Objectif`);
        parts.push(`Génère des prompts de recherche naturels pour améliorer la visibilité GEO de cette entreprise dans sa région.`);
    }

    if (data.category) parts.push(`\nCatégorie/famille souhaitée : ${data.category}`);
    if (data.locale) parts.push(`Locale : ${data.locale}`);
    if (data.prompt_mode) {
        parts.push(`Mode souhaité : ${data.prompt_mode === 'operator_probe' ? 'sonde opérateur (verbe d\'action)' : 'question utilisateur naturelle'}`);
    }
    if (data.discovery_mode) {
        const meta = DISCOVERY_MODE_META[data.discovery_mode];
        parts.push(`\nType de mesure impose : ${meta?.label || data.discovery_mode}`);
        if (meta?.description) parts.push(meta.description);
    }
    parts.push(`\nGénère ${data.count || 4} prompts distincts basés sur ce mandat.`);
    return parts.join('\n');
}

function validatePromptList(data, maxCount) {
    if (!Array.isArray(data)) return null;
    const valid = data
        .filter((item) => item && typeof item.query_text === 'string' && item.query_text.trim().length >= 8)
        .map((item) => ({
            query_text: item.query_text.trim().replace(/^["«»]+|["«»]+$/g, ''),
            intent_family: typeof item.intent_family === 'string' ? item.intent_family : 'discovery',
            prompt_mode: VALID_MODES.has(item.prompt_mode) ? item.prompt_mode : 'user_like',
            rationale: String(item.rationale || '').trim(),
        }))
        .slice(0, maxCount);
    return valid.length >= MIN_PROMPT_COUNT ? valid : null;
}

export async function POST(request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const parsed = listSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    const hasIntent = parsed.data.intent && parsed.data.intent.trim().length > 0;
    const hasMandate = parsed.data.business_name || parsed.data.business_type || parsed.data.target_region;
    if (!hasIntent && !hasMandate) {
        return NextResponse.json({ error: 'Contexte insuffisant : fournissez le contexte du mandat ou une consigne.' }, { status: 400 });
    }

    const count = parsed.data.count || 4;

    const rawDiscovery = parsed.data.discovery_mode?.trim();
    let resolvedDiscovery = null;
    if (rawDiscovery) {
        resolvedDiscovery = normalizeDiscoveryMode(rawDiscovery);
        if (GENERATION_BLOCKED_DISCOVERY.has(resolvedDiscovery)) {
            return NextResponse.json({ error: 'Type de mesure non pris en charge pour la generation.' }, { status: 400 });
        }
    }

    try {
        const result = await callAiJson({
            messages: [
                { role: 'system', content: buildSystemPrompt(count, resolvedDiscovery) },
                { role: 'user', content: buildUserMessage({ ...parsed.data, count, discovery_mode: resolvedDiscovery }) },
            ],
            purpose: 'onboarding',
            temperature: 0.7,
            maxTokens: 1200,
            providerOverride: 'mistral',
            fallbackProvider: 'gemini',
        });

        const prompts = validatePromptList(result.data, count);
        if (!prompts) {
            return NextResponse.json({ error: 'Format IA invalide' }, { status: 502 });
        }

        const items = prompts.map((item, index) => ({
            id: `gen-${index}-${Date.now()}`,
            query_text: item.query_text,
            intent_family: item.intent_family,
            prompt_mode: item.prompt_mode,
            rationale: item.rationale,
            ...(resolvedDiscovery ? { discovery_mode: resolvedDiscovery } : {}),
        }));

        return NextResponse.json({
            prompts: items,
            provider: result.provider || 'mistral',
            model: result.model || null,
        });
    } catch (error) {
        console.error('[generate-prompt-list]', error);
        return NextResponse.json({ error: 'Echec generation IA' }, { status: 502 });
    }
}
