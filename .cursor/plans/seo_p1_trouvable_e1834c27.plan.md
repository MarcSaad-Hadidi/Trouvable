---
name: SEO P1 Trouvable
overview: Corriger les H1 selon une règle stricte HTML (sans motion/state/typewriter sur le titre), ajouter un bloc éditorial + H1 statique sur les six pages plateformes, maillage contextuel vers `/agence-geo-montreal`, renforcer Montréal et « mesurer la visibilité IA », puis valider avec lint/build et contrôles SEO listés — sans toucher sitemap, robots, portail, admin, auth ou Supabase.
todos:
  - id: fix-h1-strict
    content: "Toutes pages P1 growth + ville Montréal + SEO IA génératif : H1 = <h1>texte statique uniquement ; aucun motion/typewriter/opacity-0/state sur le H1 ; animations sur wrappers décoratifs seulement"
    status: completed
  - id: platform-editorial-six
    content: "ChatgptPage, PerplexityPage, ClaudePage, GeminiPage, CopilotPage, AiOverviewsPage : H1 + bloc éditorial SEO/GEO au-dessus du mock ; corriger lien Claude → /ressources/structurer-site-moteurs-ia"
    status: completed
  - id: ville-montreal-h1
    content: "VillePageClient: H1 descriptif aligné sur metadata ; lien contextuel /agence-geo-montreal si pertinent"
    status: completed
  - id: internal-links-contextual
    content: Maillage /agence-geo-montreal contextuel sur pages P1 où logique uniquement — pas de REQUIRED_INTERNAL_LINKS global ; corriger liens cassés
    status: completed
  - id: homepage-section-sobre
    content: "TrouvablePremiumPreview : micro-section premium courte, ancre « agence GEO à Montréal », sans bloc SEO lourd"
    status: completed
  - id: agence-mtl-sections
    content: "Données agence-geo-montreal + AgenceGeoMontrealPage : 6 blocs business demandés"
    status: completed
  - id: mesurer-pillar
    content: "mesurer-visibilite-ia : données + MesurerVisibiliteIaPage sections pilier (tableau, prompts, concurrents, méthode)"
    status: completed
  - id: metadata-pass
    content: Revue titles/descriptions/H1/FAQ slugs P1 (+ gemini, copilot, ai-overviews) ; priority mesurer/claude si souhaité
    status: completed
  - id: verify-mandatory
    content: "Validation obligatoire : 1 H1 non vide visible/page P1, title, meta, canonical, FAQ+breadcrumbs JSON-LD, liens internes OK, npm run lint, npm run build si possible"
    status: completed
isProject: false
---

# Plan SEO / GEO — pages P1 Trouvable (validé avec ajustements)

## Diagnostic (état actuel)

| Enjeu | Constat dans le code |
|-------|----------------------|
| H1 audit « cassé » | [`AuditVisibiliteIaPage.jsx`](features/public/seo-growth/pages/AuditVisibiliteIaPage.jsx) : `TypewriterTitle` avec état initial vide → **H1 vide au premier HTML**. |
| Autres H1 « dynamiques » | `motion.h1` + `initial={{ opacity: 0 }}` sur plusieurs héros P1 ; **interdit** par la règle stricte ci-dessous (le texte du titre ne doit pas dépendre de Framer). |
| SEO IA génératif | [`SeoIaReferencementGeneratifPage.jsx`](features/public/seo-growth/pages/SeoIaReferencementGeneratifPage.jsx) : `opacity-0` / état `revealed` sur le H1 — **interdit**. |
| Plateformes (6 pages) | [`ChatgptPage.jsx`](features/public/seo-growth/pages/ChatgptPage.jsx), [`PerplexityPage.jsx`](features/public/seo-growth/pages/PerplexityPage.jsx), [`ClaudePage.jsx`](features/public/seo-growth/pages/ClaudePage.jsx), [`GeminiPage.jsx`](features/public/seo-growth/pages/GeminiPage.jsx), [`CopilotPage.jsx`](features/public/seo-growth/pages/CopilotPage.jsx), [`AiOverviewsPage.jsx`](features/public/seo-growth/pages/AiOverviewsPage.jsx) : pas de `<h1>` éditorial statique au-dessus du mock. |
| `/villes/montreal` | [`VillePageClient.jsx`](features/public/city/VillePageClient.jsx) : H1 = seulement « Montréal » vs title « Visibilité IA à Montréal » dans [`VillePage.jsx`](features/public/city/VillePage.jsx). |
| Maillage pilier | Certaines pages P1 gagneraient un lien **contextuel** vers `/agence-geo-montreal` ; pas d’injection mécanique globale. |
| Lien cassé | Entrée `claude` dans [`seo-growth-pages.js`](lib/data/seo-growth-pages.js) : `/services/structurer-site-moteurs-ia` → doit être [`/ressources/structurer-site-moteurs-ia`](app/ressources/structurer-site-moteurs-ia/page.jsx). |

