export class CorrectionPromptValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'CorrectionPromptValidationError';
        this.details = Array.isArray(details) ? details : [String(details)];
    }
}

const SECTION_LABELS = [
    ['mission', 'Mission'],
    ['contexte', 'Contexte'],
    ['problemeDetecte', 'Probleme detecte'],
    ['preuveDisponible', 'Preuve disponible'],
    ['impactAttendu', 'Impact attendu'],
    ['fichiersOuSurfacesAInspecter', 'Fichiers / surfaces a inspecter'],
    ['contraintesAbsolues', 'Contraintes absolues'],
    ['ceQueLiaDoitFaire', "Ce que l'IA doit faire"],
    ['ceQueLiaNeDoitPasFaire', "Ce que l'IA ne doit pas faire"],
    ['validationAttendue', 'Validation attendue'],
    ['formatDuLivrableFinal', 'Format du livrable final'],
];

const STRING_SECTION_KEYS = new Set([
    'mission',
    'contexte',
    'problemeDetecte',
    'impactAttendu',
]);

function normalizeLine(value) {
    return String(value || '').trim();
}

function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeLine(value)).filter(Boolean))];
}

function normalizeList(values) {
    return uniqueStrings(values);
}

function humanizeKey(value) {
    return String(value || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim();
}

function flattenStructuredValue(value, prefix = '') {
    if (value === null || value === undefined) return [];

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const normalized = normalizeLine(value);
        if (!normalized) return [];
        return [prefix ? `${prefix}: ${normalized}` : normalized];
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) => flattenStructuredValue(item, prefix));
    }

    if (typeof value === 'object') {
        return Object.entries(value).flatMap(([key, nestedValue]) => {
            const nextPrefix = prefix ? `${prefix}.${humanizeKey(key)}` : humanizeKey(key);
            return flattenStructuredValue(nestedValue, nextPrefix);
        });
    }

    return [];
}

function normalizeListLike(value) {
    return normalizeList(flattenStructuredValue(value));
}

function normalizeTextLike(value) {
    if (typeof value === 'string') return normalizeLine(value);

    return normalizeListLike(value).join(' ');
}

function assertVariant(variantName, variant) {
    const details = [];

    for (const [key, label] of SECTION_LABELS) {
        const value = variant?.[key];
        if (typeof value === 'string') {
            if (!normalizeLine(value)) details.push(`${variantName}.${label}: section vide`);
            continue;
        }

        const list = normalizeList(value);
        if (list.length === 0) details.push(`${variantName}.${label}: section vide`);
    }

    if (details.length > 0) {
        throw new CorrectionPromptValidationError(
            `Le prompt ${variantName} est invalide. ${details.join(' | ')}`,
            details,
        );
    }
}

export function assertCorrectionPromptPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new CorrectionPromptValidationError('Le payload de prompt est absent.');
    }

    assertVariant('standard', payload.standard);
    assertVariant('strict', payload.strict);
}

function renderBlock(value) {
    if (typeof value === 'string') return normalizeLine(value);

    const list = normalizeList(value);
    return list.map((item) => `- ${item}`).join('\n');
}

export function renderCorrectionPromptVariant(variant) {
    const blocks = SECTION_LABELS.map(([key, label]) => {
        const rendered = renderBlock(variant?.[key]);
        return `${label}\n${rendered}`;
    });

    const missingData = normalizeList(variant?.donneesManquantes);
    if (missingData.length > 0) {
        blocks.push(`Donnees manquantes\n${missingData.map((item) => `- ${item}`).join('\n')}`);
    }

    return blocks.join('\n\n').trim();
}

function describeTruthState(value) {
    const normalized = normalizeLine(value).toLowerCase();
    if (normalized === 'observed') return 'observe';
    if (normalized === 'derived') return 'calcule';
    if (normalized === 'inferred') return 'infere';
    if (normalized === 'recommended') return 'recommande';
    return 'indisponible';
}

