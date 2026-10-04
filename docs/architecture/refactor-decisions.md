# Décisions techniques et invariants

Ce document explique les frontières et invariants de l'application dormante. Les plans et diagnostics historiques restent dans Git. Aucun résultat distant, classement SEO ou succès de connecteur n'est déduit d'un plan ou d'un build.

## 1. Application dormante et parking

`src/` conserve l’application ; `parking/` porte la production statique. Le Hibernation Gate automatique protège ce contrat. Le job applicatif manuel de la même CI installe le lockfile et lance la vérification complète en série sans secrets de production ni déploiement. La CSP applicative autorise les besoins de Next/Clerk ; la CSP du parking interdit les scripts. Elles n’ont pas à être égales.

Une reprise de services, un Cron exceptionnel, une migration ou un appel fournisseur reste une opération distincte régie par les [documents d’exploitation](../operations/trouvable-hibernation.md).

## 2. Organisation par responsabilité

`src/app` garde le routage et les métadonnées ; `src/features` garde les univers public/admin/portal/espace/auth. Les composants partagés restent dans `src/components`, les moteurs dans `src/lib`. Le niveau `features/admin/dashboard` était décoratif : les sections opérateur sont directement sous `src/features/admin`.

Les routes Next imposées ne sont pas remplacées par un catch-all général. Les surfaces auth et espace restent séparées : l’une présente la connexion, l’autre oriente l’identité autorisée. Les wrappers de route utiles aux layouts, metadata et frontières serveur/client restent explicites.

Les accès `src/lib/db/*` ne réimportent pas les agrégations `operator-intelligence`. Les consommateurs importent le module du domaine requis ; supprimer la façade globale ne supprime pas les fallbacks de données historiques.

## 3. Données, identité et reconstruction SQL

`client_geo_profiles` est l’entité client de référence. Les lectures historiques conservent notamment les couples `public_email/email`, `short_desc/short_description` et `publication_status/is_published`, selon leurs normalisateurs et migrations. Ne pas déduire d’une colonne actuelle qu’aucun ancien format n’existe.

Le portail reste en lecture seule et résout le scope serveur depuis `clerk_user_id` ou une adresse Clerk vérifiée. Les données brutes opérateur, debug de parsing et détails internes ne sont pas exposés dans la restitution client. L’authentification seule ne vaut pas autorisation.

Les migrations ordonnées restent conservées. Les anciens `schema.sql` et `setup_*.sql` ne sont pas retirés : une reconstruction locale jetable et une comparaison du catalogue sont requises avant de déclarer leur remplacement démontré. La [réconciliation historique](../db-reconciliation-audit.md) documente contraintes, backfills et dérives possibles ; elle n’atteste pas l’état actuel d’une base distante.

## 4. Scores, preuve et provenance

Un score absent est indisponible ; un zéro réellement observé est valide. Aucun `NaN`, `Infinity`, booléen ou objet ne devient un score par coercition. Les priorités de lecture respectent le domaine et les formats anciens : score final communiqué au client, SEO, GEO et diagnostics par dimension ne deviennent pas un score universel.

Les métriques de visibilité sont des observations de runs suivis, avec échantillon et provenance. Une URL extraite n’est pas une validation externe de source ; une mention non cible n’est pas automatiquement un concurrent. Un benchmark interne ne prouve pas la parité avec une expérience native ChatGPT, Claude ou Perplexity.

Distinguer réponse vide réussie, absence, erreur de chargement et succès partiel. Ne pas transformer un échec en `[]` ou en zéro. Un calcul sur des sources incomplètes ne doit pas être présenté comme complet. Les erreurs affichées restent sûres, sans SQL, identifiants sensibles ou stack.

Le [contrat de vérité/remédiation](../truth-remediation-normalization-boundary.md) sépare `truth_class`/`review_status` de `status` opérationnel. Les bridges explicites maintiennent ces deux sémantiques.

## 5. Exécution, prompts et fournisseurs

Le crawl reste borné, protégé contre les destinations dangereuses et soumis aux limites/timeouts. Le rendu Playwright est conditionnel et conserve un fallback ; un refactor ne retire ni finalisation d’audit ni protections de concurrence.

Le [moteur continu](../continuous-visibility-engine-data-model.md) conserve déduplication, claim, overlap prevention, retry et récupération des runs bloqués. `continuous/jobs.js` porte dispatch et exécution ; `recurring-jobs.js` porte définitions, contrôles et santé ; `trends.js` lit les tendances ; `snapshots.js` capture les observations. Les lectures ne passent plus par les moteurs. La santé initialise toujours les définitions manquantes, et les tendances initialisent toujours les connecteurs : ces effets historiques sont explicites. Ses routes existent dans l’application dormante ; aucune cadence Vercel n’est active.

`operator-intelligence/overview-data.js` acquiert les cinq sources et leurs diagnostics pour les projections GEO et Agent. La visibilité Agent construit sa réponse depuis ces données communes, sans construire d’abord le DTO overview. Les branches indépendantes restent lues pour conserver disponibilité et provenance ; aucune économie de requêtes n’est déduite de ce changement. L’adaptation readiness conserve son cadrage métier, et le portail conserve ses autorisations et son filtrage propres.

