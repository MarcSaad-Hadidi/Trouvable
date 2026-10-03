# DB Reconciliation Audit

> Référence historique du 20 mars 2026 conservée pour dérives SQL et reconstruction. Les observations live sont celles de cette période, sans preuve du catalogue distant actuel. Les anciens chemins/propositions restent historiques ; le code actuel utilise `src/lib/db/*` et `src/features/portal/server/*`. Ne pas appliquer ce SQL à une base distante ni retirer les scripts historiques sans reconstruction locale jetable et comparaison des contraintes/RLS.

Date: 2026-03-20

## Scope

This audit uses the current Trouvable repository as the source of truth.

Reviewed surfaces:

- `lib/db.js`
- `lib/operator-data.js`
- `lib/operator-intelligence/*`
- `lib/portal-data.js`
- `lib/portal-access.js`
- `lib/actions/*`
- `app/api/**`
- operator pages and server actions
- portal loaders
- public profile and sitemap loaders
- audit pipeline files that persist or derive database data
- `supabase/migrations/*`
- legacy `supabase/setup_*.sql` and `supabase/schema.sql`

Important limitation:

- I cannot inspect the live Supabase catalog from this workspace.
- Drift below is inferred from the real code, the migration history in the repo, and the runtime mismatches already observed.

Confirmed later during live debugging:

- A controlled live insert against `public.opportunities` using a real `client_geo_profiles.id` and a real `client_site_audits.id` failed with:
  - `Key (client_id)=(...) is not present in table "clients".`
- This confirms at least one live environment still has `public.opportunities.client_id` bound to a legacy foreign key targeting `public.clients`, not `public.client_geo_profiles(id)`.
- The payload was valid. The failure was caused by stale live foreign key metadata that was not corrected by earlier additive migrations.

## Root Cause

Trouvable currently has two schema histories living side by side:

1. Older setup SQL files in `supabase/`
2. Newer canonical migrations in `supabase/migrations/`

The app code has moved to the newer contract, but some environments were likely created or partially updated from the older setup SQL files only. That leaves tables present but structurally behind the current code.

There is also a second drift class:

