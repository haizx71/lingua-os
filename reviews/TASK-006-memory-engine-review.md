# TASK-006 Memory Engine / FSRS review

Date: 2026-08-22  
Scope: `services/api/src/lingua_api/memory/**`, migration `0002`, Memory Engine tests,
dependency locks and documentation.  
Result: **PASS — no required finding remains open.**

## 1. FSRS/domain correctness review

- PASS: Uses maintained `py-fsrs` `6.3.2` and its public `Scheduler.review_card` API; no FSRS
  equation or arbitrary interval is reimplemented locally.
- PASS: Runtime algorithm (`FSRS-6`), library (`6.3.2`) and parameter version
  (`fsrs6-global-default-v1`) must all match before a transition is accepted.
- PASS: Exactly four scheduling ratings and five contract presentation modes are typed; invalid
  enum values fail before persistence.
- PASS: New, learning, review and relearning lifecycle transitions are covered without asserting
  arbitrary library-owned intervals. Invariants verify positive stability, difficulty in `[1,10]`,
  ordered rating strength, deterministic output and UTC-aware due dates.
- PASS: Core transition time is injected. Naive/non-UTC and out-of-order timestamps are rejected.
- PASS: Difficulty, stability, retrievability, repetitions, lapses, scheduled days, due date and
  next state cannot be supplied through `ReviewSubmission`. py-fsrs uses retrievability internally;
  it is not persisted as a stale snapshot or exposed publicly.
- PASS: Presentation/evidence modes update the same memory row. Competence projections remain
  independent and unchanged.

## 2. Transaction/concurrency review

- PASS: A review locks the owned `review_items` and 1:1 `fsrs_states` rows with
  `SELECT ... FOR UPDATE`, appends the event, updates state/version and item timestamp within one
  PostgreSQL transaction.
- PASS: An injected database failure proves the event append and state update roll back together.
- PASS: Same-key concurrent requests serialize and produce one event/one advance. Distinct-key
  concurrent requests serialize into two events and two state versions without lost updates.
- PASS: The unique `(user_id, idempotency_key)` key and SHA-256 logical request fingerprint reject
  conflicting reuse. Replays return the original event identifier and never advance state twice.
- PASS: Optimistic `state_version` is retained as a defence after the database row lock; no
  in-process lock is relied upon.

## 3. Schema-integrity review

- PASS: Existing `UNIQUE(user_id, concept_id)` and the `fsrs_states.review_item_id` primary key are
  preserved, enforcing one learner/concept lineage and one state per review item.
- PASS: New-state nullability and reviewed-state shape are enforced with a database CHECK;
  difficulty/stability domain constraints from v1 remain active.
- PASS: State and event rows reference the exact parameter-set ID/version with `ON DELETE
  RESTRICT`; parameter history is immutable to both update and delete while the default marker is
  deliberately movable.
- PASS: The deterministic seed contains one default and the partial unique index prevents two
  simultaneous defaults. Missing defaults and unsupported algorithm versions fail safely.
- PASS: Review event presentation mode, evidence mode, fingerprint shape and version references
  are constrained. The migration backfill is deterministic.
- PASS: `(user_id, due_at, review_item_id)` matches the concrete owned active-due access path; no
  speculative index or separate skill scheduler was introduced.
- PASS: Empty-database migrate, seed verification, no-op re-apply and rollback/re-apply are covered
  on PostgreSQL 17.11. The down migration refuses lossy reversal after memory activity.

## 4. Contract/boundary/security review

- PASS: `contracts/openapi.yaml`, all frontend code and product route registration are unchanged.
- PASS: Domain ratings, memory states and exercise modes match the authoritative contract exactly.
- PASS: The public contract still projects only state/due/last-reviewed/isDue; internal FSRS
  parameters and mechanics do not leak.
- PASS: Every mutation takes an `AuthenticatedActor`; ownership is part of activation lookup,
  locked mutation lookup, idempotency lookup and due query. Product payloads cannot choose a
  `user_id`; cross-user review fails as not found.
- PASS: Suspended/retired lineages cannot receive evidence. SQL is parameterized.
- PASS: Structured logs hash actor IDs and exclude response text and database/internal payloads.
- PASS: No Today ranking, placement, content ranking, competence scheduling, AI/speech behavior,
  frontend algorithm or Chinese/Japanese product behavior was added.
- Contract defects: **none found**.

## 5. Regression/code-quality review

- PASS: Narrow `domain -> scheduler adapter -> PostgreSQL store -> transaction service` layering
  keeps transport, library and persistence concerns separable.
- PASS: Due list is one parameterized query with stable ordering and limit validation; no N+1 path.
- PASS: `fsrs==6.3.2` is pinned in runtime/development locks. A fresh environment installed 48
  exact locked packages and `pip check` found no broken requirements.
- PASS: Ruff format/lint and strict mypy report clean results.
- PASS: Backend suite: 71/71; PostgreSQL integration subset: 38/38; frontend regression:
  282/282 across 26 files; frontend typecheck/lint/production build all pass.

## Deferred boundaries (not findings)

- No product FastAPI endpoint is registered; TASK-004 remains the unchanged API authority.
- No per-learner/cohort parameter optimizer or automatic migration to a new parameter default.
- No Today Engine ranking or queue recommendation logic; only an owned active-due repository query.
- No competence projection update, repetitions/lapses projection, or public raw FSRS diagnostics.
- Integration work must wait for the explicitly requested TASK-006 audit.
