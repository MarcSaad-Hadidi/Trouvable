import 'server-only';

import { z } from 'zod';

import { finalizeCorrectionPromptPayload } from '@/lib/correction-prompts/render';

import { registerTask } from './registry.js';

const textSection = z.string().trim().min(12).max(2000);
const listItem = z.string().trim().min(8).max(500);

const promptVariantSchema = z.object({
    mission: textSection,
    contexte: textSection,
    problemeDetecte: textSection,
    preuveDisponible: z.array(listItem).min(1).max(8),
    impactAttendu: textSection,
    fichiersOuSurfacesAInspecter: z.array(listItem).min(1).max(10),
    contraintesAbsolues: z.array(listItem).min(1).max(12),
    ceQueLiaDoitFaire: z.array(listItem).min(1).max(12),
    ceQueLiaNeDoitPasFaire: z.array(listItem).min(1).max(12),
    validationAttendue: z.array(listItem).min(1).max(12),
    formatDuLivrableFinal: z.array(listItem).min(1).max(8),
    donneesManquantes: z.array(listItem).max(8).default([]),
});

const outputSchema = z.object({
    standard: promptVariantSchema,
    strict: promptVariantSchema,
});

function buildMessages(input) {
    const contextJson = JSON.stringify(input.context, null, 2);

    return [
        {
            role: 'system',
            content: [
                "Tu rediges des prompts premium pour un agent IA de code qui travaille dans le repo Trouvable.",
                "Ton role n'est PAS de detecter le probleme: le systeme te fournit deja le probleme reel, le contexte reel et la preuve reelle.",
                '',
                'Regles absolues:',
                '- Utilise uniquement les informations presentes dans le contexte deterministic fourni.',
                '- N invente jamais une preuve, une URL, un fichier, une route ou une certitude absente.',
                '- Si une information manque, indique-la honnetement dans `donneesManquantes` et formule les consignes avec prudence.',
                "- Le prompt doit demander a l'agent d'inspecter le code existant avant de modifier quoi que ce soit.",
                "- Le prompt doit etre actionnable pour une correction dans ce repo, pas un diagnostic theorique.",
                '- Les champs de liste doivent TOUJOURS etre des tableaux JSON de chaines: jamais un objet, jamais une chaine simple.',
                '- `preuveDisponible`, `fichiersOuSurfacesAInspecter`, `contraintesAbsolues`, `ceQueLiaDoitFaire`, `ceQueLiaNeDoitPasFaire`, `validationAttendue`, `formatDuLivrableFinal` et `donneesManquantes` doivent etre des tableaux JSON de chaines.',
                '- `formatDuLivrableFinal` doit decrire des attentes de livrable en bullets, pas un schema objet imbrique.',
                '- Reutilise en priorite les `verifiedPaths`, `inspectionTargets`, `repoFacts` et `validationTargets` du contexte. N ajoute pas d autre chemin repo.',
                "- N'impose pas d'outil externe tiers, de site externe ou d'URL externe dans `validationAttendue` sauf si cette URL est deja presente dans le contexte deterministic.",
                '- Le prompt strict doit verrouiller davantage: inspect-first, fix minimal, pas de refactor hors perimetre, pas de donnees fictives, validation obligatoire.',
                '- Le prompt strict doit etre plus contraignant, pas seulement plus long.',
                '- Reponds en francais professionnel.',
                '- Reponds en JSON valide uniquement, sans markdown, sans commentaire.',
            ].join('\n'),
        },
        {
            role: 'user',
            content: [
                `Client: ${input.clientName || 'Client non renseigne'}`,
                `Probleme: ${input.problemTitle || 'Probleme non renseigne'}`,
                `Categorie de prompt: ${input.problemCategory || 'technical_issue'}`,
                `Verite principale: ${input.truthState || 'unavailable'}`,
                `URL observee: ${input.sourceUrl || 'indisponible'}`,
                `Instruction de categorie: ${input.categoryInstruction || 'Inspecter d abord les surfaces existantes.'}`,
                '',
                'Contexte deterministic complet:',
                contextJson,
                '',
                'Genere deux variantes de prompt:',
                '- `standard`: version premium, claire, actionnable, assez guidee.',
                '- `strict`: version plus verrouillee, plus prudente, avec contraintes plus fortes.',
                '',
                'Chaque variante doit obligatoirement contenir les sections suivantes:',
                '- mission',
                '- contexte',
                '- problemeDetecte',
                '- preuveDisponible',
                '- impactAttendu',
                '- fichiersOuSurfacesAInspecter',
                '- contraintesAbsolues',
                '- ceQueLiaDoitFaire',
                '- ceQueLiaNeDoitPasFaire',
                '- validationAttendue',
                '- formatDuLivrableFinal',
                '- donneesManquantes',
                '',
                'Contraintes de type JSON a respecter:',
                '- `mission`, `contexte`, `problemeDetecte`, `impactAttendu` = chaines',
                '- toutes les autres sections = tableaux JSON de chaines',
                '',
                'Format JSON attendu:',
                '{',
                '  "standard": {',
                '    "mission": "chaine",',
                '    "contexte": "chaine",',
                '    "problemeDetecte": "chaine",',
                '    "preuveDisponible": ["bullet 1", "bullet 2"],',
                '    "impactAttendu": "chaine",',
                '    "fichiersOuSurfacesAInspecter": ["chemin 1", "chemin 2"],',
                '    "contraintesAbsolues": ["contrainte 1"],',
                '    "ceQueLiaDoitFaire": ["action 1"],',
                '    "ceQueLiaNeDoitPasFaire": ["interdit 1"],',
                '    "validationAttendue": ["validation 1"],',
                '    "formatDuLivrableFinal": ["livrable 1"],',
                '    "donneesManquantes": ["manque 1"]',
                '  },',
                '  "strict": { ... meme structure ... }',
                '}',
            ].join('\n'),
        },
    ];
}

function normalize(raw, input) {
    return finalizeCorrectionPromptPayload(raw, input?.context || null);
}

registerTask({
    taskId: 'generate-correction-prompt',
    mode: 'json',
    provider: 'mistral',
    fallbackProvider: null,
    purpose: 'query',
    temperature: 0.15,
    maxTokens: 3200,
    buildMessages,
    outputSchema,
    normalize,
});
