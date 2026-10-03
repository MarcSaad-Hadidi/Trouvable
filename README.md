# Trouvable

Trouvable est un outil interne pour accompagner des entreprises locales dans leur visibilité sur Google et dans les réponses des modèles conversationnels. Il rassemble audits de sites, observations de réponses IA, preuves et actions opérateur, avec une restitution client en lecture seule.

## État actuel : hibernation

La production sert un **parking HTML statique**. L’application Next.js et ses services sont dormants : aucun Cron Vercel, aucune fonction applicative et aucun déploiement Git automatique. Le code et les migrations sont conservés pour une reprise contrôlée. Les validations locales ne réactivent pas l’exploitation.

Le contrat figure dans la [procédure d’hibernation](docs/operations/trouvable-hibernation.md) et les [verrous d’infrastructure](docs/operations/trouvable-hibernation-infrastructure.md).

## Surfaces implémentées

| Surface | Rôle dans l’application dormante |
|---|---|
| Site public | Mandats, villes et expertises, ressources SEO/GEO, profils publiés, métadonnées et sitemap. |
| `/admin` | Portefeuille, onboarding, dossier client, laboratoire d’audit et espaces SEO, GEO et Agent. |
| `/portal` | Synthèses et tendances client, limitées aux memberships résolus côté serveur. |
| `/espace` | Connexion et orientation vers l’espace autorisé. |
| APIs et moteurs | Crawl borné, scoring déterministe, analyse IA, prompts suivis, comparaisons, remédiation et jobs persistés. |

Le dépôt contient les parcours OAuth Google et les adaptateurs GA4/GSC, ainsi que les fournisseurs IA Mistral, Groq et Gemini. **Implémentation ne signifie pas connexion distante vérifiée** : le fonctionnement authentifié dépend des services, droits et secrets de l’environnement. Aucune connexion distante ni résultat client n’est attesté par ce README.

Les métriques GEO décrivent les réponses effectivement suivies et stockées. Une absence de score reste indisponible ; une absence de preuve ne devient pas une mesure de marché.

## Démarrage et contrôles locaux

Le dépôt utilise **npm** et `package-lock.json`. Le lockfile installe Next.js 16.3.0, React 19, Tailwind 3 et Clerk 7. Utiliser une version de Node compatible avec le paquet Next installé ; Node 24 a servi aux contrôles locaux de la consolidation.

Pour vérifier uniquement le parking, aucune installation n’est nécessaire :

```bash
node scripts/validate-hibernation.mjs
node --test scripts/__tests__/hibernation.test.mjs
```

Pour les contrôles applicatifs locaux :

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run build
```

Le build peut être réalisé sans secrets de service. Cela ne valide pas les parcours Clerk/Supabase, les appels fournisseurs ou les permissions d’une base réelle. `npm run dev` lance l’application dormante localement ; les écrans authentifiés nécessitent un environnement de test contrôlé. Lire [CONTRIBUTING.md](CONTRIBUTING.md) avant de configurer des services. Ne pas utiliser de secrets de production ni lancer les jobs pour vérifier un changement structurel.

## Navigation dans le code

```text
src/
  app/          Routes, layouts, handlers et métadonnées Next.js
  features/     Surfaces public, admin, portal, espace et auth
  components/   Primitives UI et composants partagés
  lib/          Accès aux données, moteurs et contrats métier
  proxy.js      Frontière de requête et authentification Clerk
parking/        Seuls fichiers déployés pendant l’hibernation
public/         Assets de l’application dormante
supabase/       Historique SQL et scripts de reconstruction conservés
scripts/        Validateurs et outillage explicite
docs/           Architecture, contrats et exploitation
```

Les modules de `src/lib/db/` portent les accès par domaine ; les agrégations opérateur s’appuient sur ces modules ciblés. Le portail possède ses loaders dans `src/features/portal/server/`. La [structure](docs/architecture/current-structure.md), la [carte des routes](docs/architecture/routing-map.md) et les [décisions techniques](docs/architecture/refactor-decisions.md) détaillent ces frontières.

## Choix techniques

- **Preuve et provenance** : observations, calculs dérivés et inférences gardent leurs sémantiques. Les états de review et de remédiation sont distincts.
- **Accès serveur** : Clerk authentifie ; les contrôles opérateur et memberships portail autorisent. Le client Supabase de service reste côté serveur.
- **Audits résilients** : crawl borné et protégé, extraction, scoring déterministe et analyse IA séparés ; les formats historiques restent lisibles.
- **Exécutions traçables** : prompts, réponses brutes, parsing et historique sont persistés. Les jobs conservent déduplication, verrouillage et finalisation, même dormants.
- **UI opérateur** : sections métier distinctes et chargement par slices ; `.geo-content` possède le scroll principal.

## Validation : portée des contrôles

Le **Hibernation Gate** automatique protège le parking et la configuration de déploiement. La validation applicative est un job **manuel** du même workflow, sans secrets de production ni déploiement. Un Gate vert n’atteste donc pas le comportement authentifié de l’application.

ESLint couvre JS/JSX/TS/TSX ; Vitest découvre les tests JS/JSX/TS/TSX. `typecheck` génère les types Next puis vérifie le programme TypeScript configuré ; le JavaScript n’est pas intégralement typé. Le build complète les contrôles de compilation et de routes. Les scripts `assets:check` et `lfs:check` sont absents : aucun succès ne leur est attribué.

Les changements d’auth, de portail ou de données demandent en plus une vérification ciblée dans un environnement de test autorisé. Aucun appel payant, email réel, migration distante ou reprise de service n’est nécessaire pour ces contrôles.
