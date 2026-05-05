import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { callAiJson } from '@/lib/ai/index';
import { buildCanonicalPromptContract } from '@/lib/queries/onboarding-prompt-contract';

const generateSchema = z.object({
    business_name: z.string().min(1).max(200),
    business_type: z.string().max(300).optional().or(z.literal('')),
    target_region: z.string().max(200).optional().or(z.literal('')),
    city: z.string().max(200).optional().or(z.literal('')),
    seo_description: z.string().max(1500).optional().or(z.literal('')),
    services: z.string().max(2000).optional().or(z.literal('')),
    short_description: z.string().max(1000).optional().or(z.literal('')),
    areas_served: z.string().max(500).optional().or(z.literal('')),
    classification_label: z.string().max(200).optional().or(z.literal('')),
    needs_services: z.boolean().optional(),
});

const VALID_INTENT_FAMILIES = new Set([
    'discovery', 'brand', 'competitor', 'pricing', 'buyer_guidance', 'implementation',
]);
const VALID_MODES = new Set(['user_like', 'operator_probe']);

function buildSystemPrompt() {
    return `Tu es expert en GEO (Generative Engine Optimization) — la visibilité d'une entreprise dans les réponses IA (ChatGPT, Perplexity, Gemini, Claude, Copilot).

## MISSION

Générer 7 prompts de recherche pour évaluer la visibilité IA d'une entreprise locale.
Chaque prompt reproduit EXACTEMENT ce qu'un vrai utilisateur taperait dans ChatGPT ou Perplexity pour résoudre un besoin concret.

## RÈGLE #1 — COMME UNE VRAIE RECHERCHE

Écris chaque prompt comme si TU étais la personne qui cherche. Pas comme un marketeur, pas comme un consultant.
- Longueur naturelle : 8 à 25 mots. Certaines recherches sont courtes et directes, d'autres plus détaillées.
- ✅ « Comment faire apparaître mon entreprise dans les réponses de ChatGPT à Montréal ? »
- ✅ « J'ai besoin d'un plombier à Rosemont qui peut venir aujourd'hui pour une fuite »
- ✅ « Meilleur dentiste pour enfants à Laval avis récents »
- ❌ « Quels sont les critères holistiques de sélection d'un prestataire de services dentaires dans la région métropolitaine ? »

## RÈGLE #2 — LANGAGE NATUREL

- Parler comme un vrai québécois/canadien-français qui tape dans ChatGPT
- Tournures naturelles : « c'est quoi », « je cherche », « quelqu'un connaît », « est-ce que ça vaut la peine », « comment faire pour », « j'ai besoin de »
- INTERDIT : jargon marketing, tournures corporatives, ton publicitaire, vocabulaire technique non-utilisateur
- OK d'avoir des phrases incomplètes ou du style keyword si c'est naturel : « plombier urgence Laval prix »

## RÈGLE #3 — SPÉCIFICITÉ CONCRÈTE

- Chaque prompt inclut un VRAI scénario ou besoin spécifique
- Utiliser les services réels de l'entreprise et son contexte exact
- ❌ Générique : « Quel est le meilleur comptable à Montréal ? »
- ✅ Spécifique : « Je suis travailleur autonome à Montréal, j'ai besoin d'un comptable pour mes impôts et la TPS »

## RÈGLE #4 — ANCRAGE GÉOGRAPHIQUE

Chaque prompt contient un signal géo naturel : ville, quartier, région, ou « près de chez moi ».

## RÈGLE #5 — DIVERSITÉ

Les 7 prompts couvrent 7 angles DIFFÉRENTS. Aucun doublon conceptuel.

## LES 7 PROMPTS

### Prompt 1 — discovery (user_like)
La personne DÉCOUVRE le besoin. Elle explore, elle ne sait pas encore exactement ce qu'elle veut.
Exemples réalistes par domaine :
- Avocat : « Comment trouver un bon avocat en droit familial à Québec pour une garde partagée ? »
- SaaS : « Comment faire pour que mon entreprise apparaisse dans les réponses de ChatGPT à Montréal ? »
- Resto : « Quel restaurant à Sherbrooke pour un souper d'anniversaire avec un bon rapport qualité-prix ? »

### Prompt 2 — brand (user_like)
La personne ÉVALUE spécifiquement CETTE entreprise. Elle a vu le nom quelque part et veut des avis.
OBLIGATION : mentionner le NOM EXACT de l'entreprise.
Exemples réalistes :
- « Est-ce que [Nom] à Montréal c'est fiable ? Quelqu'un a déjà utilisé leurs services ? »
- « Avis sur [Nom] à Laval, est-ce que ça vaut le prix ? »
- « [Nom] Montréal reviews, c'est bien pour [service spécifique] ? »

### Prompt 3 — competitor (user_like)
La personne COMPARE les options disponibles. Elle veut choisir entre plusieurs.
NE PAS mentionner le nom de l'entreprise.
Exemples réalistes :
- « Quelles sont les meilleures agences de marketing digital à Montréal pour les PME ? »
- « Meilleurs plombiers à Longueuil comparaison des prix et services »
- « Alternatives à [type service] à Québec, lequel choisir en 2025 ? »

### Prompt 4 — pricing (user_like)
La personne veut comprendre les COÛTS avant de s'engager. Perspective budget.
Exemples réalistes :
- « Combien ça coûte un avocat pour un divorce à Montréal en moyenne ? »
- « Prix d'un site web professionnel à Québec pour une petite entreprise »
- « C'est quoi un tarif normal pour [service] à Laval ? »

### Prompt 5 — buyer_guidance (user_like)
La personne veut savoir COMMENT bien choisir. Guide pratique pour ne pas se tromper.
Exemples réalistes :
- « Quoi vérifier avant d'engager un entrepreneur en rénovation à Montréal ? »
- « Questions à poser à un comptable avant de le choisir à Québec »
- « Comment savoir si une agence de visibilité IA est légitime à Montréal ? »

### Prompt 6 — implementation (operator_probe)
Post-décision. La personne a choisi et veut comprendre comment ça va se passer concrètement.
COMMENCE par un verbe d'action (Donne, Liste, Explique, Décris).
Exemples réalistes :
- « Explique les étapes pour implanter une stratégie de visibilité IA pour un commerce à Montréal »
- « Donne le processus typique quand on engage un [type prestataire] à Québec »
- « Liste ce qu'il faut préparer avant un premier rendez-vous avec un [type prestataire] à Laval »

### Prompt 7 — competitor (operator_probe)
Comparaison analytique structurée.
COMMENCE par un verbe d'action (Compare, Évalue, Analyse, Classe).
Exemples réalistes :
- « Compare les différentes options de [service] à Montréal avec les avantages de chacune »
- « Évalue les principales entreprises de [domaine] à Québec et leurs forces respectives »
- « Analyse les alternatives en [domaine] à Laval et ce qui les différencie »

## FORMAT DE SORTIE — JSON STRICT

Réponds UNIQUEMENT avec un tableau JSON de 7 objets. Aucun texte avant/après, aucun markdown.

[{"query_text":"le prompt exact","intent_family":"discovery","prompt_mode":"user_like","rationale":"1 phrase sur pourquoi ce prompt capte une vraie intention de recherche"}]

intent_family : discovery, brand, competitor, pricing, buyer_guidance, implementation
prompt_mode : user_like (prompts 1 à 5), operator_probe (prompts 6 et 7)

## AUTO-VÉRIFICATION

Pour CHAQUE prompt, vérifie :
1. ✅ Est-ce qu'une vraie personne taperait ÇA dans ChatGPT ? Si ça sonne corporate ou artificiel, REFORMULE.
2. ✅ Ancrage géographique présent ?
3. ✅ Prompt brand → contient le nom exact de l'entreprise ?
4. ✅ Prompt competitor → NE contient PAS le nom de l'entreprise ?
5. ✅ Mode operator_probe → COMMENCE par un verbe d'action ?
6. ✅ Pas de doublon conceptuel avec les autres prompts ?
7. ✅ Entre 8 et 25 mots ?

## STRICTEMENT INTERDIT

- Prompts que personne ne taperait jamais dans la vraie vie
- Jargon technique (SEO, GEO, schema.org, tracking, indexation, conversion)
- Mentionner le nom de l'entreprise SAUF pour brand
- Copier-coller les exemples — adapte CHAQUE prompt au secteur réel de l'entreprise`;
}