- additive/idempotent migrations that use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` do not repair existing foreign keys that already point at legacy tables
- this is exactly what happened with the live `opportunities_client_id_fkey`

## Tables Used By The App

### `public.leads`

Used by:

- `app/api/submit-lead/route.js`

Canonical fields used now:

- `id`
- `created_at`
- `name`
- `email`
- `phone`
- `business_type`
- `message`
- `status`
- `page_path`
- `utm_source`
- `utm_medium`
- `utm_campaign`

Canonical status values:

- `new`
- `contacted`
- `closed`

### `public.rate_limits`

Used by:

- `app/api/submit-lead/route.js`
- RPC `public.check_rate_limit(text, int, int)`

Canonical fields used now:

- `ip`
- `window_start`
- `request_count`

Required function/permissions:

- `public.check_rate_limit`
- executable by `service_role`

### `public.client_geo_profiles`

Used by:

- `lib/db.js`
- `lib/operator-data.js`
- `lib/portal-data.js`
- `lib/portal-access.js`
- `lib/actions/saveClientProfile.js`
- `app/sitemap.js`
- `lib/supabase/server.js`
- admin client pages / edit pages / SEO-GEO cockpit / audit pages
- merge apply path

Canonical top-level fields:

- `id`
- `client_name`
- `client_slug`
- `website_url`
- `business_type`
- `seo_title`
- `seo_description`
- `social_profiles`
- `address`
- `geo_faqs`
- `contact_info`
- `business_details`
- `seo_data`
- `geo_ai_data`
- `internal_notes`
- `publication_status`
- `is_published`
- `archived_at`
- `notes`
- `target_region`
- `created_at`
- `updated_at`

Canonical JSON fields used now:

- `contact_info.phone`
- `contact_info.public_email`
- `business_details.short_desc`
- `business_details.long_desc`
- `business_details.maps_url`
- `business_details.opening_hours`
- `business_details.services`
- `business_details.areas_served`
- `seo_data.main_keywords`
- `seo_data.secondary_keywords`
- `seo_data.target_cities`
- `seo_data.value_proposition`
- `geo_ai_data.client_types`
- `geo_ai_data.objections`
- `geo_ai_data.differentiators`
- `geo_ai_data.proofs`
- `geo_ai_data.guarantees`
- `geo_ai_data.ai_summary_short`
- `geo_ai_data.ai_summary_long`
- `address.street`
- `address.city`
- `address.region`
- `address.postalCode`
- `address.country`

Canonical publication contract:

- `publication_status` is canonical
- `is_published` is compatibility/public-read visibility

Legacy compatibility fields still tolerated:

- `contact_info.email` -> compatibility alias for `contact_info.public_email`
- `business_details.short_description` -> compatibility alias for `business_details.short_desc`

### `public.client_site_audits`

Used by:

- `lib/db.js`
- `lib/portal-data.js`
- audit pages
- audit API routes
- audit pipeline

Canonical fields used now:

- `id`
- `client_id`
- `source_url`
- `resolved_url`
- `audit_version`
- `scan_status`
- `scanned_pages`
- `seo_score`
- `geo_score`
- `seo_breakdown`
- `geo_breakdown`
- `extracted_data`
- `issues`
- `strengths`
- `prefill_suggestions`
- `error_message`
- `created_at`

Canonical scan status values:

- `pending`
- `running`
- `success`
- `partial_error`
- `failed`

Canonical JSON/default expectation:

- `scanned_pages` = array
- `seo_breakdown` = object
- `geo_breakdown` = object
- `extracted_data` = object
- `issues` = array
- `strengths` = array
- `prefill_suggestions` = array

### `public.tracked_queries`

Used by:

- `lib/db.js`
- prompt CRUD APIs
- GEO prompt workspace
- portal summaries

Canonical fields used now:

- `id`
- `client_id`
- `query_text`
- `category`
- `locale`
- `query_type`
- `is_active`
- `created_at`
- `updated_at`

Canonical contract:

- `category` is canonical
- `query_type` is compatibility metadata and should mirror `category`

Canonical taxonomy used by code:

- `local_intent`
- `service_intent`
- `brand`
- `competitor_comparison`
- `discovery`

### `public.query_runs`

Used by:

- `lib/db.js`
- query run API
- GEO runs / overview / citations / competitors / models views
- client detail history

Canonical fields used now:

- `id`
- `client_id`
- `tracked_query_id`
- `query_text`
- `provider`
- `model`
- `response_text`
- `target_found`
- `target_position`
- `total_mentioned`
- `raw_analysis`
- `parsed_response`
- `status`
- `created_at`

Canonical contract:

- `query_text` is a stored snapshot of the tracked prompt text at run time
- `tracked_query_id` is optional compatibility/reference linkage

Canonical status values:

- `pending`
- `running`
- `completed`
- `failed`

### `public.query_mentions`

Used by:

- `lib/db.js`
- GEO citations / competitors / runs intelligence

Canonical fields used now:

- `id`
- `query_run_id`
- `business_name`
- `position`
- `context`
- `is_target`
- `sentiment`
- `entity_type`
- `created_at`

Canonical entity types:

- `business`
- `competitor`
- `source`

### `public.opportunities`

Used by:

- `lib/db.js`
- `lib/portal-data.js`
- audit pipeline
- GEO opportunity center
- client detail dashboard

Canonical fields used now:

- `id`
- `client_id`
- `audit_id`
- `title`
- `description`
- `priority`
- `category`
- `source`
- `status`
- `created_at`

Canonical contract:

- `priority` is canonical
- `severity` is a legacy compatibility field in older environments and should mirror `priority` while compatibility remains necessary

Canonical priority values:

- `high`
- `medium`
- `low`

Canonical source values:

- `observed`
- `inferred`
- `recommended`

Canonical status values:

- `open`
- `in_progress`
- `done`
- `dismissed`

### `public.merge_suggestions`

Used by:

- `lib/db.js`
- audit pipeline
- merge apply/reject APIs
- GEO opportunity center
- client detail dashboard

Canonical fields used now:

- `id`
- `client_id`
- `audit_id`
- `field_name`
- `current_value`
- `suggested_value`
- `confidence`
- `rationale`
- `source`
- `status`
- `applied_at`
- `created_at`

Canonical confidence values:

- `high`
- `medium`
- `low`

Canonical source values:

- `observed`
- `inferred`
- `recommended`

Canonical status values:

- `pending`
- `applied`
- `rejected`

### `public.actions`

Used by:

- `lib/db.js`
- `lib/portal-data.js`
- operator activity summaries
- multiple admin mutation routes

Canonical fields used now:

- `id`
- `client_id`
- `action_type`
- `details`
- `performed_by`
- `created_at`

Canonical contract:

- `action_type` remains open text on purpose
- `details` is JSONB with `{}` default

### `public.client_portal_access`

Used by:

- `lib/portal-access.js`
- portal server-side membership resolution
- operator portal access management

Canonical fields used now:

- `id`
- `client_id`
- `contact_email`
- `clerk_user_id`
- `member_type`
- `portal_role`
- `status`
- `created_at`
- `updated_at`

Canonical contract:

- `contact_email` is stored normalized with `trim + lowercase`
- access resolves only from `clerk_user_id` or verified Clerk email

Canonical member types:

- `client_contact`
- `client_staff`
- `internal_staff`

Canonical portal roles:

- `owner`
- `viewer`

Canonical status values:

- `active`
- `revoked`

## Drift Found

### Migration History Drift

- Older setup SQL files define thinner table shapes than the current code expects.
- The repo’s newer canonical migration was not enough to guarantee all legacy environments were fully reconciled.

### Missing Column Drift

Confirmed or highly likely in legacy environments:

- `query_runs.query_text`
- `query_runs.parsed_response`
- `query_runs.status`
- `query_mentions.entity_type`
- `tracked_queries.locale`
- `tracked_queries.query_type`
- `client_geo_profiles.publication_status`
- `client_geo_profiles.contact_info`
- `client_geo_profiles.business_details`
- `client_geo_profiles.seo_data`
- `client_geo_profiles.geo_ai_data`
- `client_geo_profiles.internal_notes`
- `client_portal_access` and its phase-1 columns in pre-phase-1 environments

### Legacy Constraint Drift

- old `opportunities.severity` constraints can still be active while the code now writes `priority`
- old or incomplete `query_runs.status` checks may still exist
- `prefill_suggestions` may still behave like an object-shaped field from early setup SQL

### Default Drift

- `client_site_audits.prefill_suggestions` was previously created with `{}` in older setup SQL
- legacy tables may miss defaults now assumed by the app for:
  - `publication_status`
  - `is_published`
  - JSONB fields on `client_geo_profiles`
  - `query_runs.status`
  - `query_runs.raw_analysis`
  - `query_runs.parsed_response`
  - `query_mentions.entity_type`
  - `actions.details`

### Compatibility Drift

- `publication_status` is canonical, but `is_published` is still needed for public reads and must stay synchronized
- `contact_info.public_email` is canonical, but `contact_info.email` still appears in compatibility readers
- `business_details.short_desc` is canonical, but `business_details.short_description` still appears in compatibility readers
- `tracked_queries.category` is canonical, but `query_type` still exists and must remain aligned
- `opportunities.priority` is canonical, but `severity` may still exist in legacy DBs

### Index Drift

Current code patterns justify indexes that were not consistently guaranteed by older setup SQL:

- `tracked_queries (client_id, is_active, created_at)`
- `query_runs (client_id, status, created_at desc)`
- `query_runs (tracked_query_id, created_at desc)`
- `query_mentions (query_run_id, entity_type, position)`
- `opportunities (client_id, status, created_at desc)`
- `merge_suggestions (client_id, status, created_at desc)`
- `actions (client_id, created_at desc)`
- `actions (client_id, action_type, created_at desc)`

### Trigger / Function Drift

The current app depends on these schema helpers being present and working:

- `public.update_updated_at_column()`
- `public.check_rate_limit()`
- updated-at triggers on:
  - `client_geo_profiles`
  - `tracked_queries`
  - `client_portal_access`

Additional compatibility triggers are warranted now for:

- `client_geo_profiles`
- `tracked_queries`
- `query_runs`
- `opportunities`

## Reconciliation Strategy

The new reconciliation migration should:

1. Re-assert all app-used columns defensively with `ADD COLUMN IF NOT EXISTS`
2. Re-assert defaults now relied on by the code
3. Backfill legacy/canonical compatibility fields
4. Drop stale check constraints that conflict with the current contract
5. Re-create canonical checks
6. Add compatibility triggers where the app still needs old and new fields to coexist
7. Add the missing composite indexes used by phase-1 and phase-2 query patterns

## Exact Fixes To Apply

### `client_geo_profiles`

- ensure phase-1 columns exist in legacy environments
- normalize null JSONB fields to objects or arrays as appropriate
- sync `publication_status` and `is_published`
- backfill `contact_info.public_email` from `contact_info.email`
- backfill `contact_info.email` from `contact_info.public_email`
- backfill `business_details.short_desc` from `business_details.short_description`
- backfill `business_details.short_description` from `business_details.short_desc`
- add a compatibility trigger so future writes keep those pairs aligned

### `client_site_audits`

- ensure all canonical columns exist
- normalize `prefill_suggestions` to an array
- normalize other JSON defaults
- re-assert `scan_status` check

### `tracked_queries`

- ensure `category`, `locale`, `query_type`, `is_active`, timestamps exist
- normalize blank or legacy category values toward the phase-2 taxonomy
- sync `query_type` from canonical `category`
- add a compatibility trigger for future writes

### `query_runs`

- ensure `query_text`, `response_text`, `status`, `parsed_response`, and other canonical columns exist
- backfill `query_text` from `tracked_queries.query_text` where possible
- backfill remaining blank `query_text` from stored analysis payloads when possible
- normalize `provider`, `model`, `status`, JSON defaults, and counters
- add a compatibility trigger so `query_text` is snapshotted automatically when possible

### `query_mentions`

- ensure `entity_type` exists and is normalized
- re-assert entity type check
- normalize null/default values used by the intelligence layer

### `opportunities`

- ensure canonical `priority` exists
- ensure legacy `severity` exists for compatibility
- backfill each from the other where needed
- neutralize stale `severity`-based checks
- re-assert canonical `priority`, `source`, and `status` checks
- add a compatibility trigger so `severity` mirrors `priority`

### `merge_suggestions`

- ensure canonical fields and defaults exist
- re-assert `confidence`, `source`, and `status` checks

### `actions`

- ensure `details` default exists
- add composite indexes for current activity queries

### `client_portal_access`

- re-assert phase-1 membership columns
- normalize stored `contact_email`
- re-assert checks and lookup indexes
- keep updated-at trigger in place

### `rate_limits`

- re-assert table defaults
- re-assert `check_rate_limit` and execution grants

## Risky Or Partial Areas

These are safe to harden broadly, but not all historical data can be perfectly reconstructed:

- very old `query_runs` rows with no `tracked_query_id`, no `query_text`, and no usable stored analysis payload can only be backfilled with a compatibility placeholder
- old `opportunities.severity` meanings are assumed to map directly to `priority`
- older freeform `tracked_queries.category` values can be normalized conservatively, but some intent nuance may still be better refined later through the app

## Future Cleanup Recommendations

After all environments are migrated and stable:

1. stop treating legacy setup SQL files in `supabase/` as runnable schema sources
2. keep only ordered migrations as the canonical DB history
3. remove `opportunities.severity` after all environments and any external consumers no longer depend on it
4. remove `tracked_queries.query_type` after all code reads `category` only
5. remove nested compatibility aliases like `contact_info.email` and `business_details.short_description` once all write paths and reads are fully canonical