function buildRepoFactsSentence(context) {
    const repoFacts = normalizeList(context?.repoFacts).slice(0, 2);
    if (repoFacts.length === 0) {
        return "Aucun chemin supplementaire n'a pu etre confirme automatiquement au moment de la generation.";
    }

    return repoFacts.join(' ');
}

function buildEvidenceList(context) {
    const items = [];
    const truthLabel = describeTruthState(context?.problem?.truthState);
    const summary = normalizeLine(context?.evidence?.summary);
    const sourceUrl = normalizeLine(context?.evidence?.sourceUrl);
    const confidence = normalizeLine(context?.problem?.confidence);

    if (summary) {
        items.push(`Preuve audit ${truthLabel}: ${summary}`);
    }

    if (sourceUrl) {
        items.push(`URL observee: ${sourceUrl}`);
    }

    if (confidence) {
        items.push(`Confiance actuelle: ${confidence}`);
    }

    normalizeList(context?.repoFacts)
        .slice(0, 2)
        .forEach((item) => items.push(`Repere repo verifie: ${item}`));

    return normalizeList(items);
}

function buildConstraints(context, strict) {
    const base = normalizeList(context?.constraints?.absolute);
    const extras = strict
        ? [
            'N utiliser en premiere passe que les chemins verifies fournis par le contexte.',
            'Si aucune surface verifiee ne confirme le probleme, l ecrire clairement avant d elargir la recherche.',
        ]
        : [
            'Commencer par les chemins verifies et la route observee avant toute exploration plus large.',
        ];

    return normalizeList([...base, ...extras]);
}

function buildMustDo(context, strict) {
    const verifiedPaths = normalizeList(context?.verifiedPaths);
    const sourceUrl = normalizeLine(context?.evidence?.sourceUrl);
    const categoryInstruction = normalizeLine(context?.constraints?.categoryInstruction);
    const recommendedFix = normalizeLine(context?.evidence?.recommendedFix);
    const items = [];

    if (verifiedPaths.length > 0) {
        items.push(`Inspecter d abord les chemins verifies suivants: ${verifiedPaths.join(', ')}.`);
    } else {
        items.push("Identifier dans le repo la surface la plus probable avant toute modification, puis confirmer qu'elle produit bien le signal observe.");
    }

    items.push(sourceUrl
        ? `Confirmer dans le code quel fichier ou helper produit reellement le signal observe sur ${sourceUrl}.`
        : 'Confirmer dans le code quel fichier ou helper produit reellement le signal observe.');

    if (categoryInstruction) {
        items.push(categoryInstruction);
    }

    if (recommendedFix && !recommendedFix.toLowerCase().includes('indisponible')) {
        items.push(`Appliquer un correctif minimal coherent avec la piste deja suggeree par la source: ${recommendedFix}`);
    } else {
        items.push('Appliquer un correctif minimal directement relie a la preuve audit ou expliquer honnetement pourquoi le probleme ne se reproduit pas dans le code actuel.');
    }

    items.push('Verifier le rendu ou la route observee apres correction et noter le resultat dans le livrable.');

    if (strict) {
        items.push("Si une seule surface source suffit, limiter la modification a cette surface.");
        items.push("Si la preuve d'audit contredit le repo, arreter l'escalade et formuler le constat honnetement au lieu d'inventer une cause.");
    }

    return normalizeList(items);
}

function buildMustNotDo(context, strict) {
    const items = [
        'Ne pas inventer de fichiers, de routes, de pages, de donnees ou de certitudes absentes du contexte.',
        'Ne pas traiter le probleme comme sitewide sans preuve dans le code ou dans la preuve audit.',
        'Ne pas lancer de refonte SEO globale, de migration, ni de chantier hors SEO Health.',
        'Ne pas imposer un outil externe tiers ou une URL externe comme condition de reussite.',
        'Ne pas creer une nouvelle surface publique simplement parce que son nom semble plausible dans ce repo.',
    ];

    if (strict) {
        items.push('Ne pas masquer les hypotheses restantes: les ecrire explicitement dans le livrable final.');
    }

    return normalizeList(items);
}

