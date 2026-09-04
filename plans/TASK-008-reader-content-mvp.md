# TASK-008 — Reader / Content Service MVP

Status: **IN PROGRESS**

## Objective

Freeze the smallest authoritative Reader/content public contract before runtime implementation:
published catalog identities, catalog-only sentence saving, segment-level progress, passive Reader
exposure through TASK-006D, source provenance, and the complete publication gate.

## Approved locked boundaries

- English for Vietnamese learners, curated A0-B1 only.
- PostgreSQL/FastAPI authority; no direct frontend product-table mutation.
- Reader lazily uses Dictionary truth and never embeds the full lexical graph.
- Passive exposure changes history/status discovery only, never competence or FSRS.
- One Reader source action may derive many canonical concept events.
- Progress and exposure are separate commands/transactions.
- No AI generation, realtime translation, speech recognition/scoring, CJK, Today logic, or frontend
  redesign.

## Completed contract-freeze sequence

1. Amend and validate OpenAPI/enums for exposure, progress, segment type/level, and catalog-only
   sentence saving.
2. Regenerate authoritative TypeScript types without changing application/client runtime.
3. Add contract tests for transport boundaries, idempotency headers, separated commands, catalog
   identity, and generated freshness.
4. Freeze exact source provenance, publication, contract/database responsibility, and expected
   migration decisions in `docs/READER_CONTENT_MVP_V1.md` and ADR-016.
5. Run contract and frozen-frontend regression gates.

## Contract-freeze files

- `contracts/openapi.yaml`, `contracts/enums.json`
- generated TypeScript contract artifact only; no adapters, mocks, or application runtime
- contract-focused backend tests
- design/ADR/task-board status documents

No Reader runtime, frontend application file, database migration, seed, pipeline, or external data was
created during the completed contract-freeze phase.

## Bounded implementation plan

### Scope

- Add the paired `0005_reader_content_service_v1` migration and a small deterministic,
  LINGUA-authored acceptance seed.
- Enforce the complete Reader publication gate and keep public reads fail-closed.
- Implement authenticated content list/detail, catalog sentence save, segment progress and passive
  Reader exposure operations behind application/domain/store boundaries.
- Reuse `user_saved_sentences`, catalog/lexical authorities and TASK-006D canonical event/projector
  infrastructure; do not duplicate Dictionary or Library truth.
- Preserve the frozen OpenAPI and generated contract artifact; do not modify frontend runtime.

### Schema decisions

- `content_items` gains a curated Reader level and durable reviewed timestamp; `content_segments`
  gains its contract segment type.
- `user_content_progress` is the sole learner × content resume/completion projection.
- Reader progress and sentence-save exact results use one actor-scoped mutation-result authority;
  exposure exact results stay with the durable source fact.
- Reader source-to-concept links record stable fan-out identities; canonical `learning_events`
  remain replay authority.
- Rollback refuses to destroy post-0005 learner progress, saves, exposure source facts or canonical
  Reader derivations.

### Implementation slices and acceptance checks

1. Write failing migration/schema/publication tests, then implement migration `0005` and seed.
2. Write failing DTO/domain/store tests, then implement content list/detail and cursor ordering.
3. Write failing mutation tests, then implement sentence save and monotonic progress with exact
   replay and PostgreSQL advisory-lock concurrency behavior.
4. Write failing exposure tests, then implement source facts, authoritative resolution, stable
   fan-out and TASK-006D transaction participation.
5. Prove rollback/atomicity/idempotency/ownership/language isolation and all passive-competence
   invariants with real PostgreSQL.
6. Run contract, backend, database and frozen-frontend gates; perform specification, schema,
   migration, transaction, security, boundary and regression reviews.

### Explicit exclusions

- No Reader analysis pipeline, Dictionary/Library endpoint expansion, Today/placement logic,
  FSRS changes, AI/speech/CJK behavior, frontend integration or UI/design/motion changes.
- No raw viewport/playback telemetry is invented. Exposure eligibility is client-attested; server
  authority starts at owned profile and published catalog validation.
