# Routing Map

The application is dormant; production serves parking only. This map links preserved Next.js routes to their canonical implementation modules after the public/admin/portal/espace/auth split.

## Public marketing routes

- `/`
    - route: `src/app/page.jsx`
    - implementation: `src/features/public/home/HomePage.jsx`
- `/a-propos`
    - route layout: `src/app/a-propos/layout.jsx`
    - implementation: `src/features/public/about/AboutLayout.jsx`
    - page: `src/features/public/about/AboutPage.jsx`
- `/contact`
    - route: `src/app/contact/page.jsx`
    - implementation: `src/features/public/contact/ContactPage.jsx`
- `/methodologie`
    - route: `src/app/methodologie/page.jsx`
    - implementation: `src/features/public/methodology/MethodologyPage.jsx`
- `/offres`
    - route: `src/app/offres/page.jsx`
    - implementation: `src/features/public/offers/OffersPage.jsx`
- `/notre-mesure`
    - route: `src/app/notre-mesure/page.jsx`
    - implementation: `src/features/public/measurement/MeasurementPage.jsx`
- `/etudes-de-cas`
    - route: `src/app/etudes-de-cas/page.jsx`
    - implementation: `src/features/public/case-studies/CaseStudiesPage.jsx`
- `/etudes-de-cas/dossier-type`
    - route: `src/app/etudes-de-cas/dossier-type/page.jsx`
    - implementation: `src/features/public/case-study-sample/CaseStudySamplePage.jsx`
- `/mentions-legales`
    - route: `src/app/mentions-legales/page.jsx`
    - implementation: `src/features/public/legal-notice/LegalNoticePage.jsx`
- `/politique-confidentialite`
    - route: `src/app/politique-confidentialite/page.jsx`
    - implementation: `src/features/public/privacy-policy/PrivacyPolicyPage.jsx`
- `/clients/[clientSlug]`
    - route: `src/app/clients/[clientSlug]/page.jsx`
    - implementation: `src/features/public/client-profile/ClientProfilePage.jsx`
- `/expertises/[expertiseSlug]`
    - route: `src/app/expertises/[expertiseSlug]/page.jsx`
    - implementation: `src/features/public/expertise/ExpertisePage.jsx`
- `/villes/[villeSlug]`
    - route: `src/app/villes/[villeSlug]/page.jsx`
    - implementation: `src/features/public/city/VillePage.jsx`

## Portal routes

- `/portal`
    - outer layout: `src/app/portal/layout.jsx`
    - implementation: `src/features/portal/PortalLayout.jsx`
- `/portal`
    - app layout: `src/app/portal/(app)/layout.jsx`
    - implementation: `src/features/portal/PortalAppLayout.jsx`
- `/portal`
    - route: `src/app/portal/(app)/page.jsx`
    - implementation: `src/features/portal/PortalIndexPage.jsx`
- `/portal/[clientSlug]`
    - route: `src/app/portal/(app)/[clientSlug]/page.jsx`
    - implementation: `src/features/portal/PortalClientPage.jsx`
- `/portal/sign-in`
    - route: `src/app/portal/sign-in/[[...sign-in]]/page.jsx`
    - implementation: `src/features/auth/portal/PortalSignInPage.jsx`

## Espace routes

- `/espace`
    - route layout: `src/app/espace/layout.jsx`
    - implementation: `src/features/espace/EspaceLayout.jsx`
- `/espace`
    - route: `src/app/espace/[[...sign-in]]/page.jsx`
    - implementation: `src/features/auth/espace/EspaceSignInPage.jsx`
- `/espace/apres-connexion`
    - route: `src/app/espace/apres-connexion/page.jsx`
    - implementation: `src/features/espace/PostSignInPage.jsx`

## Admin access and workspace shell

- `/admin`
    - outer layout: `src/app/admin/layout.jsx`
    - implementation: metadata shell only
- `/admin/sign-in`
    - layout: `src/app/admin/sign-in/layout.jsx`
    - implementation: `src/features/auth/admin/AdminClerkProvider.jsx`
- `/admin/sign-in`
    - route: `src/app/admin/sign-in/[[...sign-in]]/page.jsx`
    - implementation: `src/features/auth/admin/AdminSignInPage.jsx`
- `/admin`
    - workspace layout: `src/app/admin/(workspace)/layout.jsx`
    - implementation: `src/features/admin/shared/layout/AdminWorkspaceLayout.jsx`
- `/admin`
    - route: `src/app/admin/(workspace)/page.jsx`
    - implementation: `src/features/admin/home/AdminDashboardPage.jsx`

## Admin portfolio routes

- `/admin/clients`
    - route: `src/app/admin/(workspace)/clients/page.jsx`
    - implementation: `src/features/admin/portfolio/AdminClientsPage.jsx`
