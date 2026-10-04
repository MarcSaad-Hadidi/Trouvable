# Contribuer à Trouvable

La production reste en hibernation statique. Toute contribution conserve le parking, les données, les autorisations et les fonctionnalités dormantes. Une reprise des services exige une autorisation explicite et la [procédure d'exploitation](docs/operations/trouvable-hibernation.md).

## Environnement local

Utiliser Node.js **24.19.0**, indiqué dans [.node-version](.node-version), et npm **11.6.2**, indiqué dans `packageManager`. [package.json](package.json) exprime également la plage de compatibilité des outils ; [package-lock.json](package-lock.json) fixe les dépendances.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Aucun script d'installation applicatif n'est nécessaire. Lint, types, tests et build ne demandent pas de secrets de production. Le build sans secrets ne valide pas les parcours authentifiés : ils nécessitent Clerk et Supabase dans un environnement de test autorisé. Les tests locaux utilisent des fixtures et IO simulées.

Les variables de développement restent dans `.env.local`, jamais dans Git. Lire les consommateurs avant de configurer une variable : [supabase-admin](src/lib/supabase-admin.js) utilise `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` côté serveur ; Clerk distingue `NEXT_PUBLIC_CLERK_*` et `CLERK_*`. Ne pas appeler un fournisseur, synchroniser un connecteur ou envoyer un email pour valider un refactor.

## Organisation et contrats

Lire [AGENTS.md](AGENTS.md), la [structure](docs/architecture/current-structure.md) et les [décisions](docs/architecture/refactor-decisions.md). `src/app` décrit le routage ; `src/features` porte les surfaces produit ; `src/lib` porte les moteurs et accès métier. Préserver les frontières serveur/client, les URLs publiques et historiques, le scope client et le scroll administrateur.

Les migrations ordonnées dans `supabase/migrations/` restent l'historique SQL. Les anciens `schema.sql` et `setup_*.sql` sont conservés comme références de reconstruction. Ne pas les appliquer en production ni les retirer sans preuve sur une base locale jetable ; la [note SQL](docs/db-reconciliation-audit.md) explique compatibilités et limites.

## Commandes de vérification

Avant de considérer une PR applicative prête, lancer la [vérification complète](scripts/verify.mjs) :

```bash
npm run verify
```

Elle s'arrête au premier échec et exécute **en série** : formatage, lint, types, tests applicatifs, tests de l'outillage, tests de garde-fous, build, validateur d'hibernation, contrôle du dépôt puis `git diff --check`. Ne pas lancer simultanément `typecheck` et `build` : ils écrivent les mêmes types Next.

| Commande                    | Périmètre                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`      | Prettier selon `.prettierrc.json` et `.prettierignore`. `npm run format` écrit le formatage ; séparer ce diff des changements de comportement.                                                  |
| `npm run lint`              | ESLint sur JS/JSX/TS/TSX, seuil de zéro avertissement. `lint:fix` applique les corrections automatiques.                                                                                        |
| `npm run typecheck`         | Types de routes Next générés avec webpack, puis programme TypeScript configuré ; ne type pas intégralement le JavaScript.                                                                       |
| `npm test`                  | Tests Vitest JS/JSX/TS/TSX, fixtures et mocks locaux. Exemple ciblé : `npm test -- src/lib/__tests__/portal-access.test.js`.                                                                    |
| `npm run test:tooling`      | Tests Node du graphe de dépôt, de la vérification en série et de l’isolation QA navigateur.                                                                                                     |
| `npm run test:hibernation`  | Tests Node des protections dans `scripts/__tests__/hibernation.test.mjs`.                                                                                                                       |
| `npm run build`             | Compilation et routes de l'application dormante avec webpack ; aucun déploiement.                                                                                                               |
| `npm run check:hibernation` | Contrat fermé du parking, configuration Vercel et workflows dormants.                                                                                                                           |
| `npm run check:repository`  | Imports/réexports/mocks et imports dynamiques littéraux, casse, cycles de production, liens Markdown locaux et ancres, références JSX littérales d'assets et motifs d'artefacts générés suivis. |

Le [contrôle du dépôt](scripts/check-repository.mjs) compte les imports calculés sans résoudre toutes leurs destinations. Il ne certifie pas les assets référencés dynamiquement, tout le CSS ou tous les chemins runtime ; ses liens HTTP externes ne sont pas vérifiés. `assets:check` et `lfs:check` sont absents : les vérifications d'assets littéraux ne constituent pas un contrôle Git LFS.

Le parking se vérifie aussi sans installation npm, avec `node scripts/validate-hibernation.mjs` et `node --test scripts/__tests__/hibernation.test.mjs`. Le Hibernation Gate automatique reste léger ; le job applicatif manuel de [.github/workflows/ci.yml](.github/workflows/ci.yml) exécute la même vérification complète en série sans secrets de production ni déploiement. Un Gate vert n'atteste pas le comportement applicatif.

## Vérifications ciblées et limites

Pour la documentation, vérifier liens, ancres, chemins, commandes et `git diff --check`. Pour un changement métier, reproduire le défaut et ajouter un test de comportement pertinent. Pour l'UI, vérifier chargement/vide/erreur/données, clavier, mobile et scroll sur les routes concernées. Les fixtures de navigateur et les accès anonymes d'un build de production constituent des preuves distinctes ; un rendu avec bypass local ne valide pas une session réelle.

Les tests d'autorisation doivent distinguer anonyme/interdit/client A/client B. Les IO simulées ne valident ni les politiques d'une base distante, ni les sessions Clerk, ni les connecteurs ou réponses IA réels. Documenter commandes, résultats et limites dans la PR, sans collection de rapports permanents. Ne pas créer de bypass d'auth pour obtenir une capture.

## QA navigateur locale

Après un build sans secrets, le [runner Playwright/CDP](scripts/qa/browser.mjs) vérifie le site public, les accès anonymes puis les familles opérateur modifiées sur desktop et mobile :

```powershell
npm run qa:browser -- --mode all --artifacts "C:\temp\trouvable-qa" --executable "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Adapter ces deux chemins absolus au poste ; le dossier de preuves doit rester hors du dépôt. Le navigateur doit être déjà installé. Le runner ne lance ni installation ni build. Il refuse les fichiers d’environnement que Next chargerait et retire les secrets et hooks hérités du processus. Il démarre ses propres serveurs sur des ports libres et arrête uniquement leurs processus.

Le mode `production` utilise `next start`, sans bypass ni clés simulées. Le mode `fixture` utilise des données Supabase synthétiques en lecture seule, le garde d’accès de développement localhost existant et une UI Clerk anonyme simulée. Les requêtes externes et les mutations sont bloquées ; `--allow-fonts` autorise uniquement Google Fonts HTTPS pour la compilation de développement. Ces fixtures ne valident pas une session Clerk, un membership ou la RLS distante.

Les codes de sortie distinguent succès (0), régression ou préparation manquante (1), et couverture bloquée par configuration absente (2). Les captures, traces, console et relevés Network/Performance restent dans le dossier de preuves ; lire les blocages et avertissements au lieu d’assimiler toutes les captures à une validation.

## Git et review

Pour un nouveau chantier, partir du dernier `origin/main` avec `feat/...`, `fix/...` ou `refactor/...`. Pour continuer une PR, conserver sa branche dédiée et ses commits. Préserver le travail utilisateur ; utiliser un worktree isolé si nécessaire. Pas de reset destructif, force-push sur main, merge automatique ou déploiement implicite.

Les commits suivent `type(scope): description`, avec un changement logique par commit. Relire le diff complet contre la base de PR, y compris suppressions et déplacements. Identifier les consommateurs possibles — imports dynamiques, conventions Next, mocks, scripts, workflows, CSS, assets et opérations documentées — avant de retirer un fichier. Conserver tout élément dont l'usage reste incertain.

La PR décrit problème, comportement obtenu, validations et risques. Garder la PR en draft si un contrôle indispensable est bloqué ou échoue. Un retour arrière utilise des reverts ciblés dans une nouvelle branche, sans restauration destructive des données.

## Export manuel des alertes Code Scanning

[scripts/export-codeql-alerts.ps1](scripts/export-codeql-alerts.ps1) lit les alertes ouvertes GitHub avec un token ayant les droits Code Scanning, fourni par `GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_OAUTH_TOKEN` ou les variables correspondantes du `.env.local` racine. Il ne lance pas CodeQL et ne modifie pas les alertes. Exécuter depuis un dossier hors du dépôt pour y produire `codeql-alerts.md` et `codeql-alerts.csv` ; ne committer ni ces exports ni les secrets.
