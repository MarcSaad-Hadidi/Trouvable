# Trouvable — Hibernation et reprise contrôlée

Trouvable reste un actif dormant. Le code applicatif est conservé dans `src/` et validable localement ; le déploiement public utilise uniquement `parking/index.html`, `parking/404.html` et `parking/robots.txt`. Ce document décrit des opérations futures qui exigent un mandat distinct. Une consolidation du dépôt ne réactive aucun service, cron ou déploiement.

## Contrat statique

`vercel.json` conserve le preset `Other` (`framework: null`), une installation vide, le build limité au validateur, `outputDirectory: parking`, aucun Cron ni Function et `git.deploymentEnabled: false`. L’Ignored Build Step constitue une défense supplémentaire. Le parking n’exécute aucun script, formulaire, fournisseur IA, Clerk, Supabase ou analytics et ne charge aucune ressource externe. Robots et en-têtes imposent `noindex`, `nofollow`, `noarchive` ; la CSP statique interdit l’exécution et les connexions.

La CSP du proxy applicatif répond aux besoins de l’application dormante (Clerk, Turnstile et services autorisés). Elle est testée séparément de celle du parking et ne doit pas être recopiée dans la configuration statique.

```bash
node scripts/validate-hibernation.mjs
node --test scripts/__tests__/hibernation.test.mjs
```

Ces commandes utilisent uniquement les modules intégrés de Node.js 24. Elles n’installent aucune dépendance. Les tests travaillent dans des dossiers temporaires isolés et exercent aussi les configurations interdites. Le validateur fixe un contrat fermé pour `ci.yml` : toute évolution intentionnelle du workflow doit être relue avec le contrat correspondant dans le validateur.

## Validation de l’application dormante

Le workflow existant **Hibernation Gate** conserve son job automatique léger sur les pushes et PR vers `main`. Seul `workflow_dispatch` permet le job distinct `application-validation` :

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run build
```

Le job utilise Node.js 24, des permissions `contents: read`, une concurrence bornée et une limite de 20 minutes. Il ne reçoit aucun secret de service et ne déploie rien. Aucun appel fournisseur ou envoi réel n’est nécessaire aux tests. `typecheck` génère les types de routes avec le même bundler webpack que le build, puis exécute TypeScript.

Le lint, les types, les tests et le build local ne prouvent pas qu’un service distant est connecté. L’exploration locale authentifiée nécessite les prérequis décrits dans [CONTRIBUTING](../../CONTRIBUTING.md). Le bouton GitHub de déclenchement manuel peut rester indisponible avant la présence du workflow sur la branche par défaut : les résultats locaux doivent alors être rapportés comme tels. Le Hibernation Gate vert sur une PR n’est pas un résultat de validation applicative.

CodeQL et Dependency Review restent manuels. Les mises à jour de version Dependabot restent désactivées. `External Cron (Hibernated)` reste sans schedule ; son choix par défaut `CANCEL` ne lance aucun job. Une exécution exceptionnelle exige un mandat distinct, une cible vérifiée et la sélection exacte `RUN_ONCE`, suivie de l’inspection des effets et des logs.

## Vérification d’un déploiement statique existant

En lecture seule, vérifier l’accueil HTTP 200, la 404 statique, `robots.txt` avec `Disallow: /`, les en-têtes CSP/robots et le réseau sur mobile et desktop. Vérifier dans Vercel les Functions, les crons et les logs accessibles, sans lancer de déploiement pour obtenir ces preuves. Identifier le SHA de chaque déploiement inspecté : un ancien déploiement ne valide pas une nouvelle branche.

Une éventuelle injection edge est distincte de la source Git ; voir les [verrous d’infrastructure](trouvable-hibernation-infrastructure.md). Ne pas modifier Cloudflare, Vercel ou Supabase pendant une simple vérification du dépôt.

## Reprise de l’application

Une reprise nécessite une nouvelle branche depuis le dernier `origin/main`, un plan relu et une autorisation explicite des opérations distantes :

1. Vérifier la sauvegarde des données et des secrets dans un coffre chiffré. Si Supabase est pausé, le restaurer et attendre son état sain avant toute promotion applicative.
2. Conserver le code consolidé actuel dans `src/`. Le commit historique `eea4736186c0e86324b3b61fdfc45abe9e2e77e5` documente l’état antérieur à l’hibernation ; le recopier intégralement ferait perdre les corrections ultérieures.
3. Préparer sélectivement la configuration Vercel Next.js et les variables nécessaires. La suppression des verrous Git/build et des garanties du parking doit apparaître explicitement dans cette PR de reprise.
4. Exécuter la validation applicative ci-dessus, puis vérifier les routes publiques, auth, portail, admin et APIs en environnement de test contrôlé : accès anonyme/interdit, isolation client, console, réseau, hydratation, clavier et responsive.
5. Après validation et autorisation distincte, créer un Preview et inspecter ses logs avant toute promotion production.
6. Réactiver les tâches planifiées, workflows et connecteurs uniquement selon les besoins vérifiés, un à un avec observation des effets. Ne pas restaurer automatiquement toutes les anciennes planifications.

Ne jamais supprimer le projet Supabase, ses tables ou ses secrets pour une reprise. Ne pas pauser Supabase avant la validation du parking de production. Ne pas fusionner automatiquement, réécrire `main` ou réactiver le cron sans autorisation.

## Retour arrière

Pour annuler une consolidation, créer une nouvelle branche et des commits `git revert` ciblés, relire le diff et rejouer les contrôles. Pour revenir au parking après une reprise, rétablir explicitement son contrat et ses verrous dans une PR distincte, puis suivre le processus de déploiement autorisé. Aucun reset destructif ni restauration destructive de base n’est requis. Conserver l’historique, les données et les sauvegardes de secrets.
