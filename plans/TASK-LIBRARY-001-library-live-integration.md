# TASK-LIBRARY-001 — Library live integration

## Objective

Replace the default fixture/local-state `/library` flow with the frozen Library API while preserving
the existing visual language and learner-state boundaries.

## Scope

- Load every page from `GET /v1/library/items` in server order.
- Map authoritative concept, sentence and content DTOs into presentation-only view models.
- Remove each item through its existing canonical Library endpoint.
- Protect pagination and mutations against duplicate clicks, malformed/cyclic cursors, stale
  same-actor requests, logout/login and Actor A/B transitions.
- Keep explicit injected presentation data available for deterministic component tests only.

## Expected files

- `packages/types/src/view-models.ts`
- `packages/types/src/adapters/index.ts`
- `apps/web/src/features/library/useLibrary.ts`
- `apps/web/src/features/library/LibraryView.tsx`
- `tests/frontend/task-library-001-library-live.test.tsx`
- `TASKS.md`, `STATUS.md`
- `reviews/TASK-LIBRARY-001-library-live-integration.md`

## Contracts and migrations

- OpenAPI: unchanged; use `listLibraryItems` and the three existing remove operations.
- Generated types: unchanged.
- Database/migrations/backend: unchanged.

## Implementation slices

1. Add failing adapter and live-load tests, then implement DTO validation/mapping and full cursor
   traversal with fail-closed completion.
2. Add failing removal/race tests, then implement authoritative removal with per-item operation
   ownership and actor/request lifecycle guards.
3. Reconcile the existing Library presentation for all three item types, empty/loading/error states
   and canonical Reader links without redesigning it.
4. Run contract, frontend, backend and build gates; perform spec/code review; update tracking; commit.

## Acceptance checks

- Concept, sentence and content rows render from backend DTOs with canonical identity and metadata.
- Server ordering survives multi-page traversal; duplicate identities and cursor cycles fail closed.
- A partial traversal is never committed as complete authority.
- Removal is server-confirmed, duplicate-suppressed and leaves the current row visible on failure.
- Stale load/page/remove/error/finally results cannot mutate a newer actor or request.
- Reload reflects server persistence; Library reads invoke no learner-state mutation.
- No fixture row appears in live HTTP runtime.
- No changes under `contracts/`, `services/`, `database/`, migrations or generated OpenAPI types.