Les **titles, descriptions et canonical** des pages SEO growth restent dans [`buildSeoGrowthMetadata`](lib/data/seo-growth-pages.js) via [`buildPublicMetadata`](lib/seo/metadata.js).

---

## Règle stricte — H1 pages P1 (obligatoire)

Le **texte du H1 principal** doit être rendu **directement dans le HTML** comme contenu d’un élément `<h1>` :

- **Interdit** sur le H1 ou son texte : typewriter, état React (`useState` / `revealed` / etc.), `opacity-0` / `visibility:hidden` pour masquer le titre, composant `motion.h1` ou tout wrapper dont l’animation conditionne la lisibilité du titre au premier paint.
- **Autorisé** : animations Framer Motion / décor **sur des wrappers autour** du `<h1>`, ou sur eyebrow, fonds, sous-titres, sections suivantes — tant que le `<h1>{page.h1}</h1>` (ou texte ville équivalent) est **pleinement présent et visible** sans dépendre du JS d’animation.

**Corollaire :** utiliser un `<h1 className="...">` classique pour le libellé ; pas de `motion.h1` pour le seul titre.

**Pages concernées :** tous les héros des pages growth P1 ([`SeoGrowthPage`](features/public/seo-growth/SeoGrowthPage.jsx) et composants par slug), **dont** audit, agence Montréal, visibilité Google + IA, GEO vs SEO, mesurer, SEO IA génératif ; les **six** plateformes ; et `/villes/montreal`.

---

## 1. Application de la règle H1 sur les pages growth + ville

- [`AuditVisibiliteIaPage.jsx`](features/public/seo-growth/pages/AuditVisibiliteIaPage.jsx) : supprimer `TypewriterTitle` du H1 ; `<h1>` statique.
- [`SeoIaReferencementGeneratifPage.jsx`](features/public/seo-growth/pages/SeoIaReferencementGeneratifPage.jsx) : supprimer le motif `opacity-0` / `revealed` sur le titre ; `<h1>` statique.
- [`AgenceGeoMontrealPage.jsx`](features/public/seo-growth/pages/AgenceGeoMontrealPage.jsx), [`VisibiliteGoogleReponsesIaPage.jsx`](features/public/seo-growth/pages/VisibiliteGoogleReponsesIaPage.jsx), [`GeoVsSeoPage.jsx`](features/public/seo-growth/pages/GeoVsSeoPage.jsx), [`MesurerVisibiliteIaPage.jsx`](features/public/seo-growth/pages/MesurerVisibiliteIaPage.jsx) : remplacer `motion.h1` par `<h1>` statique + décor animé au besoin sur un parent sans masquer le titre.

---

## 2. Six pages plateformes — H1 statique + bloc éditorial avant le mock

**Chemins :**

- `/plateformes/chatgpt` → [`ChatgptPage.jsx`](features/public/seo-growth/pages/ChatgptPage.jsx)
- `/plateformes/claude` → [`ClaudePage.jsx`](features/public/seo-growth/pages/ClaudePage.jsx)
- `/plateformes/perplexity` → [`PerplexityPage.jsx`](features/public/seo-growth/pages/PerplexityPage.jsx)
- `/plateformes/gemini` → [`GeminiPage.jsx`](features/public/seo-growth/pages/GeminiPage.jsx)
- `/plateformes/copilot` → [`CopilotPage.jsx`](features/public/seo-growth/pages/CopilotPage.jsx)
- `/plateformes/ai-overviews` → [`AiOverviewsPage.jsx`](features/public/seo-growth/pages/AiOverviewsPage.jsx)

Pour **chaque** fichier :

1. Au-dessus du mock « application », ajouter une zone éditoriale : **`<h1>{page.h1}</h1>` statique** (règle stricte), chapô (`summary`), paragraphes courts (`definition`, `clientProblem`), liste d’enjeux si utile (`problems`).
2. **Exactement un `<h1>`** par page (pas de second H1 dans le mock ; vérifier les headings dans la simulation — utiliser `h2`/`div` avec rôle présentation si besoin pour éviter double H1).
3. Lien vers `/agence-geo-montreal` **uniquement si le contexte le supporte** (voir §3).

**Données :** corriger le lien interne Claude dans [`lib/data/seo-growth-pages.js`](lib/data/seo-growth-pages.js).

---

## 3. Maillage vers `/agence-geo-montreal` — contextuel uniquement

