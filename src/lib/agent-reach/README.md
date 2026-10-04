# Agent Reach

Agent Reach is Trouvable's persisted community-intelligence layer for operator-facing external signals.

It replaces the old live-read Reddit snapshot path with a replayable pipeline that:

- collects community documents
- persists raw and normalized evidence
- extracts mentions
- builds reusable clusters
- derives operator opportunities
- exposes a DB-backed social slice to the admin UI

## Current scope

V1 is intentionally narrow.

- Active collector: Reddit search
- Active connector provider: `agent_reach`
- Active recurring job: `community_sync`
- Admin surface: social/community intelligence slice

The contracts and schema already reserve room for future sources (`web`, `github`, `x`, `youtube`), but no collector for those sources is implemented yet.

## Runtime flow

The end-to-end path is:

1. `lib/continuous/jobs.js` dispatches `community_sync`.
2. `lib/agent-reach/pipeline.js` runs the community pipeline for a client.
3. The pipeline writes collection runs, documents, mentions, clusters, and opportunities.
4. `lib/operator-intelligence/social.js` reads the persisted records.
5. `features/admin/dashboard/geo/GeoSocialView.tsx` renders the operator-facing view.

This keeps collection and presentation separate. The UI no longer depends on a live Reddit request at render time.

## Module map

- `contracts.js`: domain enums, evidence helper, and Zod schemas
- `pipeline.js`: seed generation, collection, normalization, enrichment, clustering, and opportunity derivation

Supporting modules outside this folder:

- `lib/db/community.js`: persistence access layer for all community tables
- `lib/connectors/providers/agent-reach.js`: connector snapshot for overview screens
- `lib/operator-intelligence/social.js`: DB-backed admin slice
- `supabase/migrations/20260329100000_community_intelligence_foundation.sql`: schema foundation

## Data model

The persistence layer is centered on five tables:

- `community_collection_runs`: one record per pipeline execution
- `community_documents`: raw and normalized collected documents
- `community_mentions`: extracted mention-level signals
- `community_clusters`: aggregated patterns grouped by type and label
- `community_opportunities`: operator actions derived from clusters

The migration also extends existing platform tables so the feature participates in the existing connector and recurring-job systems.

- `client_data_connectors.provider` accepts `agent_reach`
- `recurring_jobs.job_type` accepts `community_sync`
- `recurring_job_runs.job_type` accepts `community_sync`

## Pipeline stages

`runCommunityPipeline(clientId, { triggerSource })` executes six stages.

### 1. Seed generation

`buildSeedQueries(client)` derives a compact query set from client name, business type, and city.

### 2. Collection

The current collector queries Reddit search, dedupes by external post id, and returns normalized raw post payloads.

### 3. Normalize and persist

Documents are converted into `community_documents` rows, assigned a dedupe hash, and upserted.

### 4. Enrichment

Unprocessed documents are scanned for mention-level signals such as:

- complaints
- questions
- competitor framing
- themes
- language patterns

These are persisted in `community_mentions`.

### 5. Clustering

Mentions are aggregated into reusable clusters such as:

- `complaint`
- `question`
- `theme`
- `competitor_complaint`
- `language`
- `source_bucket`

### 6. Opportunity derivation

The pipeline derives operator-facing opportunities from the cluster set, currently including:

- FAQ opportunities
- content opportunities
- differentiation angles

## Connection model

The social slice resolves connection state from the connector row plus the latest collection run.

Expected UI-facing states:

- `not_connected`: connector not enabled or no collection has been run
- `connected_empty`: connector active but no documents persisted yet
- `syncing`: collection currently running
- `error`: latest run failed
- `connected`: persisted data is available

This is intentionally distinct from provenance. Provenance describes evidence quality. Connection state describes collection availability.

## Evidence and truth constraints

The feature follows the same operator-truth discipline as the rest of Trouvable.

- Observed data comes from persisted external documents or extracted mentions.
- Derived data comes from deterministic transforms on stored records.
- Inferred data is limited to operator suggestions and opportunity framing.
- Empty states must never imply market silence; they only describe collection state.

Evidence levels are currently assigned from mention counts:

- `low`: fewer than 4 occurrences
- `medium`: 4 to 7 occurrences
- `strong`: 8 or more occurrences

## Operational notes

- The pipeline is safe to rerun because documents are deduped before insert.
- Clusters are rebuilt from persisted mentions.
- Opportunities are derived from the rebuilt cluster set.
- The admin UI can show historical data even while a new sync is running.
- If the connector row is missing or `not_connected`, the feature should report `not_connected`, not "no market discussion".

## V1 limitations

- Only Reddit collection is implemented.
- Mention extraction is heuristic and keyword-driven.
- No sentiment model, embedding model, or semantic clustering is used yet.
- No operator workflow exists yet for triaging or acting on opportunities.
- No backfill or source-specific scheduling exists beyond the shared continuous engine.

## Phase 2 candidates

Likely next expansions:

- add non-Reddit collectors
- replace keyword extraction with stronger NLP or embedding-based grouping
- add run history UI and retry controls
- add opportunity lifecycle actions in admin
- add per-source health and observability

## Minimal validation

When changing this module, prefer focused validation:

- run one `community_sync` job for a test client
- inspect the five community tables for the new run
- verify `lib/operator-intelligence/social.js` returns persisted counts
- verify the admin social view renders the same persisted totals and last-run state
