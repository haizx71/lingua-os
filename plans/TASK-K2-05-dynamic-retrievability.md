# TASK-K2-05 — Dynamic Retrievability Projection

Status: LOCAL REVIEWED: PASS / STAGING PENDING  
Owner: CODEX single-writer lane  
Predecessor: K2-04 STAGING PASS  
Migration: `0017_knowledge_v2_learner_retrievability`

## Objective

Add a private, read-only learner-concept projection whose retrievability matches the pinned
`py-fsrs==6.3.2` implementation and whose dynamic status uses the accepted eight-status vocabulary
without rewriting learner state.

## Reconciled authority

- Accepted repository history already owns migration `0016`; this wave uses `0017`.
- Real persistence columns and lineage are authoritative: `fsrs_states.last_review_at`,
  `fsrs_states.parameter_set_id`, `fsrs_states.params_version`, and the immutable
  `fsrs_parameter_sets.parameters.model_weights` array.
- Pinned py-fsrs 6.3.2 derives `DECAY = -model_weights[20]` and
  `FACTOR = 0.9^(1 / DECAY) - 1`. `desired_retention` changes future interval selection but is not
  part of `Scheduler.get_card_retrievability`; the SQL projection follows the pinned source so
  non-default parameter sets remain mathematically equivalent.
- `Scheduler.get_card_retrievability` returns `0` for a card without both `last_review` and
  `stability`; the view preserves that behavior for new/unreviewed rows.
- Integer elapsed days use `max(0, floor(elapsed_seconds / 86400))`, matching Python
  `timedelta.days`, including fractional and future timestamps.
- The obsolete `at_risk` status is not introduced. Established `active`/`mastered` rows project to
  `forgotten` below `0.50`; less severe decay projects to `weak` below the specification thresholds
  (`active < 0.75`, `mastered < 0.70`). Stored status remains unchanged.

## Locked boundaries

- Create only `public.v_learner_concept_retrievability`; add no index unless an actual `EXPLAIN`
  proves one necessary. The hosted preflight plan already resolves actor/profile reads through the
  existing unique/primary indexes on learner state, review items, FSRS state, and parameter lineage.
- Keep raw FSRS parameters and retrievability outside OpenAPI and every public response.
- Revoke the view from `PUBLIC`, `anon`, `authenticated`, and `authenticator`; grant `SELECT` only
  to `service_role`. Browser roles retain no schema/table path to the projection.
- The view and repository are read-only. No status, version, timestamp, evidence, schedule, or
  parameter-set row may be mutated.
- Unsupported/invalid FSRS lineage fails closed as a null score that the typed repository rejects;
  new cards are valid zero-retrievability projections.

## Tests first

1. Add pure equivalence/property tests against actual py-fsrs 6.3.2 over deterministic generated
   stability, elapsed-day, fractional-day, future-time, and valid `w20` samples.
2. Add PostgreSQL integration tests for view shape, lineage-specific weights, new cards, integer-day
   semantics, weak/forgotten thresholds, actor/profile scoping, invalid-value guards, and typed
   repository mapping.
3. Add privilege/owner tests, migration checksum/rollback/reapply coverage, learner row/version
   snapshots, and an `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` latency-plan assertion.
4. Run focused tests red before adding migration/repository production code.

## Verification gate

- Relative error versus py-fsrs is below `1e-6` for every tested and hosted fixture.
- Threshold cases are deterministic at both sides of `0.50`, `0.70`, and `0.75`.
- Browser roles cannot query the view; `service_role` can.
- Existing indexes produce bounded actor/profile plans; no speculative index is added.
- Clean apply, predecessor apply, rollback, reapply, and exact registry checksum pass.
- Full learner-table counts, row values, and state versions are identical before and after migration
  and projection reads.
- External read-only review has no unresolved BLOCKER or HIGH finding before source promotion.

## Hosted gate

Apply exactly one reviewed `0017` migration to staging, verify its registry checksum, run hosted
Python/SQL equivalence and threshold fixtures in a rollback-safe transaction, inspect the real plan
and latency, prove browser denial/backend access, compare learner snapshots, remove fixtures, and
record K2-05 STAGING PASS only after all checks succeed.

## Local review evidence

- Independent read-only review approved source promotion with no unresolved BLOCKER, HIGH, MEDIUM,
  LOW, contradiction, or false acceptance claim.
- Scoped Ruff formatting/lint, strict mypy, 217 backend non-database tests, six applicable bootstrap
  tooling tests, workflow YAML parsing, and `git diff --check` pass locally. The environment-only
  PowerShell bootstrap test is excluded on Linux where no PowerShell executable is installed.
- Twenty-five K2-05 PostgreSQL tests collect locally; the GitHub PostgreSQL 17.11 job owns their
  execution plus the full backend database suite before merge.
- Staging rollback-only preflight proved the extreme `1e10000` JSON numeric fails closed without a
  projection error, `service_role` retains its existing schema baseline and can read the view,
  browser roles cannot read it, and all temporary DDL/data disappeared after rollback.
