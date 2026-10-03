# GEO Compare (outil interne)

Application dormante : les appels fournisseurs, grounding web et extractions URL ne doivent pas être déclenchés pendant cette consolidation.

## Où se trouve le module

- Admin: `/admin/geo-compare`
- Workspace client canonique: `/admin/clients/[id]/geo/compare` ; ancien `/geo-compare` conservé comme alias.
- Navigation: section `Outils GEO` dans la sidebar admin.

## À quoi sert le module

- Comparer Gemini, Groq et Mistral sur une même requête GEO.
- Diagnostiquer la qualité des réponses pour calibration prompts:
  - citations / URLs
  - concurrents
  - mention marque cible
  - exploitabilité du signal

## Différence avec le moteur GEO standard

- `GEO Compare` = outil de calibration interne ponctuelle.
- Moteur GEO standard = runs persistés et pipeline opérateur client.
- Le module n altère pas `run-tracked-queries` ni les runs standards.

## Workflow dans un environnement explicitement autorisé

1. En mode client, sélectionner un prompt suivi actif (ou passer en prompt libre).
2. Utiliser l URL du site/page comme source principale.
3. N utiliser le texte brut qu en mode expert.
4. Vérifier signal par provider (citations, concurrents, marque).
5. Lire la synthèse comparative et les hints calibration.
6. Décider:
   - garder le prompt
   - le réécrire
   - le classer benchmark-only
   - le rejeter

## Bonnes pratiques opérateur

- Privilégier le mode client-linked pour calibration réelle.
- Éviter les prompts trop vagues (faible signal multi-provider).
- Surveiller les succès partiels et ne pas surinterpréter un provider en erreur.


## API de comparaison

Route server-side: `POST /api/admin/llm-compare`

## Payload

```json
{
  "source_type": "url",
  "url": "https://example.com/article",
  "prompt": "Resume les points cles et les risques SEO",
  "provider_timeout_ms": 30000,
  "max_content_chars": 16000,
  "enable_google_grounding": true
}
```

Ou en texte brut:

```json
{
  "source_type": "text",
  "text": "Contenu brut a comparer...",
  "prompt": "Synthese comparative en 5 points"
}
```

## Variables d environnement

- `GOOGLE_API_KEY` (fallback accepte `GEMINI_API_KEY`)
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`
- `OPENROUTER_API_KEY` (optionnel, provider alternatif global)
- `GOOGLE_SEARCH_API_KEY` (optionnel, pour Google Programmable Search)
- `GOOGLE_SEARCH_ENGINE_ID` (optionnel, pour Google Programmable Search)
- `TAVILY_API_KEY` (fallback web grounding si Google Search non configuré)
- `GOOGLE_MODEL_COMPARE` (fallback `GEMINI_MODEL_COMPARE`)
- `GROQ_MODEL_COMPARE`
- `MISTRAL_MODEL_COMPARE`
- `OPENROUTER_MODEL_QUERY`
- `OPENROUTER_MODEL_AUDIT`
- `OPENROUTER_MODEL_BENCHMARK`

## Contrat de reponse

- `contract_version` (actuellement `v1`)
- `input.source_type`, `input.url`, `input.prompt`, `input.content_preview`
- `grounding.enabled`, `grounding.used_provider`, `grounding.results_count`, `grounding.error`
- `results[]` avec:
  - `provider`, `model`
  - `ok`, `status`
  - `latency_ms`
  - `usage`
  - `content`
  - `error` (`{ class, message }` en cas d echec)

## Notes d integration

- Execution providers en `Promise.allSettled` pour supporter les erreurs partielles.
- Grounding web commun injecte avant execution pour donner le meme contexte web aux 3 providers.
- Mistral est cadence via une queue memoire (`1 req/s`) sans impacter Gemini/Groq.
- Aucun secret API n est expose dans la sortie JSON.
