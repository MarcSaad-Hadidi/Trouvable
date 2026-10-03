# Qualité inspectable des prompts et runs

Contrats de l’application dormante. Aucune exécution fournisseur ou collecte distante n’est impliquée par cette note.

## Qualification et capture

Le [contrat prompt](prompt-contract-unification.md) contextualisé est commun à onboarding, create/update et projection opérateur. La taxonomie distingue intention, origine, scope, locale et qualité ; un prompt faible reste bloqué selon le contrat existant. Voir [les décisions de schéma](phase-3-1-schema-decisions.md).

Les runs conservent prompt exact (`prompt_payload`), fournisseur/modèle/locale, réponse brute (`raw_response_full`), réponse normalisée, parse status/warnings/confidence, latence, usage, classe d’erreur, retry, version d’extraction, mode/variante et session benchmark éventuelle.

L’inspection utilise `/api/admin/geo/client/[id]/runs/[runId]`. Reparse travaille sur la sortie conservée ; rerun appelle un fournisseur et exige un environnement autorisé. Aucun secret ne doit apparaître dans l’API ou le portail.

## Extraction et preuve

`src/lib/queries/extraction-v2.js` distingue sortie littérale, parsing, normalisation et niveau de vérification. `parsed_success`, `parsed_partial`, `parsed_failed` décrivent le parsing, pas la vérité d’une citation externe.

URLs/domaines, alias concurrents, evidence spans et diagnostics gardent leur provenance. Une réponse terminée peut contenir peu de signal ; absence d’URL ne devient pas citation. Concurrents et mentions génériques restent distincts.

Les variantes internes (`src/lib/queries/engine-variants.js`) et `/api/admin/queries/benchmark` ne prouvent pas la parité avec ChatGPT, Claude ou Perplexity natifs. Une variante sans configuration échoue explicitement ; aucun résultat simulé ne vaut un résultat client.

## Validation et portail

`npm test` découvre JS/JSX/TS/TSX. Fixtures et tests d’extraction, prompt contract, parsing et provenance sous `src/lib/__tests__/` servent aux contrôles locaux. Les anciens scripts `check:extraction` et `check:eval` et le répertoire `tests/output` ne sont pas des commandes actuelles de `package.json`.

La politique daily-first demeure dans `src/lib/continuous/mode.js` ; les Crons sont désactivés. Le portail garde des résumés business-safe en lecture seule ; sorties brutes, warnings internes et détails benchmark restent opérateur.
