# Contribuer à Trouvable

La production est en hibernation statique. Toute contribution conserve le parking, les données, les protections d’accès et les fonctionnalités dormantes. Une reprise des services nécessite une autorisation explicite et la [procédure d’exploitation](docs/operations/trouvable-hibernation.md).

## Environnement local

Utiliser npm avec le lockfile conservé :

```bash
npm ci --ignore-scripts --no-audit --no-fund
node scripts/validate-hibernation.mjs
node --test scripts/__tests__/hibernation.test.mjs
```

Aucun script d’installation applicatif n’est nécessaire. Ne pas copier de secrets de production pour effectuer lint, types, tests ou build.

`npm run dev` démarre Next localement. Le build sans secrets peut réussir, mais les parcours authentifiés demandent Clerk et Supabase configurés dans un environnement de test autorisé. Les tests unitaires utilisent des mocks : ils ne prouvent ni le catalogue SQL distant ni les permissions d’un service réel.

Les variables de développement restent dans `.env.local` à la racine, jamais dans Git. Lire les consommateurs avant de configurer une variable : `src/lib/supabase-admin.js` utilise `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` côté serveur ; Clerk distingue `NEXT_PUBLIC_CLERK_*` et `CLERK_*`. IA, Google et email servent aux vérifications explicites, pas aux contrôles structurels. Ne pas appeler un fournisseur, synchroniser un connecteur ou envoyer un email pour valider un refactor.

## Organisation et contrats

Lire [AGENTS.md](AGENTS.md), la [structure](docs/architecture/current-structure.md) et les [décisions](docs/architecture/refactor-decisions.md). `src/app` décrit le routage ; `src/features` porte les surfaces produit ; `src/lib` porte les moteurs et accès métier. Préserver les frontières serveur/client, les URLs publiques et historiques, le scope client et le scroll administrateur.

Les migrations ordonnées dans `supabase/migrations/` restent l’historique SQL. Les anciens scripts `supabase/schema.sql` et `setup_*.sql` sont conservés comme références de reconstruction ; leur équivalence avec une base reconstruite n’est pas prouvée ici. Ne pas les appliquer en production ni les retirer sans preuve sur une base locale jetable. La [réconciliation historique](docs/db-reconciliation-audit.md) expose les dérives à vérifier.

## Validation proportionnée

Pour la documentation : vérifier liens, chemins, commandes et `git diff --check`. Pour un changement métier : reproduire le défaut et ajouter un test de comportement pertinent. Pour l’UI : vérifier les états chargement/vide/erreur/données, le clavier, le mobile et le scroll des routes concernées.

Avant une PR applicative prête à relire :

```bash
npm run lint
npm run typecheck
npm test
npm run build
node scripts/validate-hibernation.mjs
node --test scripts/__tests__/hibernation.test.mjs
git diff --check
```

Le job applicatif de `.github/workflows/ci.yml` se lance manuellement ; le Hibernation Gate reste automatique et léger. Ne pas présenter le Gate comme une validation applicative. `assets:check` et `lfs:check` n’existent pas dans `package.json`.

Documenter les commandes, résultats et limites dans la PR, sans ajouter une collection de rapports au dépôt. Une compilation sans secrets ne remplace pas les vérifications d’autorisation anonyme/interdite/client A/client B. Ne pas créer de bypass d’auth pour obtenir une capture.

## Git et review

Créer une branche propre depuis le dernier `origin/main` : `feat/...`, `fix/...` ou `refactor/...` selon le chantier. Préserver le travail existant ; utiliser un worktree isolé si nécessaire. Pas de reset destructif, force-push sur main, merge automatique ou déploiement implicite.

Les commits suivent `type(scope): description`, avec un changement logique par commit. Relire le diff complet contre la base de PR, y compris les suppressions et déplacements. Identifier leurs consommateurs possibles (imports dynamiques, conventions Next, scripts, workflows, CSS, assets et opérations documentées) avant de retirer un fichier. Conserver tout élément dont l’usage reste incertain.

La PR décrit le problème, le comportement obtenu, les validations et les risques. Garder la PR en draft si un contrôle indispensable est bloqué ou en échec. Un retour arrière se prépare par revert ciblé dans une nouvelle branche ; aucune restauration destructive de données n’est requise pour une consolidation de code.
