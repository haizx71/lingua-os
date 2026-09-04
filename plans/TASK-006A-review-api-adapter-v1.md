# TASK-006A — Review API Adapter v1

## Scope and locked boundaries

Implement only the authoritative Review operations:

- `GET /v1/review/queue`
- `POST /v1/review/{reviewItemId}/answer`

`contracts/openapi.yaml`, `contracts/enums.json`, `contracts/errors.json`, ADR-003, and the accepted
TASK-006 Memory Engine are locked. This task does not implement Today ranking, competence learning,
placement, Reader, AI, frontend UI, or a second scheduler.

## Dependency and boundary audit

- TASK-004 and TASK-006 are DONE and accepted.
- Supabase JWT supplies the only actor identifier; request DTOs contain no ownership field.
- The three required competence dimensions are read from the existing authoritative
  `user_skill_states` projection. Missing dimensions are an internal projection/configuration
  failure; the adapter must not synthesize values or update competence from a review rating.
- Review Queue v1 uses the single supported server-owned `self_recall` presentation mode. The
  adapter derives a deterministic lexical prompt from stored concept/lexical data; it performs no
  recommendation or ranking beyond due-time keyset ordering.
- A focused migration persists each newly accepted review's exact private post-transition memory
  snapshot. Legacy rows remain readable through immutable-history reconstruction; no scheduling or
  competence schema is changed.

## Expected changes

- `services/api/src/lingua_api/memory/{domain,store,service}.py`
- `services/api/src/lingua_api/auth.py`
- `services/api/src/lingua_api/review/**`
- `services/api/src/lingua_api/main.py`
- `database/migrations/0003_review_idempotency_result_v1.{up,down}.sql`
- `requirements/backend.in` and generated lock files
- `tests/backend/database/test_memory_engine.py`
- `tests/backend/review/**` and Review contract checks
- `.env.example`, `TASKS.md`, `STATUS.md`
- `reviews/TASK-006A-review-api-adapter-v1.md`

No change is expected under `contracts/**` or frontend source.

## Implementation slices

1. Add failing PostgreSQL tests for delayed historical replay and concurrent same-key submissions
   against different lineages.
2. Reconstruct the original memory transition for a replay, translate the unique-key race into
   `IdempotencyConflict`, and compute the owned language-profile remaining-due count inside the
   accepted review transaction.
3. Add failing unit/integration tests for bearer auth, actor isolation, queue keyset cursor,
   validation, public DTO safety, domain error mapping, all ratings, and authoritative OpenAPI
   operation/response conformance.
4. Add a testable Supabase JWT verifier boundary, actor dependency, Review read/application adapter,
   strict Pydantic DTOs, cursor codec, and the two routes.
5. Run specification, architecture, security, code, migration, and frontend-boundary reviews.
6. Run every backend/database/contract/migration and frontend regression gate before marking DONE.

## Required semantics

- Queue ordering is `(due_at, review_item_id)` within the authenticated actor and owned language
  profile. The opaque cursor carries a signed, versioned keyset boundary and fixed `asOf` instant;
  there is no offset.
- A successful answer updates one FSRS lineage and event atomically. `remainingDueCount` is counted
  in the same transaction, after the accepted transition, for the answered item's language profile
  at that transaction's UTC `reviewed_at`.
- Replaying A after B returns A's reconstructed post-transition memory snapshot and never schedules
  again. Competence remains a current read projection; on replay, remaining due count is a current
  transaction-time projection, while the memory mutation result is historical and stable.
- Same actor/key with different logical payload or lineage returns `IDEMPOTENCY_KEY_REUSED`; no
  PostgreSQL exception or constraint name crosses the domain/API boundary.

## Verification

- Ruff format check and lint
- strict mypy
- backend, database, and contract tests
- empty-database migration, idempotent re-apply, rollback/re-apply verification
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (baseline 282/26), `pnpm build-storybook`, `pnpm build`