function buildUserMessage(data) {
    const parts = [
        `## Entreprise à évaluer`,
        `Nom : ${data.business_name}`,
    ];
    if (data.business_type) parts.push(`Type d'entreprise : ${data.business_type}`);
    if (data.classification_label) parts.push(`Classification détectée : ${data.classification_label}`);
    if (data.city) parts.push(`Ville principale : ${data.city}`);
    if (data.target_region) parts.push(`Région cible : ${data.target_region}`);
    if (data.seo_description) parts.push(`Description SEO : ${data.seo_description}`);
    if (data.services) parts.push(`Services offerts : ${data.services}`);
    if (data.short_description) parts.push(`Résumé d'activité : ${data.short_description}`);
    if (data.areas_served) parts.push(`Zones desservies : ${data.areas_served}`);
    parts.push(`\nGénère les 7 prompts GEO optimaux pour cette entreprise. Adapte chaque prompt au secteur d'activité, aux services réels et au contexte géographique.`);
    return parts.join('\n');
}

function buildServicesPrompt(data) {
    return `Tu es un expert en classification d'entreprises. Analyse les informations ci-dessous et liste les services principaux offerts par cette entreprise.

## Entreprise
Nom : ${data.business_name}
${data.business_type ? `Type : ${data.business_type}` : ''}
${data.classification_label ? `Classification : ${data.classification_label}` : ''}
${data.seo_description ? `Description : ${data.seo_description}` : ''}
${data.short_description ? `Résumé : ${data.short_description}` : ''}
${data.city ? `Ville : ${data.city}` : ''}

## CONSIGNES
- Retourne un tableau JSON de 4 à 8 services concis (2-5 mots chacun)
- En français canadien
- Spécifiques au secteur d'activité réel de l'entreprise
- Pas de services génériques — chaque service doit refléter l'expertise réelle

Réponds UNIQUEMENT avec un tableau JSON de chaînes de caractères, sans texte avant ni après.
Exemple : ["Service A","Service B","Service C"]`;
}

