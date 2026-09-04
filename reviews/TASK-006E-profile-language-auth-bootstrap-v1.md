# TASK-006E Profile / Language Profile / Auth Bootstrap v1 — Review

Date: 2026-09-02  
Verdict: **APPROVE**

## Scope and specification review

The implementation matches the approved design, ADR-019, frozen OpenAPI, and exactly five public
operations. The sole bootstrap boundary is `GET /v1/me`; minimal bootstrap, nullable timezone,
email claim authority, vi-to-en language lifecycle, revision-backed ETags, exact create replay,
archive/reactivate preservation, Today pre-timezone failure, Brain native-language lookup, and
downstream no-bootstrap semantics are implemented. No frontend behavior, new endpoint, placement
algorithm, learning algorithm, preference API, or second profile authority was introduced.

Result: no Critical or Required specification finding remains.

## Correctness and test review

Tests cover bootstrap races and scope, stale/tombstoned auth, optional email and non-persistence,
IANA validation, all five goals, daily-minute bounds, unsupported pairs, strong If-Match failure
modes, no-op semantics, parent/child revision propagation and independence, concurrent stale
writers, foreign-resource hiding, archive/reactivate identity, active/archived lifetime duplicate
prevention, same/different concurrent idempotency commands, historical exact replay, RLS,
append-only snapshots, preflight/backfill/down safety, Today null-timezone behavior, Brain native
authority, downstream no-bootstrap, and OpenAPI response conformance.

Required findings fixed during review:

1. Review and Content initially returned an empty list for an actor with no application identity.
   Added read-only application-identity checks and 404 response metadata; regression proves no
   `users` or `learner_profiles` write occurs.
2. Legacy Reader and Review fixtures created `users + user_languages` without the now-required
   learner-global profile. Updated only those stale fixtures; production behavior was not weakened.
3. The acceptance matrix lacked explicit concurrent same-key/different-payload, all-goal/boundary,
   archived duplicate-create, and independent child-revision tests. Added them; all pass.
4. Ruff formatting and one strict-mypy annotation issue in tests were corrected.

Result: 188/188 PostgreSQL tests and 321/321 full backend tests pass.

## Schema and migration review

Migration 0007 follows paired/versioned conventions, uses deterministic fail-closed legacy checks,
preserves the known vi-to-en backfill only, retains the legacy interface field, adds bounded goals
and positive revisions, and narrows replay persistence to create-language-profile v1. Foreign-key
delete behavior is explicitly RESTRICT for replay history. RLS is own-select/no-browser-write, and
the append-only trigger protects replay results. The down migration rejects each lossy state.

Result: no Critical or Required migration finding remains; no speculative index or schema was
added.

## Architecture, security, and performance review

- Correct dependency direction: route -> application -> actor-scoped store/domain.
- Existing JWT verifier reused; no second auth stack.
- SQL is parameterized; ownership comes only from the verified UUID actor.
- Missing/foreign resource behavior prevents IDOR and enumeration before ETag comparison.
- PostgreSQL locks and constraints, not process-local locks, protect multi-worker concurrency.
- Reads are bounded; the language-profile embedded list is contract-capped and the domain permits
  only one active MVP target lifecycle.
- No new dependency, secret, raw database message, frontend algorithm, or direct browser write was
  introduced.

Result: no Critical or Required security, architecture, performance, or boundary finding remains.

## Verification review

Ruff format/lint, strict mypy, non-DB tests, real PostgreSQL 17.11 tests, complete backend tests,
migration reproducibility/checksum/down-up/protected rollback, OpenAPI validation, 26 contract
tests, generated TypeScript freshness, Redocly, frontend typecheck/lint, 313-test Vitest baseline,
Storybook, and production build all completed successfully. Redocly retains one accepted Reader
discriminator warning outside TASK-006E. The repository has no `.git` metadata, so source-diff
claims are based on the bounded edit inventory rather than `git diff`; no OpenAPI, generated type,
or frontend application file was edited during runtime implementation.

Final verdict: **APPROVE — no Critical or Required finding remains.**