- `/admin/clients/onboarding`
    - route: `src/app/admin/(workspace)/clients/onboarding/page.jsx`
    - implementation: `src/features/admin/portfolio/ClientOnboardingPage.jsx`
- `/admin/clients/new`
    - route: `src/app/admin/(workspace)/clients/new/page.jsx`
    - behavior: redirect to `/admin/clients/onboarding`
- `/admin/clients/create`
    - route: `src/app/admin/(workspace)/clients/create/page.jsx`
    - behavior: redirect to `/admin/clients/onboarding`
- `/admin/clients/[clientId]/edit`
    - route: `src/app/admin/(workspace)/clients/[clientId]/edit/page.jsx`
    - implementation: `src/features/admin/portfolio/ClientEditPage.jsx`
- `/admin/clients/[clientId]`
    - layout: `src/app/admin/(workspace)/clients/[clientId]/layout.jsx`
    - implementation: `src/features/admin/shared/layout/ClientWorkspaceLayout.jsx`

## Admin dossier section

Thin route files under `src/app/admin/(workspace)/clients/[clientId]/dossier/**` mount dossier implementations under `src/features/admin/dossier/*`.

- `/admin/clients/[clientId]/dossier` -> `DossierOverviewView`
- `/admin/clients/[clientId]/dossier/activity` -> `DossierActivityView`
- `/admin/clients/[clientId]/dossier/connectors` -> `DossierConnectorsView`
- `/admin/clients/[clientId]/dossier/settings` -> `src/features/admin/geo/GeoSettingsView.jsx`
- `/admin/clients/[clientId]/dossier/audit` -> `src/features/admin/dossier/audit-lab/OperatorAuditLabView.jsx`
- `/admin/clients/[clientId]/dossier/audit/comparison` -> `src/features/admin/dossier/audit-lab/OperatorAuditComparisonView.jsx`

## Admin GEO section

Thin route files under `src/app/admin/(workspace)/clients/[clientId]/geo/**` mount GEO implementations under `src/features/admin/geo/*`.

- `/admin/clients/[clientId]/geo` -> `GeoOverviewView`
- `/admin/clients/[clientId]/geo/alerts` -> `GeoAlertsView`
- `/admin/clients/[clientId]/geo/compare` -> `GeoCompareView`
- `/admin/clients/[clientId]/geo/consistency` -> `GeoConsistencyView`
- `/admin/clients/[clientId]/geo/continuous` -> `GeoContinuousView`
- `/admin/clients/[clientId]/geo/crawlers` -> `GeoCrawlersView`
- `/admin/clients/[clientId]/geo/llms-txt` -> `GeoLlmsTxtView`
- `/admin/clients/[clientId]/geo/models` -> `GeoModelesView`
- `/admin/clients/[clientId]/geo/opportunities` -> `GeoAmeliorerView`
- `/admin/clients/[clientId]/geo/prompts` -> `GeoPromptsView`
- `/admin/clients/[clientId]/geo/readiness` -> `GeoReadinessView`
- `/admin/clients/[clientId]/geo/runs` -> `GeoRunsView`
- `/admin/clients/[clientId]/geo/schema` -> `GeoSchemaView`
- `/admin/clients/[clientId]/geo/signals` -> `GeoSignalsView`
- `/admin/clients/[clientId]/geo/social` -> `GeoSocialView`

## Admin SEO section

Thin route files under `src/app/admin/(workspace)/clients/[clientId]/seo/**` mount SEO implementations under `src/features/admin/seo/*` or redirect.

- `/admin/clients/[clientId]/seo` -> redirect to `/admin/clients/[clientId]/seo/visibility`
- `/admin/clients/[clientId]/seo/visibility` -> `SeoVisibilityView`
- `/admin/clients/[clientId]/seo/health` -> `SeoHealthView`
- `/admin/clients/[clientId]/seo/local` -> `SeoLocalView`
- `/admin/clients/[clientId]/seo/on-page` -> `SeoOnPageView`
- `/admin/clients/[clientId]/seo/content` -> `SeoContentView`
- `/admin/clients/[clientId]/seo/cannibalization` -> `SeoCannibalizationView`
- `/admin/clients/[clientId]/seo/correction-prompts` -> `SeoCorrectionPromptsView`
- `/admin/clients/[clientId]/seo/opportunities` -> `SeoOpportunitiesView`

## Admin AGENT section

Thin route files under `src/app/admin/(workspace)/clients/[clientId]/agent/**` mount AGENT implementations under `src/features/admin/agent/*`.

- `/admin/clients/[clientId]/agent` -> `AgentOverviewView`
- `/admin/clients/[clientId]/agent/actionability` -> `AgentActionabilityView`
- `/admin/clients/[clientId]/agent/competitors` -> `AgentCompetitorsView`
- `/admin/clients/[clientId]/agent/fixes` -> `AgentFixesView`
- `/admin/clients/[clientId]/agent/protocols` -> `AgentProtocolsView`
- `/admin/clients/[clientId]/agent/readiness` -> `AgentReadinessView`
- `/admin/clients/[clientId]/agent/visibility` -> `AgentVisibilityView`

