# Trouvable

Trouvable aide un opérateur à comprendre et améliorer la visibilité d'entreprises locales sur Google et dans les réponses des modèles conversationnels. L'application réunit audits de sites, prompts suivis, preuves et actions, puis restitue une synthèse client en lecture seule.

**En hibernation : la production sert uniquement le [parking statique](parking/).** L'application Next.js et ses services sont dormants ; les déploiements Git et Crons restent désactivés. La [procédure d'exploitation](docs/operations/trouvable-hibernation.md) encadre toute reprise.

## Le produit conservé

| Surface | Parcours implémentés |
|---|---|
| Site public | Offres, villes et expertises, ressources SEO/GEO, profils publiés et découverte machine. |
| `/admin` | Portefeuille, onboarding, dossier client, laboratoire d'audit et espaces SEO, GEO et Agent. |
| `/portal` | Synthèses et tendances en lecture seule, limitées aux memberships résolus côté serveur. |
| `/espace` | Connexion et orientation vers l'espace autorisé. |

Les audits combinent crawl borné, scoring déterministe et analyse IA avec replis. Les prompts suivis conservent réponses, parsing et provenance ; les comparaisons ponctuelles servent à la calibration. Google OAuth/GA4/GSC, Mistral, Groq et Gemini possèdent des adaptateurs dans le dépôt. Leur présence ne prouve aucune connexion distante active ni résultat client. Les métriques décrivent les observations stockées : absence, erreur et vrai zéro restent distincts.

## Architecture

Next.js 16.3 App Router, React 19, Tailwind 3, Clerk 7, Supabase et Vitest. npm et [package-lock.json](package-lock.json) fixent les dépendances.

```text
src/app/         Routes, layouts, handlers et métadonnées Next.js
src/features/    Surfaces public, admin, portal, espace et auth
src/components/  Primitives UI et composants partagés
src/lib/         Accès aux données, moteurs et contrats métier
src/proxy.js     Frontière de requête Clerk et en-têtes applicatifs
parking/         Production statique pendant l'hibernation
supabase/        Migrations ordonnées et références SQL conservées
scripts/         Vérification locale et opérations explicites
```

Les modules [db](src/lib/db/) portent les accès par domaine ; les [slices opérateur](src/lib/operator-intelligence/) et [loaders portail](src/features/portal/server/) composent leurs lectures. Les accès de service restent serveur et soumis à l'autorisation. La [structure](docs/architecture/current-structure.md) et la [carte des routes](docs/architecture/routing-map.md) détaillent ces frontières.

## Démarrer et vérifier localement

Utiliser Node.js **24.19.0** ([.node-version](.node-version)) et npm **11.6.2** avec le lockfile :

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

La commande `npm run verify` exécute en série formatage, lint strict, types, tests, build et garde-fous du dépôt. Ces contrôles ne demandent pas de secrets de production. Les écrans authentifiés nécessitent un environnement de test autorisé ; [CONTRIBUTING.md](CONTRIBUTING.md#commandes-de-vérification) décrit les commandes, leur périmètre et les limites.

Le parking se vérifie sans installation npm :

```bash
node scripts/validate-hibernation.mjs
node --test scripts/__tests__/hibernation.test.mjs
```

## Mécanismes à lire dans le code

| Mécanisme | Implémentation | Tests locaux |
|---|---|---|
| Audit et crawl borné | [Route autorisée](src/app/api/admin/audits/run/route.js), [lancement et finalisation](src/lib/audit/run-audit.js), [scanner](src/lib/audit/scanner.js) | [Frontière de crawl](src/lib/__tests__/site-audit-crawler-frontier.test.js) ; les tests de crawl ne valident pas les écritures d'une base réelle. |
| Score absent, zéro et provenance | [Lecture des scores](src/lib/audit/scores-facade.js), [snapshot métier](src/lib/operator-intelligence/snapshot.js) | [Formats historiques](src/lib/__tests__/score-readings.test.js), [sources partielles ou en erreur](src/lib/__tests__/workspace-snapshot.test.js). |
| Veille sociale par étapes | [Orchestrateur](src/lib/agent-reach/pipeline.js) : contexte, collecte, enrichissement, signaux et persistance | [Cycle de collecte et finalisation](src/lib/__tests__/engine-community-pipeline.test.js), [replis et limites de collecte](src/lib/__tests__/engine-community-collection.test.js). |
| Autorisation portail | [Membership serveur](src/features/portal/server/access.js), [page client](src/features/portal/PortalClientPage.jsx) | [Accès anonyme, identité vérifiée et isolation client](src/lib/__tests__/portal-access.test.js). |
| Chargement d'une vue métier | [Vue GEO](src/features/admin/geo/GeoOverviewView.tsx), [sélection des slices](src/lib/operator-intelligence/geo-slice-loaders.js) | [Chargement à la demande](src/lib/__tests__/geo-slice-loaders.test.js), [réponses tardives et contexte client](src/features/admin/shared/layout/__tests__/client-workspace-freshness.test.jsx). |
| Hibernation | [Validateur du contrat statique](scripts/validate-hibernation.mjs), [configuration Vercel](vercel.json) | [Configurations permises et interdites](scripts/__tests__/hibernation.test.mjs). |

Ces tests utilisent des fixtures et IO simulées. Ils ne prouvent pas les sessions Clerk réelles, les politiques d'une base distante ou le fonctionnement des fournisseurs. Le Hibernation Gate automatique protège le parking ; la validation applicative de la CI est manuelle et ne déploie rien.

## Approfondir

- [Décisions techniques et invariants](docs/architecture/refactor-decisions.md)
- [Prompts canoniques](docs/prompt-contract-unification.md) et [capture/qualité des runs](docs/phase-3-1-quality-engine.md)
- [Jobs continus et concurrence](docs/continuous-visibility-engine-data-model.md)
- [Preuve, review et remédiation](docs/truth-remediation-normalization-boundary.md)
- [Compatibilité SQL et reconstruction](docs/db-reconciliation-audit.md)
