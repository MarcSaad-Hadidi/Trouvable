# Routing Map

This map links active Next.js routes to their canonical implementation modules after the public/admin/portal/espace/auth split.

## Public marketing routes

- `/`
  - route: `app/page.jsx`
  - implementation: `features/public/home/HomePage.jsx`
- `/a-propos`
  - route layout: `app/a-propos/layout.jsx`
  - implementation: `features/public/about/AboutLayout.jsx`
  - page: `features/public/about/AboutPage.jsx`
- `/contact`
  - route: `app/contact/page.jsx`
  - implementation: `features/public/contact/ContactPage.jsx`
- `/methodologie`
  - route: `app/methodologie/page.jsx`
  - implementation: `features/public/methodology/MethodologyPage.jsx`
- `/offres`
  - route: `app/offres/page.jsx`
  - implementation: `features/public/offers/OffersPage.jsx`
- `/notre-mesure`
  - route: `app/notre-mesure/page.jsx`
  - implementation: `features/public/measurement/MeasurementPage.jsx`
- `/etudes-de-cas`
  - route: `app/etudes-de-cas/page.jsx`
  - implementation: `features/public/case-studies/CaseStudiesPage.jsx`
- `/etudes-de-cas/dossier-type`
  - route: `app/etudes-de-cas/dossier-type/page.jsx`
  - implementation: `features/public/case-study-sample/CaseStudySamplePage.jsx`
- `/mentions-legales`
  - route: `app/mentions-legales/page.jsx`
  - implementation: `features/public/legal-notice/LegalNoticePage.jsx`
- `/politique-confidentialite`
  - route: `app/politique-confidentialite/page.jsx`
  - implementation: `features/public/privacy-policy/PrivacyPolicyPage.jsx`
- `/clients/[clientSlug]`
  - route: `app/clients/[clientSlug]/page.jsx`
  - implementation: `features/public/client-profile/ClientProfilePage.jsx`
- `/expertises/[expertiseSlug]`
  - route: `app/expertises/[expertiseSlug]/page.jsx`
  - implementation: `features/public/expertise/ExpertisePage.jsx`
- `/villes/[villeSlug]`
  - route: `app/villes/[villeSlug]/page.jsx`
  - implementation: `features/public/city/VillePage.jsx`

## Portal routes

- `/portal`
  - outer layout: `app/portal/layout.jsx`
  - implementation: `features/portal/PortalLayout.jsx`
- `/portal`
  - app layout: `app/portal/(app)/layout.jsx`
  - implementation: `features/portal/PortalAppLayout.jsx`
- `/portal`
  - route: `app/portal/(app)/page.jsx`
  - implementation: `features/portal/PortalIndexPage.jsx`
- `/portal/[clientSlug]`
  - route: `app/portal/(app)/[clientSlug]/page.jsx`
  - implementation: `features/portal/PortalClientPage.jsx`
- `/portal/sign-in`
  - route: `app/portal/sign-in/[[...sign-in]]/page.jsx`
  - implementation: `features/auth/portal/PortalSignInPage.jsx`

## Espace routes

- `/espace`
  - route layout: `app/espace/layout.jsx`
  - implementation: `features/espace/EspaceLayout.jsx`
- `/espace`
  - route: `app/espace/[[...sign-in]]/page.jsx`
  - implementation: `features/auth/espace/EspaceSignInPage.jsx`
- `/espace/apres-connexion`
  - route: `app/espace/apres-connexion/page.jsx`
  - implementation: `features/espace/PostSignInPage.jsx`

## Admin access and workspace shell

- `/admin`
  - outer layout: `app/admin/layout.jsx`
  - implementation: metadata shell only
- `/admin/sign-in`
  - layout: `app/admin/sign-in/layout.jsx`
  - implementation: `features/auth/admin/AdminClerkProvider.jsx`