function buildValidation(context, strict) {
    const items = normalizeList(context?.validationTargets);

    items.push('Confirmer que la preuve initiale est corrigee ou expliquer clairement pourquoi elle ne se reproduit pas.');

    if (strict) {
        items.push('Verifier que les fichiers effectivement modifies sont les seuls necessaires a la correction.');
    }

    return normalizeList(items);
}

function buildDeliveryFormat(strict) {
    const items = [
        'Lister les fichiers reels inspectes, puis les fichiers reels modifies.',
        'Expliquer la cause confirmee dans le code ou dire honnetement si elle reste non confirmee.',
        'Decrire le correctif minimal applique.',
        'Resumer la validation executee et son resultat.',
        'Signaler les donnees manquantes, hypotheses restantes et risques de regression eventuels.',
    ];

    if (strict) {
        items.push('Nommer explicitement les verifications non executees et pourquoi.');
    }

    return normalizeList(items);
}

function buildDeterministicVariant(context, variantName) {
    const strict = variantName === 'strict';
    const title = normalizeLine(context?.problem?.title) || 'Probleme detecte';
    const description = normalizeLine(context?.problem?.description) || title;
    const sourceUrl = normalizeLine(context?.evidence?.sourceUrl);
    const truthLabel = describeTruthState(context?.problem?.truthState);
    const confidence = normalizeLine(context?.problem?.confidence) || 'indisponible';
    const repoFactsSentence = buildRepoFactsSentence(context);
    const recommendedFix = normalizeLine(context?.evidence?.recommendedFix);

    return {
        mission: strict
            ? `Inspecter puis corriger strictement le probleme SEO Health « ${title} »${sourceUrl ? ` observe sur ${sourceUrl}` : ''}, avec un correctif minimal, trace et limite aux surfaces confirmees.`
            : `Inspecter puis corriger le probleme SEO Health « ${title} »${sourceUrl ? ` observe sur ${sourceUrl}` : ''}, avec un correctif minimal relie a la preuve audit et au flux reellement responsable.`,
        contexte: strict
            ? `La surface pilote SEO Health classe ce signal comme ${truthLabel} avec une confiance ${confidence}. Repere repo: ${repoFactsSentence} Si le repo contredit la preuve audit, il faut le signaler clairement avant toute correction large.`
            : `La surface pilote SEO Health classe ce signal comme ${truthLabel} avec une confiance ${confidence}. Repere repo: ${repoFactsSentence}`,
        problemeDetecte: `${description}${sourceUrl ? ` Surface observee: ${sourceUrl}.` : ''}`,
        preuveDisponible: buildEvidenceList(context),
        impactAttendu: recommendedFix && !recommendedFix.toLowerCase().includes('indisponible')
            ? `Obtenir un correctif minimal qui traite la preuve observee et aligne le rendu ou la route concernee. Piste issue de la source: ${recommendedFix}`
            : 'Obtenir un correctif minimal qui traite la preuve observee ou, si le probleme ne se reproduit pas dans le code actuel, le documenter honnetement sans inventer de cause.',
        fichiersOuSurfacesAInspecter: normalizeList(context?.inspectionTargets),
        contraintesAbsolues: buildConstraints(context, strict),
        ceQueLiaDoitFaire: buildMustDo(context, strict),
        ceQueLiaNeDoitPasFaire: buildMustNotDo(context, strict),
        validationAttendue: buildValidation(context, strict),
        formatDuLivrableFinal: buildDeliveryFormat(strict),
        donneesManquantes: normalizeList(context?.missingFields),
    };
}

function extractRepoPaths(value) {
    return String(value || '').match(/\b(?:app|components|lib|public)\/[A-Za-z0-9_./[\]-]+\b/g) || [];
}

