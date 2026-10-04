# GEO Compare — calibration interne

GEO Compare compare les réponses de plusieurs fournisseurs pour inspecter citations, URLs, concurrents, mention cible et qualité du signal. Il reste distinct des runs GEO suivis et de leur historique. L'application est dormante : extraction URL, grounding web et appels fournisseurs exigent un environnement explicitement autorisé, selon la [procédure d'hibernation](operations/trouvable-hibernation.md).

## Parcours opérateur

Le module est accessible à `/admin/geo-compare` et, dans le contexte client, à `/admin/clients/[clientId]/geo/compare`. L'ancien chemin client `/geo-compare` reste un alias. La [vue](../src/features/admin/geo/GeoCompareView.tsx) permet de sélectionner un prompt suivi ou d'utiliser un prompt libre ; privilégier le contexte client et la source URL, puis examiner les signaux par fournisseur avant de garder, réécrire ou rejeter le prompt. Le texte brut reste un mode expert.

Un échec fournisseur n'est pas une absence de marché ; un succès partiel doit rester visible. Une comparaison interne ne prouve pas la parité avec l'expérience native d'une plateforme IA.

## API et exécution

La [route autorisée côté serveur](../src/app/api/admin/llm-compare/route.js) expose `POST /api/admin/llm-compare`. Exemple de payload, avec une URL illustrative :

```json
{
  "source_type": "url",
  "url": "https://example.com/article",
  "prompt": "Résume les points clés et les risques SEO",
  "provider_timeout_ms": 30000,
  "max_content_chars": 16000,
  "enable_google_grounding": true
}
```

Pour du contenu fourni directement, utiliser `source_type: "text"` et `text` au lieu de `url`. La route valide les entrées. Le [comparateur](../src/lib/llm-comparison/compare-models.js) extrait le contenu, ajoute un contexte web commun quand disponible, puis exécute les fournisseurs en `Promise.allSettled` avec timeout par fournisseur. La [liste canonique](../src/lib/llm-comparison/response-contract.js) comprend Gemini, Groq, Mistral et OpenRouter ; une clé manquante produit une erreur fournisseur, sans attester de connexion active. Mistral conserve sa queue mémoire dédiée, avec intervalle d'une seconde, sans imposer cette cadence aux autres fournisseurs.

La réponse `v1` contient `input` (source, URL, prompt, aperçu), `grounding` (activation, fournisseur utilisé, nombre de résultats, erreur) et `results[]` (fournisseur, modèle, succès/statut, latence, usage, contenu ou erreur structurée). Les erreurs sont nettoyées de secrets par le contrat de réponse.

## Configuration dans un environnement autorisé

| Usage | Variables consommées |
|---|---|
| Gemini | `GOOGLE_API_KEY` ou `GEMINI_API_KEY` ; `GOOGLE_MODEL_COMPARE` ou `GEMINI_MODEL_COMPARE`. |
| Groq | `GROQ_API_KEY`, `GROQ_MODEL_COMPARE`. |
| Mistral | `MISTRAL_API_KEY`, `MISTRAL_MODEL_COMPARE`. |
| OpenRouter | `OPENROUTER_API_KEY` ; `OPENROUTER_MODEL_COMPARE` ou `OPENROUTER_MODEL_QUERY`. |
| Grounding partagé | `GOOGLE_SEARCH_API_KEY` et `GOOGLE_SEARCH_ENGINE_ID`, avec repli `TAVILY_API_KEY`. |

Les modèles par défaut et priorités de configuration sont choisis par la couche d'adaptation appelée depuis le [comparateur](../src/lib/llm-comparison/compare-models.js). Aucun secret ne doit figurer dans les payloads, captures ou sorties JSON.

## Validation locale

Les [tests du comparateur](../src/lib/__tests__/llm-comparison.test.js) couvrent succès partiels et timeouts ; les [tests de route](../src/lib/__tests__/llm-compare-route.test.js) vérifient le contrat et l'absence de secrets. Les [insights](../src/lib/__tests__/geo-compare-insights.test.js) et le [formulaire](../src/lib/__tests__/geo-compare-form.test.js) ont leurs propres fixtures. Ces tests ne contactent pas les services réels.
