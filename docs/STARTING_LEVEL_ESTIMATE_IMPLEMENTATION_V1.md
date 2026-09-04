# TASK-016 — Starting Level Estimate v1 implementation

This document records the bounded runtime implementation of the frozen
`starting-level-heuristic-v1` policy. It does not change the public contract or
the policy decisions in `docs/STARTING_LEVEL_ESTIMATE_V1.md` and ADR-020.

## Runtime boundary

`lingua_api.assessment` owns start/resume, read, and answer operations. FastAPI
maps domain failures to the existing error envelope. PostgreSQL is the only
source of persisted assessment state; attempt items are immutable public/private
snapshots and the private answer key is never serialized to the client.

The store requires an owned active English profile, an active vi→en template at
the frozen policy version, approved quality-scored provenance with an allowed
license, four unique UUID options and one correct option. Listening slots also
require an approved audio asset. No item is selected when any dependency is
missing.

Responses are accepted only for the current snapshotted item. The server derives
correctness, stores either a selected option or a deliberate skip, and rebuilds
the deterministic policy state from append-only responses. Idempotency keys are
actor scoped, fingerprint checked, and serialized with a transaction advisory
lock so concurrent retries replay the historical response.

## Persistence safety

Migration `0008_starting_level_estimate_v1` adds attempt snapshots,
idempotency history, policy-slot metadata, append-only snapshot/response/result guards,
the one-active-attempt partial unique index, confidence/evidence checks and
proof-path indexes. Existing templates/items with semantics that cannot be
derived safely cause a preflight failure; no native language, item type or slot
metadata is fabricated during migration.

TASK-016 writes only assessment tables. It does not write learning events,
competence projections, FSRS state, Review, Today, Content or Brain state.

## Verification note

Final verification ran against a disposable portable PostgreSQL 17.11 cluster bound only to
`127.0.0.1`, with UTF-8 storage and UTC session/server timezone. `TEST_DATABASE_URL` existed only
in verification process environments; no credentials or machine-local path was committed.

- 43/43 focused Assessment PostgreSQL schema/runtime tests pass.
- 231/231 complete repository database tests pass.
- 426/426 complete backend tests pass; the non-database subset remains 195/195.
- Migration `0001..0008` empty apply, no-op reapply, checksum rejection, safe `0008` down/up,
  protected rollback and fail-closed ambiguous-legacy preflight pass.
- Concurrent same-key and distinct-key start, same-key and distinct-key answer, stale-current-item
  rejection and final-completion races converge without duplicate attempts, responses or results.
- Exact start/answer replay, persisted A0/A1/A2/B1 branches, skip-to-abandoned behavior,
  deterministic two-decimal confidence, snapshot/result immutability, ownership hiding, RLS,
  browser privilege denial and controlled-failure transaction rollback pass.
- Counts for learning events, concept/skill projections, Review/FSRS, Today and Content state are
  identical before and after a complete assessment.
- Ruff format/lint and strict mypy pass across 86 files; 32/32 contract tests, OpenAPI validation,
  generated TypeScript freshness and Redocly validation pass. Redocly reports only the pre-existing
  Reader discriminator warning.
- Frozen frontend gates pass: typecheck, ESLint, 314/314 tests across 27 files, Storybook and the
  Next.js production build.

Real PostgreSQL verification exposed two Required defects. Distinct-key concurrent starts are now
serialized by locking the owned language-profile row before current-attempt lookup, with the
partial unique index retained as defense in depth. Attempt-item public/private snapshots now have
an append-only trigger, closing privileged UPDATE/DELETE paths. Candidate loading was also changed
from per-slot reads to one bounded set-oriented query per appended bundle; the four immutable
snapshot inserts remain explicit. No OpenAPI or frontend behavior changed.
