# TASK-010 — Today Engine heuristic v1 implementation

Status: **DONE**

## Objective

Freeze a deterministic, explainable, server-owned Today policy for one learner-local day before
runtime or migration work begins. The policy composes authoritative Review and Reader/Content
work into the learner's persisted daily time budget without recalculating FSRS, competence,
content publication, placement, or progress.

## Dependency and boundary audit

- `TASK-006` and `TASK-008` are DONE; the task-board dependency is satisfied.
- TASK-006D concept projections are available even though they are not an explicit board
  dependency. Today reads their stable public/domain projections, never Beta masses or formulas.
- TASK-016 is not a hard dependency. A missing Starting Level Estimate uses the already-approved
  Content Engine easiest-first fallback; Today does not estimate level.
- TASK-007, TASK-009, TASK-011 and all frontend source remain out of scope.
- This design turn changes no OpenAPI, database migration, backend runtime, generated type, mock,
  or frontend file.

## Design artifacts

- `docs/TODAY_ENGINE_HEURISTIC_V1.md`
- this bounded plan
- `TASKS.md` and `STATUS.md`, finalized after all verification gates passed

## Implementation slices

1. Add pure domain tests for candidate normalization, eligibility, tier ordering, budget packing,
   stable tie-breaking, deduplication and diagnostics.
2. Add the smallest reviewed migration for one stable daily plan, ordered Review activity targets,
   selection diagnostics and exact completion replay; add goal mapping only if the product
   approves it.
3. Implement bounded Review, competence and Content/Reader candidate source adapters.
4. Implement one repeatable-read generation transaction and evidence-gated completion mutation.
5. Add authenticated FastAPI adapters for the two already-contracted Today operations.
6. Run contract, database, backend and frozen-frontend gates plus specification, schema,
   migration, transaction, boundary and regression reviews.

## Acceptance checks

- identical actor state, catalog, policy version and `asOf` produce the same ordered plan;
- Review order is exactly the accepted Memory/Review queue order;
- one primary FSRS lineage remains untouched;
- Today never calculates competence, placement or Content Engine fit;
- total estimated minutes never exceeds `dailyMinutes`;
- due backlog is bounded without starving a suitable Reader activity;
- no duplicated concept purpose, Review block or content/mode key;
- completion is supported by authoritative Review/Reader actions and cannot fabricate evidence;
- all reads are actor/profile/language scoped and query pools are bounded;
- OpenAPI and generated types remain compatible unless an approved gap requires an additive edit;
- full backend/database and frozen frontend `307 / 27` baselines pass.

## Approved policy freeze

1. Goal relevance is neutral in v1; there is no goal-specific ranking or inferred mapping.
2. `contentReserveMinutes = 8`, `maxNewUnseenConcepts = 4`, and
   `recentExposureWindow = 48h` are immutable `today-heuristic-v1` constants.
3. The minimal Today persistence/idempotency migration is approved.
4. Runtime activity types are `review`, `read`, and `listen`; standalone `learn` is not generated.

## Verification gates

- focused RED/GREEN unit and integration tests for every implementation slice;
- Ruff format/lint and strict mypy;
- complete backend and real PostgreSQL suites;
- empty/up/reapply/down/checksum migration verification;
- OpenAPI validation, Redocly lint, and generated TypeScript freshness;
- frozen frontend typecheck/lint, 307 tests across 27 files, Storybook, and production build;
- specification, schema, migration, transaction, boundary, and regression reviews.

All gates passed. Final evidence is recorded in
`reviews/TASK-010-today-engine-heuristic-v1.md` and `STATUS.md`.
