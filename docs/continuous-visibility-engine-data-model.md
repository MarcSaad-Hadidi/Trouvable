# Continuous Visibility Engine — modèle de données

Moteur implémenté dans l’application dormante. Aucun Cron Vercel actif ; ces contrats n’autorisent pas une exécution distante.

- `recurring_jobs` : définition client/type, cadence, retry, verrou et prochain run.
- `recurring_job_runs` : historique `pending/running/completed/failed/cancelled`, compteurs, erreur et résumé.
- `visibility_metric_snapshots` : points quotidiens client/date et tendances 7j/30j/90j.
- `client_data_connectors` : état par client/fournisseur. OAuth et synchronisations GA4/GSC sont implémentés, sans connexion distante attestée.

## Exécution et concurrence

Dans un environnement explicitement réactivé, dispatch sélectionne les jobs dus, insère les runs avec clé de déduplication, puis claim les runs disponibles. La finalisation met à jour état et prochaine cadence ; le succès permet un snapshot, l’échec applique retry/backoff dans son budget. La route snapshot peut capturer indépendamment les clients éligibles.

Sources : `src/lib/continuous/jobs.js`, `src/lib/continuous/metrics.js`, `src/app/api/cron/continuous/dispatch/route.js` et `src/app/api/cron/continuous/snapshot/route.js`.

- `dedupe_key` unique pour la queue.
- Index partiel des runs `running` par client/type, avec contrôle avant claim.
- Récupération des runs bloqués : requeue dans le budget, sinon échec finalisé.
- `CONTINUOUS_DAILY_FIRST_MODE=1` conserve le plancher de 24h dans `src/lib/continuous/mode.js` et les mises à jour de jobs.

La cadence est une politique applicative, pas un schedule actif. La [procédure d’hibernation](operations/trouvable-hibernation.md) régit toute reprise.

## Lecture et vérité

Les tendances sont calculées serveur depuis les snapshots : latest, previous, delta et fenêtres. L’admin conserve les détails ; le portail reçoit une synthèse sûre et scoped. Absence, erreur et vrai zéro restent distincts ; une observation partielle n’est pas une métrique complète.

`CONNECTOR_SAMPLE_MODE=1` expose `hasRealData: false` avec tableaux vides, sans résultats client fictifs. Une connexion configurée ne prouve ni consentement valide ni synchronisation réussie.