Le [contrat prompt](../prompt-contract-unification.md) maintient une seule qualification contextualisée, avec modes `user_like/operator_probe`, statuts `strong/review/weak` et persistence normalisée. Les anciens JSON restent lisibles. Les captures de runs et la [qualité inspectable](../phase-3-1-quality-engine.md) gardent parsing, preuves et limites des benchmarks.

Les comparaisons ponctuelles sont séparées des runs GEO standard et des variantes de benchmark. Leur [contrat d’usage](../geo-compare-usage.md) conserve succès partiel, timeouts, isolation de la cadence Mistral et sortie sans secrets. La [couche de tâches IA](../mistral-task-architecture.md) réutilise les fournisseurs existants et journalise l’exécution.

## 6. Interface opérateur

Les [tokens visuels](../../src/lib/design/tokens.ts) et les composants actuels constituent la référence du rendu. Les anciens brouillons ne définissent pas une liste de fonctionnalités à créer.

- L’admin est un espace opérateur ; le portail client garde une restitution simplifiée.
- La navigation expose portefeuille et contexte client, avec des univers SEO, GEO et Agent distincts. La préparation locale reste dans SEO. Les sources/citations et la veille sociale gardent leurs questions métier.
- Chaque page aide à comprendre la situation, son importance, l’action possible et sa preuve. Une métrique sans preuve affiche son indisponibilité ; pas de faux indicateur live, de graphique décoratif ou de données inventées.
- Les compositions suivent leur rôle (cockpit, registre, inspecteur, file d’actions, atelier, dossier), sans imposer une grille de KPI uniforme.
- Les couleurs viennent des tokens actuels ; les accents portent le contexte ou la sémantique, jamais une décoration dominante. Garder typographie lisible et hiérarchie claire.
- Navigation accessible au clavier et labels/tooltips des icônes. Le contexte client reste visible et les panneaux s’adaptent au mobile.
- Gérer chargement, vide, erreur récupérable et données. Les actions destructives gardent confirmation et feedback.
- Les preuves restent consultables avec provenance, sortie brute adaptée, objets liés, action, historique et niveau de vérification ; aucun secret ni donnée client non autorisée.

Le scroll principal reste `.geo-shell` (100vh, non scrollable) → `.geo-main` (flex, min-height: 0, overflow hidden) → `.geo-content` (seul viewport principal scrollable). [CommandPageShell](../../src/features/admin/shared/components/command/CommandPageShell.jsx) reste un conteneur de layout sans overflow ; [AGENTS.md](../../AGENTS.md#admin-shell-scroll-model-do-not-break) décrit les règles de composition et de drawers.

## 7. Contenu public et intégrité factuelle

Les pages publiques utilisent les données et contacts présents dans le code, avec métadonnées et JSON-LD cohérents. Ne pas transformer une ancienne recommandation marketing en fait établi : adresse, équipe, fondation, certification, profil social, chiffre client et résultat nécessitent une preuve actuelle. Aucune garantie de classement ou de citation IA.

La politique de crawl de l’application dormante est centralisée dans `src/lib/agent-discovery/config.js` et servie par `src/app/robots.txt/route.js`, y compris Content-Signal. Elle ne remplace pas `parking/robots.txt` : la production statique conserve `Disallow: /` et noindex. Une ancienne procédure de purge/deploy ne permet pas une relance.

Les H1 des pages SEO growth P1, plateformes et ville Montréal restent uniques, non vides et visibles dans le premier HTML, sans dépendre d’un typewriter, d’un état React ou d’une animation masquant le titre. Garder le maillage contextuel, les canoniques et les schémas existants ; ne pas ajouter un lien pilier mécaniquement sur toutes les pages.

Une mesure manuelle de marque, lorsqu’elle est explicitement autorisée, note date, plateforme/mode, prompt exact, réponse, mentions/citations/URLs, catégorie, confusion, concurrents et limites. Les anciennes notes de benchmark et LinkedIn ne prouvent pas l’état dormant actuel et ne justifient aucune publication ou collecte automatique.

## 8. Instructions d’outils

`AGENTS.md`, `.github/copilot-instructions.md`, les `.github/instructions/*.instructions.md` et les agents/skills/prompts ont des consommateurs par convention. Ils restent à leurs emplacements. Les scopes `applyTo` suivent `src` ; un lien documentaire n’est pas un mécanisme d’inclusion automatique. `.cursor/settings.json` et `.cursor/worktrees.json` sont des réglages réellement utilisables ; les plans terminés ne sont pas des instructions chargées automatiquement.

## 9. Historique et preuves

L'[inventaire de la première consolidation](https://github.com/MarcSaad-Hadidi/Trouvable/blob/6c06ad4c11ac795ccf0fb485933721867c98a320/docs/architecture/consolidation-files.csv) reste consultable au commit indiqué. Aucun code ou outil ne le consomme ; il explique un chantier passé et ne décrit pas automatiquement l'état actuel. Les comparaisons avant/après, SHA et résultats de validation appartiennent aux preuves de la PR.

L'export manuel Code Scanning est décrit dans [CONTRIBUTING.md](../../CONTRIBUTING.md#export-manuel-des-alertes-code-scanning) ; ses sorties restent hors Git.

Le lancement d’audit conserve son annulation coopérative entre les étapes et les timeouts bornés du scanner. Le scanner ne reçoit pas le signal HTTP du client : une annulation ne garantit pas l’interruption immédiate des IO en cours.
