# Truth And Remediation Normalization Boundary

Bloc 4 keeps two related but distinct vocabularies on purpose.

## Why Two Vocabularies Exist

The audit truth layer answers: "How trustworthy is this statement, and does it need operator review?"

The remediation layer answers: "What is the current operational status of the problem in the workflow?"

Those are not the same concern, so they should not share a single status field.

## Truth-Contract Vocabulary

Defined in `src/lib/truth/definitions.js`.

- `truth_class`: `observed`, `derived`, `inferred`, `uncertain`, `recommended`
- `review_status`: `auto_accepted`, `needs_review`, `reviewed_confirmed`, `reviewed_rejected`, `blocked`

This vocabulary is used to preserve provenance, evidence quality, and operator-review semantics for audit outputs.

## Remediation Vocabulary

Defined in `src/lib/remediation/problem-types.js`.

- `status`: `open`, `in_review`, `resolved`, `ignored`

This vocabulary is used for workflow state once a normalized problem enters remediation handling.

## Mapping Boundary

The bridge lives in `src/lib/truth/operator-review.js`.

- `mapOpportunitySourceToTruthClass`
- `mapOpportunityStatusToReviewStatus`
- `mapMergeStatusToReviewStatus`
- `mapRemediationStatusToReviewStatus`

These mappings ensure that:

1. Audit-native outputs stay truth-aware.
2. Operational remediation records stay workflow-oriented.
3. The system can move data between the two layers without collapsing provenance into workflow state.

## Expected Data Flow

1. Raw audit/query evidence is normalized into truth-contract problems.
2. Review contracts and operator queues preserve `truth_class` and `review_status`.
3. Remediation records consume those problems and add workflow state with `status`.
4. When remediation data is projected back into review-oriented surfaces, the bridge functions convert workflow state back into truth-aware review status.

## Implementation Rule

Do not replace remediation `status` with truth `review_status`, and do not treat `review_status` as a task lifecycle field.

If a new surface needs both semantics, store both explicitly and map between them at the boundary.
