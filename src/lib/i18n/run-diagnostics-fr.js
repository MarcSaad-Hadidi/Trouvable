/**
 * Libellés opérateur pour diagnostics d'exécution GEO (codes machine → français clair).
 */

export const ZERO_CITATION_REASON_FR = {
    non_grounded_lane: 'Réponse sans URL détectable, le modèle n’a probablement pas cité de liens (ou sortie non “grounded”). Les citations sont extraites uniquement depuis des URLs présentes dans le texte.',
    no_source_detected: 'Aucune URL exploitable dans la réponse brute, impossible de matérialiser des sources.',
};

export const ZERO_COMPETITOR_REASON_FR = {
    only_generic_mentions: 'Des entreprises sont mentionnées mais sans signal “concurrent” assez fort (pas dans la liste déclarée, pas de reco explicite, pas de marqueurs type “vs / alternative”).',
    parser_low_confidence: 'Extraction peu fiable, avec trop peu de signaux structurés pour élever un concurrent au statut “confirmé”.',
    no_competitor_detected: 'Aucune entité classée concurrente : ajoutez des concurrents au profil ou utilisez des prompts “vs / alternatives”.',
    no_businesses_in_analysis: 'L’analyse structurée n’a pas listé d’autres businesses nommés, souvent à cause d’une réponse trop générique ou d’un échec partiel d’analyse.',
};

export const OPERATOR_REASON_CODE_FR = {
    NO_RESPONSE_TEXT: 'Pas de texte de réponse.',
    MISSING_STRUCTURED_ANALYSIS: 'Analyse JSON absente ou incomplète.',
    NO_STRUCTURED_BUSINESSES: 'Aucune entreprise structurée dans l’analyse.',
    NO_URLS_IN_RESPONSE: 'Aucune URL dans la réponse, alors que nos “citations” reposent sur des liens explicites.',
    CITATIONS_REQUIRE_URLS: 'Sans URL, le pipeline ne peut pas créer de lignes “source”.',
    TARGET_NOT_FOUND: 'La marque suivie n’apparaît pas clairement dans la réponse.',
    COMPETITORS_NEED_CONFIRMATION_OR_RECO: 'Mentions trop faibles pour être promues “concurrent” sans liste déclarée ou reco explicite.',
    NO_NAMED_ALTERNATIVES: 'Pas d’alternatives nommées détectées.',
    PARSE_PARTIAL: 'Parse partiel, signaux incomplets.',
    PARSE_FAILED: 'Parse en échec.',
    NON_GROUNDED_OR_NO_LINKS: 'Voie non ancrée web ou absence de liens dans le texte.',
    THIN_NAMED_LANDSCAPE: 'Paysage d’entités trop mince : souvent la cible seule, ou une analyse sans second nom, avec peu d’actions GEO ou concurrentielles exploitables sans relancer avec un prompt plus comparatif.',
};

export const RUN_SIGNAL_TIER_FR = {
    useful: 'Utile',
    low_yield: 'Peu exploitable',
    empty_signal: 'Sans signal exploitable',
};

const RUN_ERROR_PATTERNS_FR = [
    {
        test: /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i,
        format: (_, column, relation) => `Préparation d'exécution impossible : la colonne ${relation}.${column} est absente du schéma Supabase connecté.`,
    },
    {
        test: /api key/i,
        format: () => 'Échec fournisseur : clé API manquante ou invalide.',
    },
    {
        test: /rate limit|429/i,
        format: () => 'Échec fournisseur : limite de requêtes atteinte.',
    },
    {
        test: /timeout/i,
        format: () => 'Échec d\'exécution : délai dépassé côté fournisseur.',
    },
    {
        test: /parse|json/i,
        format: () => 'Échec d\'analyse : la réponse n\'a pas pu être parsée correctement.',
    },
    {
        test: /No active tracked prompts are available/i,
        format: () => 'Aucun prompt actif n\'est disponible pour cette exécution.',
    },
];

export function translateZeroCitationReason(code) {
    if (!code) return null;
    return ZERO_CITATION_REASON_FR[code] || code;
}

export function translateZeroCompetitorReason(code) {
    if (!code) return null;
    return ZERO_COMPETITOR_REASON_FR[code] || code;
}

export function translateOperatorReasonCode(code) {
    if (!code) return null;
    return OPERATOR_REASON_CODE_FR[code] || code;
}

export function translateRunSignalTier(tier) {
    if (!tier) return null;
    return RUN_SIGNAL_TIER_FR[tier] || tier;
}

export function translateRunErrorMessage(message) {
    if (!message) return null;

    for (const pattern of RUN_ERROR_PATTERNS_FR) {
        const match = String(message).match(pattern.test);
        if (match) {
            return pattern.format(...match);
        }
    }

    return 'Échec d\'exécution. Consultez l\'inspecteur pour le diagnostic technique.';
}
