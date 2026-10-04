# Structure du dépôt

L’application est conservée en hibernation. `vercel.json` déploie uniquement `parking/`, sans installation npm, fonction Next ou Cron. Les répertoires applicatifs décrivent le produit dormant, pas la production statique.

## Responsabilités

| Chemin | Responsabilité |
|---|---|
| `src/app/` | Routes explicites, layouts, handlers API, boundaries et métadonnées Next. |
| `src/features/public/` | Pages marketing, villes, expertises, profils et ressources SEO/GEO. |
| `src/features/admin/` | Portefeuille, dossier, SEO, GEO, Agent et chrome opérateur. |
| `src/features/portal/` | Portail client ; loaders et contrôle d’accès dans `server/`. |
| `src/features/espace/` | Orientation après connexion. |
| `src/features/auth/` | Écrans Clerk et résolution de la destination autorisée. |
| `src/components/ui/` | Primitives UI. |
| `src/components/shared/` | Affichage partagé, dont les widgets de métriques. |
| `src/lib/db/` | Accès aux données par domaine. Aucun barrel global `db.js`. |
| `src/lib/operator-intelligence/` | Agrégations et slices opérateur, au-dessus des accès ciblés. |
| `src/lib/audit/`, `queries/`, `ai/` | Crawl, scoring, prompts, extraction et fournisseurs. |
| `src/lib/agent-reach/` | Veille sociale : orchestration, contexte, collecte, signaux, enrichissement et persistance. |
| `src/lib/design/tokens.ts` | Tokens visuels canoniques pour les surfaces qui les consomment. |
| `src/lib/continuous/`, `connectors/`, `remediation/` | Jobs, intégrations et workflow de corrections. |
| `src/proxy.js` | Frontière de requête Clerk et en-têtes applicatifs. |
| `parking/` | `index.html`, `404.html`, `robots.txt` déployés pendant l’hibernation. |
| `public/` | Assets de l’application, conservés à la racine. |
| `supabase/` | Migrations ordonnées et anciens scripts SQL conservés. |
| `scripts/` | Validateurs et opérations nommées explicitement. |
| `.github/` | CI, agents, prompts, skills et instructions Copilot. |
| `.cursor/` | Réglages de l’outil et installation des worktrees. |

## Frontières

`src/app` décrit les URLs et monte les implémentations dans `src/features`. Les groupes `(workspace)` et `(app)` n’apparaissent pas dans les URLs. Les layouts racine et de segment gardent les responsabilités Next : styles globaux, metadata, providers et boundaries.

Les modules métier partagés entre APIs, pages serveur et jobs restent dans `src/lib`. Les accès DB ne dépendent pas des agrégations opérateur. Les exports de domaine sont importés directement ; une façade générale ne doit pas recréer ce cycle.

Clerk authentifie. `src/lib/auth.js` contrôle les opérateurs par allowlist serveur ; `src/features/portal/server/access.js` résout les memberships client depuis l’identité Clerk vérifiée. Le navigateur ne choisit pas librement un `client_id` autorisé. Le client Supabase de service reste serveur uniquement et contourne RLS : chaque consommateur doit conserver son contrôle d’accès.

## Navigation rapide

- Une URL ou un redirect : [carte des routes](routing-map.md), puis `src/app`.
- Un écran opérateur : `src/features/admin/<section>`.
- Une restitution client : `src/features/portal` et ses loaders `server/`.
- Une métrique ou un problème : `src/lib/operator-intelligence`, `audit` et `truth`.
- Une contrainte métier : [décisions techniques](refactor-decisions.md).
- Une validation locale : [CONTRIBUTING.md](../../CONTRIBUTING.md).
- Une opération distante : [hibernation](../operations/trouvable-hibernation.md), avec autorisation distincte.

## Conventions préservées

Next 16 accepte `src/app` ; le proxy du projet se place dans `src/proxy.js`, au même niveau que les routes. `public`, les configurations et `.env.*` restent à la racine. Les alias TypeScript/Vitest et le scan Tailwind suivent `src`, sans deuxième arborescence active à la racine.

Les routes restent explicites ; les alias historiques conservent leurs redirections. Auth et espace ont des responsabilités distinctes : le regroupement des sources ne change ni les URLs ni les autorisations.

Les migrations appliquées et les fixtures utiles ne sont pas des déchets. L’historique Git conserve les anciens prototypes et plans retirés ; aucun dossier d’archive concurrent n’est nécessaire à l’exécution.
