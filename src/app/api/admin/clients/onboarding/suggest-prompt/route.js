import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { callAiText } from '@/lib/ai/index';

const suggestSchema = z.object({
    current_query: z.string().max(500).optional().or(z.literal('')),
    business_name: z.string().min(1).max(200),
    business_type: z.string().max(200).optional().or(z.literal('')),
    target_region: z.string().max(200).optional().or(z.literal('')),
    seo_description: z.string().max(1000).optional().or(z.literal('')),
    services: z.string().max(1000).optional().or(z.literal('')),
    intent_family: z.string().max(60).optional().or(z.literal('')),
    prompt_mode: z.string().max(60).optional().or(z.literal('')),
});

function buildSystemPrompt() {
    return `Tu es le principal expert mondial en GEO (Generative Engine Optimization) — la discipline qui optimise la visibilité d'une entreprise dans les réponses des IA conversationnelles.

Ta tâche : générer ou reformuler UN SEUL prompt de recherche qu'un utilisateur réel poserait à un assistant IA (ChatGPT, Perplexity, Gemini) pour trouver ou évaluer une entreprise locale.

## RÈGLE #1 — LONGUEUR STRICTE
12 à 28 mots. COMPTE les mots. Zone optimale : 15–22 mots.

## RÈGLE #2 — NATURALITÉ
Vocabulaire quotidien québécois/canadien-français. Pas de jargon marketing ni de ton publicitaire.

## RÈGLE #3 — VOCABULAIRE OBLIGATOIRE PAR INTENTION

- **discovery** : inclure au moins un → critères, questions, risques, preuves, checklist
- **brand** : DOIT mentionner le nom exact de l'entreprise + poser une vraie question (quel/quelle/comment/pourquoi/est-ce que)
- **competitor** : inclure AU MOINS UN mot de chaque groupe →
  Groupe A (comparaison) : comparer, alternatives, options, différence, différences, shortlist, versus, vs
  Groupe B (justification) : pourquoi, justifier, critères, preuves, sources, différences
- **pricing** : inclure au moins un → prix, tarif, frais, inclus, délais, conditions
- **buyer_guidance** : inclure au moins un → risques, questions, preuves, critères, checklist
- **implementation** : inclure au moins un → prérequis, étapes, indicateurs, KPI, délais, mise en œuvre, onboarding, post-signature

## RÈGLE #4 — MODE
- **user_like** : NE PAS commencer par Liste, Donne, Fais, Compare, Classe, Énumère → question naturelle
- **operator_probe** : COMMENCER par un verbe d'action → Donne, Liste, Compare, Classe, Évalue, Justifie, Explique

## RÈGLE #5 — GÉO
Chaque prompt DOIT contenir un signal géographique naturel (ville, quartier, région).

## RÈGLE #6 — BRAND
Ne mentionner le nom de l'entreprise QUE si l'intention est « brand ».

Si un prompt actuel est fourni, améliore-le radicalement tout en respectant TOUTES les règles ci-dessus. Sinon, génère un prompt nouveau.

Réponds UNIQUEMENT avec le texte du prompt, sans guillemets, sans explication.`;
}

function buildUserMessage(data) {
    const parts = [`Entreprise : ${data.business_name}`];
    if (data.business_type) parts.push(`Type : ${data.business_type}`);
    if (data.target_region) parts.push(`Région : ${data.target_region}`);
    if (data.seo_description) parts.push(`Description : ${data.seo_description}`);
    if (data.services) parts.push(`Services : ${data.services}`);
    if (data.intent_family) parts.push(`Intention : ${data.intent_family}`);
    if (data.prompt_mode) parts.push(`Mode : ${data.prompt_mode === 'operator_probe' ? 'sonde opérateur (plus technique)' : 'question utilisateur naturelle'}`);
    if (data.current_query) parts.push(`\nPrompt actuel (à améliorer) : ${data.current_query}`);
    else parts.push(`\nGénère un nouveau prompt de recherche pour cette entreprise.`);
    return parts.join('\n');
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

    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation', details: parsed.error.issues }, { status: 400 });
    }

    try {
        const result = await callAiText({
            messages: [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: buildUserMessage(parsed.data) },
            ],
            purpose: 'onboarding',
            temperature: 0.6,
            maxTokens: 200,
            providerOverride: 'mistral',
            fallbackProvider: 'gemini',
        });

        const suggestion = (result.text || '').trim().replace(/^["«»]+|["«»]+$/g, '');

        if (!suggestion) {
            return NextResponse.json({ error: 'Aucune suggestion generee' }, { status: 502 });
        }

        return NextResponse.json({
            suggestion,
            provider: result.provider || null,
        });
    } catch (error) {
        console.error('[suggest-prompt]', error);
        return NextResponse.json({ error: 'Echec generation IA' }, { status: 502 });
    }
}