function listItemUsesOnlyVerifiedPaths(item, verifiedPaths) {
    const referencedPaths = extractRepoPaths(item);
    if (referencedPaths.length === 0) return true;
    if (!Array.isArray(verifiedPaths) || verifiedPaths.length === 0) return false;

    return referencedPaths.every((candidate) => verifiedPaths.includes(candidate));
}

function sanitizeGeneratedList(value, { verifiedPaths = [], allowExternalUrls = false } = {}) {
    return normalizeListLike(value).filter((item) => {
        if (!allowExternalUrls && /(https?:\/\/|technicalseo\.com|google'?s robots|google robots)/i.test(item)) {
            return false;
        }

        return listItemUsesOnlyVerifiedPaths(item, verifiedPaths);
    });
}

function mergeUnique(base, extras) {
    return normalizeList([...(Array.isArray(base) ? base : []), ...(Array.isArray(extras) ? extras : [])]);
}

function preferText(value, fallback) {
    const normalized = normalizeTextLike(value);
    return normalized || fallback;
}

function coerceLooseVariant(variant) {
    const output = {};

    for (const [key] of SECTION_LABELS) {
        if (STRING_SECTION_KEYS.has(key)) {
            output[key] = normalizeTextLike(variant?.[key]);
        } else {
            output[key] = normalizeListLike(variant?.[key]);
        }
    }

    output.donneesManquantes = normalizeListLike(variant?.donneesManquantes);
    return output;
}

function mergeWithContext(context, variantName, rawVariant) {
    const fallback = buildDeterministicVariant(context, variantName);
    const verifiedPaths = normalizeList(context?.verifiedPaths);

    return {
        mission: preferText(rawVariant?.mission, fallback.mission),
        contexte: preferText(rawVariant?.contexte, fallback.contexte),
        problemeDetecte: preferText(rawVariant?.problemeDetecte, fallback.problemeDetecte),
        preuveDisponible: fallback.preuveDisponible,
        impactAttendu: preferText(rawVariant?.impactAttendu, fallback.impactAttendu),
        fichiersOuSurfacesAInspecter: fallback.fichiersOuSurfacesAInspecter,
        contraintesAbsolues: mergeUnique(
            fallback.contraintesAbsolues,
            sanitizeGeneratedList(rawVariant?.contraintesAbsolues, { verifiedPaths }),
        ),
        ceQueLiaDoitFaire: mergeUnique(
            fallback.ceQueLiaDoitFaire,
            sanitizeGeneratedList(rawVariant?.ceQueLiaDoitFaire, { verifiedPaths }),
        ),
        ceQueLiaNeDoitPasFaire: mergeUnique(
            fallback.ceQueLiaNeDoitPasFaire,
            sanitizeGeneratedList(rawVariant?.ceQueLiaNeDoitPasFaire, { verifiedPaths }),
        ),
        validationAttendue: mergeUnique(
            fallback.validationAttendue,
            sanitizeGeneratedList(rawVariant?.validationAttendue, { verifiedPaths, allowExternalUrls: false }),
        ),
        formatDuLivrableFinal: fallback.formatDuLivrableFinal,
        donneesManquantes: mergeUnique(
            fallback.donneesManquantes,
            normalizeListLike(rawVariant?.donneesManquantes),
        ),
    };
}

export function finalizeCorrectionPromptPayload(payload, context = null) {
    const finalized = context
        ? {
            standard: mergeWithContext(context, 'standard', payload?.standard),
            strict: mergeWithContext(context, 'strict', payload?.strict),
        }
        : {
            standard: coerceLooseVariant(payload?.standard),
            strict: coerceLooseVariant(payload?.strict),
        };

    assertCorrectionPromptPayload(finalized);

    return {
        standard: {
            ...finalized.standard,
            text: renderCorrectionPromptVariant(finalized.standard),
        },
        strict: {
            ...finalized.strict,
            text: renderCorrectionPromptVariant(finalized.strict),
        },
    };
}
