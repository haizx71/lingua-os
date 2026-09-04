# TASK-006 — Memory Engine / FSRS MVP

## Objective

Implement the backend-owned, deterministic FSRS-6 memory transition and PostgreSQL persistence
boundary for one primary learner/concept lineage. This task includes activation, review mutation,
history, idempotency, concurrency control, and an index-friendly due query; it does not implement
HTTP endpoints, Today ranking, learner competence projection, placement, or frontend logic.

## Dependency and authority check

- `TASK-003` is DONE and supplies `review_items`, `fsrs_states`, `review_events`, and versioned
  `fsrs_parameter_sets` storage.
- `TASK-004` is DONE and supplies the authoritative four ratings, five presentation modes,
  idempotency semantics, and private/public MemorySnapshot boundary.
- `TASK-006` is the next READY Codex task. No later task is in scope.
- No OpenAPI change or frontend source change is expected.

## Architecture decisions applied

- Pin `py-fsrs==6.3.2` and use FSRS-6 through a narrow scheduler adapter. Do not reimplement its
  scheduling equations.
- Seed one immutable global `fsrs6-global-default-v1` parameter set using the upstream FSRS-6
  weights, 0.9 desired retention, upstream learning/relearning steps and maximum interval, with
  fuzzing disabled for reproducibility.
- Bind a lineage to its parameter set. A future default change affects new lineages only unless a
  separate migration/rescheduling decision explicitly changes existing states.
- Serialize mutations with PostgreSQL row locks inside one transaction. Idempotency is enforced by
  `(user_id, idempotency_key)` plus a request fingerprint; no in-process lock is authoritative.
- The service receives an authenticated actor context. Every read/write scopes by that actor; no
  client-owned `user_id` enters the mutation command.
- Persist the exact contract presentation mode and its explicit internal evidence-mode mapping:
  `self_recall -> production`, `multiple_choice -> recognition`, `typing -> production`,
  `cloze -> cloze`, `listening -> listening`.

## Expected files

- `requirements/backend.in`, `requirements/backend.lock`
- `requirements/backend-dev.lock`
- `database/migrations/0002_memory_engine_fsrs_v1.{up,down}.sql`
- `database/README.md`
- `services/api/src/lingua_api/memory/**`
- `tests/backend/memory/**`
- `tests/backend/database/**`
- `docs/MEMORY_ENGINE_FSRS.md`
- `DECISIONS.md`, `reviews/TASK-006-memory-engine-review.md`
- `TASKS.md`, `STATUS.md` only after verification passes

## Test-first increments

1. **Scheduler RED/GREEN**
   - Cover all ratings, state mapping, deterministic due instants, UTC validation, parameter
     validation, and presentation/evidence mapping.
2. **Migration and activation RED/GREEN**
   - Seed/version/default invariants, immutable parameter history, nullable new-state shape,
     one-to-one state creation, one-lineage uniqueness, and empty-database migration.
3. **Transactional review RED/GREEN**
   - Atomic event/state/item updates, rollback on injected failure, state/version changes,
     historical parameter references, and no competence mutation.
4. **Idempotency/concurrency/ownership RED/GREEN**
   - Same-key replay, conflicting-key reuse, two concurrent submissions, actor isolation, inactive
     item rejection, and one-lineage preservation against a real PostgreSQL instance.
5. **Due query and observability RED/GREEN**
   - Active owned due rows only, stable order/limit, concrete composite index, one SQL query, and
     structured logs without response text or sensitive payloads.

## Acceptance and verification

- `python -m ruff format --check services/api/src database/migrate.py tests/backend`
- `python -m ruff check services/api/src database/migrate.py tests/backend`
- `python -m mypy`
- focused Memory Engine unit tests and real PostgreSQL integration tests
- full `python -m pytest`
- empty database migrate, seed verification, rollback/re-apply, and idempotent re-apply
- clean locked backend install and `python -m pip check`
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- specification, FSRS integration, transaction/concurrency, code-quality, and boundary reviews

## Risks and controls

| Risk | Control |
|---|---|
| Library defaults drift after upgrade | Exact dependency pin plus persisted algorithm/library/parameter versions and seed compatibility test. |
| New cards cannot represent nullable FSRS values | Migration adds a state-shape constraint; difficulty/stability remain required after first review. |
| Retry or race double-advances a state | Row lock, one transaction, unique idempotency key, and request fingerprint tests on PostgreSQL. |
| Presentation mode accidentally becomes a scheduler | Adapter maps modes only to audit/evidence metadata; every mode updates the same locked state row. |
| Competence or Today logic leaks into Memory Engine | Boundary tests and review confirm those tables/algorithms remain untouched. |

## Recovery

`0002` has a paired down migration for empty/disposable verification. It refuses rollback when
TASK-006 review data would make reversal lossy. Production changes use a corrective forward
migration or verified backup recovery.
