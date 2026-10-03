# Contrat prompt canonique

Contrat de l’application dormante, commun à onboarding, starter pack, create/update et projection opérateur. Les migrations préservent les anciennes lignes ; cette note ne prouve pas l’état d’une base distante.

## Responsabilités

- `src/lib/queries/onboarding-prompt-contract.js` : builder et évaluation contextualisée.
- `src/lib/queries/prompt-intelligence.js` : wrappers de qualification partagés.
- `src/lib/queries/prompt-contract-persistence.js` : `PROMPT_CONTRACT_DB_FIELDS`, sérialisation et désérialisation.
- `src/lib/operator-intelligence/prompts.js` : blueprints, starter pack et `getPromptSlice`.
- `src/lib/onboarding/client-onboarding.js` : préparation et activation.
- `src/lib/db/tracked-queries.js` : accès ciblé aux prompts.
- `src/app/api/admin/queries/create/route.js` et `update/route.js` : validation serveur.

## Sémantique

`query_text` et locale identifient la requête. `prompt_mode` distingue `user_like` et `operator_probe`. `quality_status` et `validation_status` restent cohérents : `strong/review/weak`. Le contrat calcule score/raisons, famille d’intention, origine, funnel, scopes géographique/marque/comparaison et ancrage d’offre.

`strong` est sélectionnable par défaut ; `review` est visible sans sélection implicite ; `weak` bloque l’activation. `is_valid`, `is_selected_default`, `activation_blocked` sont dérivés du contrat, pas d’un validateur onboarding concurrent. Ne pas exiger comparaison/preuves/structure pour toutes les intentions ; ne pas injecter de labels internes dans les requêtes utilisateur.

## Persistence et formats historiques

`PROMPT_CONTRACT_DB_FIELDS` porte les champs structurants : origine, intention, qualité, scopes, modes/raisons, `offer_anchor`, `user_visible_offering`, `target_audience`, `primary_use_case`, `differentiation_angle`.

La sérialisation projette colonnes et metadata en conservant les metadata existantes. La lecture privilégie les colonnes présentes, puis `prompt_metadata` historique, puis le contrat recalculé. Les metadata gardent compatibilité et attributs évolutifs. Ne pas retirer ce fallback après une réorganisation d’imports.

Les migrations v2 ajoutent colonnes/contraintes/index et backfill depuis JSON ; aucune migration distante n’est autorisée pour ce chantier. Les tests vérifient les formes structurées et historiques.