- **Ne pas** ajouter `/agence-geo-montreal` à [`REQUIRED_INTERNAL_LINKS`](lib/data/seo-growth-pages.js) ni mécaniser un lien sur toutes les pages growth.
- Ajouter ou renforcer le lien **page par page**, lorsque la progression lecteur → pilier Montréal est naturelle (services Montréal/Québec, comparatif GEO, plateformes reliées au mandat local, ressources qui parlent de cadre/mandat, etc.).
- Harmoniser les libellés d’ancre là où le lien existe déjà ; éviter la répétition abusive dans un même écran.

---

## 4. Homepage — micro-section premium (sobre)

**Fichier :** [`features/public/home/TrouvablePremiumPreview.jsx`](features/public/home/TrouvablePremiumPreview.jsx)

- Ajouter une **bande courte** (titre léger + 1–2 phrases + CTA) qui renforce l’ancre **« agence GEO à Montréal »** vers `/agence-geo-montreal`.
- **Pas** de grand bloc type « SEO landing » : conserver le flow et le ton premium existants.

---

## 5. Check-list métadonnées par page P1

Ajuster la copie dans [`lib/data/seo-growth-pages.js`](lib/data/seo-growth-pages.js) pour les slugs P1 concernés, **incluant** les six plateformes ci-dessus ; ville dans [`VillePage.jsx`](features/public/city/VillePage.jsx) / [`geo-architecture`](lib/data/geo-architecture.js) si besoin.

- Title, meta description (via `fitMetaDescription`), H1 alignés ; FAQ enrichissables sans supprimer les entrées existantes ; canonical inchangé (déjà émis).
- Champs `priority` (`mesurer-visibilite-ia`, `claude`) : optionnel, cohérence documentaire uniquement — **sans modifier** [`app/sitemap.js`](app/sitemap.js).

---

## 6. Renforcer `/agence-geo-montreal` (contenu business)

**Données + UI :** comme prévu — [`SEO_GROWTH_PAGES`](lib/data/seo-growth-pages.js) + [`AgenceGeoMontrealPage.jsx`](features/public/seo-growth/pages/AgenceGeoMontrealPage.jsx) avec les six thèmes métier (segments Montréal, rôle agence GEO, exemples de requêtes, SEO vs GEO vs consultant IA, mandat Trouvable, signaux locaux).

---

## 7. Pilier `/ressources/mesurer-visibilite-ia`

**Données +** [`MesurerVisibiliteIaPage.jsx`](features/public/seo-growth/pages/MesurerVisibiliteIaPage.jsx) : sections définition, indicateurs, exemples de prompts, tableau de mesure, comparaison concurrents (méthode honnête), méthode Trouvable ; H1 conforme à la règle stricte.

---

## 8. `/villes/montreal`

[`VillePageClient.jsx`](features/public/city/VillePageClient.jsx) : H1 descriptif aligné sur le title (ex. intention « Visibilité IA à Montréal ») ; `<h1>` statique sans `motion` sur le texte du titre ; lien contextuel vers `/agence-geo-montreal` si pertinent.

---

## 9. Validation obligatoire après modification

Avant de considérer la livraison terminée :

| Contrôle | Critère |
|----------|---------|
| H1 | **Exactement un** `<h1>` par page P1 (et plateformes / ville Montréal concernées) |
| H1 | **Non vide**, texte = intention page |
| H1 | **Visible** au premier rendu (pas `opacity-0`, pas dépendant d’animation pour afficher le texte) |
| Title | Présent (`generateMetadata` / `buildSeoGrowthMetadata`) |
| Meta description | Présente |
| Canonical | Présent (`alternates.canonical`) |
| FAQ + breadcrumbs | Schémas JSON-LD toujours valides via [`GeoSeoInjector`](features/public/shared/GeoSeoInjector.jsx) (pas de suppression des types existants) |
| Liens internes | **Aucun** lien cassé (href connus du site ; correction Claude / audit manuel des nouveaux liens) |
| Lint | `npm run lint` |
| Build | `npm run build` **si possible** dans l’environnement |

Optionnel : vue source HTML ou inspection rapide par URL pour les pages P1 modifiées.

---

## 10. Contraintes — non-négociables

- **Ne pas modifier** [`app/sitemap.js`](app/sitemap.js), `robots.txt`, portail, admin, espace client, auth, Supabase (le sitemap fonctionne ; aucun changement sauf bug avéré hors périmètre).
- **Aucune nouvelle route** ; **ne pas supprimer** les schémas FAQ / Breadcrumb / Service / Article existants — extensions de contenu uniquement.

---

## Ordre d’exécution recommandé

1. Règle H1 stricte sur tous les héros growth + SEO IA génératif + ville Montréal.
2. Six plateformes : bloc éditorial + H1 + vérification unicité H1 dans le mock.
3. Maillage contextuel `/agence-geo-montreal` + correction lien Claude.
4. Micro-section homepage sobre.
5. Contenu Agence Montréal + Mesurer pilier.
6. Repasse metadata/copy P1.
7. Validation obligatoire (tableau §9) : lint + build.