- `/admin/sign-in`
  - route: `app/admin/sign-in/[[...sign-in]]/page.jsx`
  - implementation: `features/auth/admin/AdminSignInPage.jsx`
- `/admin`
  - workspace layout: `app/admin/(workspace)/layout.jsx`
  - implementation: `features/admin/dashboard/shared/layout/AdminWorkspaceLayout.jsx`
- `/admin`
  - route: `app/admin/(workspace)/page.jsx`
  - implementation: `features/admin/dashboard/home/AdminDashboardPage.jsx`

## Admin portfolio routes

- `/admin/clients`
  - route: `app/admin/(workspace)/clients/page.jsx`
  - implementation: `features/admin/dashboard/portfolio/AdminClientsPage.jsx`
- `/admin/clients/onboarding`
  - route: `app/admin/(workspace)/clients/onboarding/page.jsx`
  - implementation: `features/admin/dashboard/portfolio/ClientOnboardingPage.jsx`
- `/admin/clients/new`
  - route: `app/admin/(workspace)/clients/new/page.jsx`
  - behavior: redirect to `/admin/clients/onboarding`
- `/admin/clients/create`
  - route: `app/admin/(workspace)/clients/create/page.jsx`
  - behavior: redirect to `/admin/clients/onboarding`
- `/admin/clients/[clientId]/edit`
  - route: `app/admin/(workspace)/clients/[clientId]/edit/page.jsx`
  - implementation: `features/admin/dashboard/portfolio/ClientEditPage.jsx`
- `/admin/clients/[clientId]`
  - layout: `app/admin/(workspace)/clients/[clientId]/layout.jsx`
  - implementation: `features/admin/dashboard/shared/layout/ClientWorkspaceLayout.jsx`

## Admin dossier section

Thin route files under `app/admin/(workspace)/clients/[clientId]/dossier/**` mount dossier implementations under `features/admin/dashboard/dossier/*`.

- `/admin/clients/[clientId]/dossier` -> `DossierOverviewView`
- `/admin/clients/[clientId]/dossier/activity` -> `DossierActivityView`
- `/admin/clients/[clientId]/dossier/connectors` -> `DossierConnectorsView`
- `/admin/clients/[clientId]/dossier/settings` -> `features/admin/dashboard/geo/GeoSettingsView.jsx`
- `/admin/clients/[clientId]/dossier/audit` -> `features/admin/dashboard/dossier/audit-lab/OperatorAuditLabView.jsx`
- `/admin/clients/[clientId]/dossier/audit/comparison` -> `features/admin/dashboard/dossier/audit-lab/OperatorAuditComparisonView.jsx`

## Admin GEO section

Thin route files under `app/admin/(workspace)/clients/[clientId]/geo/**` mount GEO implementations under `features/admin/dashboard/geo/*`.

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

Thin route files under `app/admin/(workspace)/clients/[clientId]/seo/**` mount SEO implementations under `features/admin/dashboard/seo/*` or redirect.

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

Thin route files under `app/admin/(workspace)/clients/[clientId]/agent/**` mount AGENT implementations under `features/admin/dashboard/agent/*`.

- `/admin/clients/[clientId]/agent` -> `AgentOverviewView`
- `/admin/clients/[clientId]/agent/actionability` -> `AgentActionabilityView`
- `/admin/clients/[clientId]/agent/competitors` -> `AgentCompetitorsView`
- `/admin/clients/[clientId]/agent/fixes` -> `AgentFixesView`
- `/admin/clients/[clientId]/agent/protocols` -> `AgentProtocolsView`
- `/admin/clients/[clientId]/agent/readiness` -> `AgentReadinessView`
- `/admin/clients/[clientId]/agent/visibility` -> `AgentVisibilityView`

## Admin portal section

- `/admin/clients/[clientId]/portal`
  - route: `app/admin/(workspace)/clients/[clientId]/portal/page.jsx`
  - implementation: `features/admin/dashboard/portal/ClientPortalPage.jsx`

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