## Admin portal section

- `/admin/clients/[clientId]/portal`
    - route: `src/app/admin/(workspace)/clients/[clientId]/portal/page.jsx`
    - implementation: `src/features/admin/portal/ClientPortalPage.jsx`

## Admin compatibility aliases

Legacy admin aliases remain as redirect-only route files so existing bookmarks continue to resolve.

- `/admin/clients/[clientId]` -> `/admin/clients/[clientId]/dossier`
- `/admin/clients/[clientId]/overview` -> `/admin/clients/[clientId]/geo`
- `/admin/clients/[clientId]/audit` -> `/admin/clients/[clientId]/dossier/audit`
- `/admin/clients/[clientId]/crawlers` -> `/admin/clients/[clientId]/geo/crawlers`
- `/admin/clients/[clientId]/geo-compare` -> `/admin/clients/[clientId]/geo/compare`
- `/admin/clients/[clientId]/llms-txt` -> `/admin/clients/[clientId]/geo/llms-txt`
- `/admin/clients/[clientId]/models` -> `/admin/clients/[clientId]/geo/models`
- `/admin/clients/[clientId]/opportunities` -> `/admin/clients/[clientId]/geo/opportunities`
- `/admin/clients/[clientId]/prompts` -> `/admin/clients/[clientId]/geo/prompts`
- `/admin/clients/[clientId]/runs` -> `/admin/clients/[clientId]/geo/runs`
- `/admin/clients/[clientId]/schema` -> `/admin/clients/[clientId]/geo/schema`
- `/admin/clients/[clientId]/settings` -> `/admin/clients/[clientId]/dossier/settings`
- `/admin/clients/[clientId]/signals` -> `/admin/clients/[clientId]/geo/signals`
- `/admin/clients/[clientId]/social` -> `/admin/clients/[clientId]/geo/social`
- `/admin/clients/[clientId]/visibility` -> `/admin/clients/[clientId]/seo/visibility`

## Other preserved public and machine-readable routes

- `/agence-geo-montreal`, `/agence-geo-quebec`, `/services/*`, `/ressources/*`, `/plateformes/*`: explicit route files mount `src/features/public/seo-growth/SeoGrowthPage.jsx`; data and metadata come from `src/lib/data/seo-growth-pages.js`. These are preserved application URLs, not pages served by the dormant production parking.
- `/recherche`: route-local search surface under `src/app/recherche/`.
- `/docs/api`: explicit documentation page under `src/app/docs/api/`.
- `/robots.txt`, `/sitemap.xml`, `/rss.xml`, `/llms.txt`, `/llms-full.txt`, `/ai.txt`, `/ai/*.json`, `/markdown`, `/__agent/markdown`, `/mcp`: explicit handlers/metadata files in `src/app`; discovery helpers remain in `src/lib/agent-discovery/`. The encoded `%5F%5Fagent` folder preserves the public `__agent` URL convention.
- `/api/admin/*`: operator-authorized handlers for clients, audits, prompts, slices, comparison and remediation.
- `/api/connectors/google/*`: Google OAuth entry/callback; `/api/oauth/*`: authorization/token handlers.
- `/api/cron/continuous/{dispatch,snapshot,worker}`: dormant authenticated job handlers, with no automatic Cron schedule.
- `/api/health` and `/api/submit-lead`: explicit health/form handlers. They are not invoked by the static parking.

## Additional operator routes and redirects

- `/admin/geo-compare`: global comparison mounting `src/features/admin/geo/GeoCompareView.tsx`.
- `/admin/clients/[clientId]/seo/content`: `src/features/admin/seo/SeoContentView.tsx`.
- `/admin/clients/[clientId]/seo/actions` redirects to `/admin/clients/[clientId]/seo/opportunities`.
- `/admin/clients/[clientId]/continuous` redirects to `/admin/clients/[clientId]/geo/continuous`.
- `/admin/clients/[clientId]/citations` redirects to `/admin/clients/[clientId]/geo/signals?focus=citations`.
- `/admin/clients/[clientId]/competitors` redirects to `/admin/clients/[clientId]/geo/signals?focus=competitors`.

`next.config.mjs` also preserves permanent historical redirects: `/admin/dashboard` → `/admin/clients`, `/admin/dashboard/new` → `/admin/clients/new`, `/admin/dashboard/:clientId` → `/admin/clients/:clientId/overview`, and `/admin/clients/:id/seo-geo` → `/admin/clients/:id/overview`. Route aliases run inside the existing auth/layout boundaries; they must preserve status, destination, query parameters and request order when refactored.