function validatePromptArray(data) {
    if (!Array.isArray(data)) return null;
    const valid = data
        .filter((item) => item && typeof item.query_text === 'string' && item.query_text.trim().length >= 8)
        .map((item) => ({
            query_text: item.query_text.trim().replace(/^["«»]+|["«»]+$/g, ''),
            intent_family: VALID_INTENT_FAMILIES.has(item.intent_family) ? item.intent_family : 'discovery',
            prompt_mode: VALID_MODES.has(item.prompt_mode) ? item.prompt_mode : 'user_like',
            rationale: String(item.rationale || '').trim(),
        }));
    return valid.length >= 4 ? valid : null;
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

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    try {
        const result = await callAiJson({
            messages: [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: buildUserMessage(parsed.data) },
            ],
            purpose: 'onboarding',
            temperature: 0.6,
            maxTokens: 2048,
            providerOverride: 'mistral',
            fallbackProvider: 'gemini',
        });

        const rawPrompts = validatePromptArray(result.data);
        if (!rawPrompts) {
            return NextResponse.json({ error: 'Format IA invalide' }, { status: 502 });
        }

        const prompts = rawPrompts.map((item, index) => {
            const contract = buildCanonicalPromptContract({
                queryText: item.query_text,
                clientName: parsed.data.business_name,
                city: parsed.data.city || '',
                region: parsed.data.target_region || '',
                locale: 'fr-CA',
                promptOrigin: 'mistral_generated',
                intentFamily: item.intent_family,
                promptMode: item.prompt_mode,
            });

            return {
                id: `ai-${item.intent_family}-${index}`,
                query_text: contract.query_text,
                intent_family: contract.intent_family,
                prompt_mode: contract.prompt_mode,
                category: item.intent_family === 'brand' ? 'brand'
                    : item.intent_family === 'competitor' ? 'competitor_comparison'
                    : 'discovery',
                locale: 'fr-CA',
                rationale: item.rationale,
                quality_status: contract.quality_status,
                quality_score: contract.quality_score,
                quality_reasons: contract.quality_reasons,
                validation: {
                    status: contract.validation_status,
                    is_valid: contract.is_valid,
                    reasons: contract.validation_reasons,
                },
                is_valid: contract.is_valid,
                is_selected: contract.is_selected_default,
                offer_anchor: contract.offer_anchor || '',
                offer_label_normalized: '',
                user_visible_offering: contract.user_visible_offering || '',
                prompt_origin: 'mistral_generated',
            };
        });

        let suggested_services = null;
        if (parsed.data.needs_services) {
            try {
                const svcResult = await callAiJson({
                    messages: [{ role: 'user', content: buildServicesPrompt(parsed.data) }],
                    purpose: 'onboarding',
                    temperature: 0.4,
                    maxTokens: 256,
                    providerOverride: 'mistral',
                    fallbackProvider: 'gemini',
                });
                if (Array.isArray(svcResult.data)) {
                    suggested_services = svcResult.data
                        .filter((s) => typeof s === 'string' && s.trim().length >= 2)
                        .map((s) => s.trim())
                        .slice(0, 8);
                }
            } catch (error) {
                console.warn('[generate-prompts] service suggestion failed:', error.message);
            }
        }

        return NextResponse.json({
            prompts,
            suggested_services,
            provider: result.provider || 'mistral',
            model: result.model || null,
        });
    } catch (error) {
        console.error('[generate-prompts]', error);
        return NextResponse.json({ error: 'Echec generation IA' }, { status: 502 });
    }
}
