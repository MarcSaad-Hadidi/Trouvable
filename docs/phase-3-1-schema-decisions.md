# Phase 3.1 - Schema Decisions

Migration principale: `supabase/migrations/20260322100000_phase31_quality_engine_v2.sql`

## Objectif

Etendre le schema existant sans recreer un systeme parallele:

- reutiliser `tracked_queries`, `query_runs`, `query_mentions`
- ajouter uniquement les tables canoniques manquantes pour benchmark/aliases

## Tables Ajoutees

## `benchmark_sessions`

Usage:

- regrouper des runs benchmark multi-variantes
- stocker le contexte operateur (variants demandes, initiateur, notes)

Colonnes clefs:

- `client_id`
- `tracked_query_id` nullable
- `status` (`pending|running|completed|failed`)
- `requested_variants` (jsonb)
- `initiated_by`, `notes`

## `competitor_aliases`

Usage:

- registre alias concurrent canonique par client
- support exact + fuzzy-safe

Colonnes clefs:

- `client_id`
- `canonical_name`
- `alias`
- `match_type` (`exact|fuzzy_safe`)
- `locale`
- `is_active`
- `confidence`

## Tables Etendues

## `tracked_queries`

Ajouts prompt quality/taxonomie:

- `prompt_origin`
- `intent_family`
- `query_type_v2`
- `funnel_stage`
- `geo_scope`
- `brand_scope`
- `comparison_scope`
- `quality_status`
- `quality_score`
- `quality_reasons` (jsonb)
- `prompt_metadata` (jsonb)

## `query_runs`

Ajouts capture complete + benchmark:

- `run_mode`
- `engine_variant`
- `locale`
- `benchmark_session_id` nullable
- `prompt_payload` (jsonb)
- `raw_response_full` (text)
- `normalized_response` (jsonb)
- `parse_status`
- `parse_warnings` (jsonb)
- `latency_ms`
- `usage_tokens` (jsonb)
- `error_class`
- `retry_count`
- `extraction_version`
- `parse_confidence`
- `target_detection` (jsonb)

## `query_mentions`

Ajouts citation/competitor evidence:

- `mention_kind`
- `mentioned_url`
- `mentioned_domain`
- `mentioned_source_name`
- `normalized_domain`
- `normalized_label`
- `source_type`
- `source_confidence`
- `source_evidence_span`
- `evidence_span`
- `confidence`
- `first_position`
- `co_occurs_with_target`
- `verified_status`
- `recommendation_strength`

## Contraintes Et Index

La migration ajoute des checks defensifs et des index utiles:

- checks sur `status`, `parse_status`, `match_type`, `mention_kind`, `verified_status`
- index sessions benchmark par client/date
- index runs benchmark par mode/session/variant
- index mentions par kind/domain/label

## Rationale

- Pas de duplication run table: `query_runs` reste source unique de verite execution.
- `benchmark_sessions` est un regroupement leger, non un second systeme de runs.
- `competitor_aliases` formalise le matching sans hardcoder dans la logique metier.
- `query_mentions` conserve la preuve (evidence) pour auditabilite operateur.
