# Tâches IA — architecture

`src/lib/ai/tasks/` est implémenté dans l’application dormante et réutilise `callAiJson`/`callAiText` de `src/lib/ai/index.js`. Chaque tâche configure son fournisseur ; aucune deuxième abstraction de fournisseurs.

`registry.js` expose `registerTask`, `getTask`, `executeTask`. Une définition contient identifiant, mode texte/JSON, fournisseur/fallback, paramètres, messages, schéma de sortie et normalisation. L’exécution valide la réponse, normalise et retourne données, metadata et validation. Les assertions restent spécifiques à la tâche.

`log.js` persiste `ai_task_runs` : client, tâche, fournisseur/modèle, lifecycle, résumés, usage, latence, erreur, validation, trigger et parent éventuel. Les migrations restent la référence SQL, sans copier le DDL d’un ancien plan dans une histoire parallèle.

`community-classify`, `community-labels`, `community-synthesize` enrichissent mentions, labels et opportunités. `COMMUNITY_USE_LLM_ENRICHMENT` contrôle l’usage LLM dans la pipeline. Les fallbacks déterministes conservent méthode, provenance et niveau de preuve.

Une validation partielle, un fournisseur indisponible ou un échec de journalisation ne prouve pas une collecte réussie. Préserver limites, rate limiter, timeouts, Zod et feedback. Ne pas exposer secrets, contenu sensible ou SQL au portail.

Les mocks locaux ne valident ni consentement de connecteur, ni catalogue distant, ni réponse Mistral réelle. Aucun appel payant ou reprise de service n’est nécessaire à la review de cette architecture.
