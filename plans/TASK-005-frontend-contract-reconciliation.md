# TASK-005 — Frontend contract reconciliation

## Objective

Replace the provisional frontend transport models and stateful algorithm-like mocks with generated
OpenAPI DTOs, a contract-compatible transport boundary, deterministic response fixtures, and
explicit DTO-to-view-model adapters. Preserve the existing product UX and motion system while
removing transport assumptions rejected by `contracts/TASK-004_RECONCILIATION.md`.

## Dependency and scope check

- `TASK-002` and `TASK-004` are DONE.
- The current human instruction accepts TASK-004 and explicitly authorizes TASK-005, so the audit
  hold recorded in `TASKS.md`/`STATUS.md` is resolved.
- This task changes frontend types, transport, adapters, fixtures, and frontend tests only.
- `services/**`, `database/**`, `contracts/**`, `packages/ui/**`, `design-system/**`, backend routes,
  backend algorithms, and the stable GSAP motion system remain unchanged.
- TASK-006 and every later task remain out of scope.

## Expected files

- Root/package metadata: deterministic OpenAPI type-generation command and pinned generator.
- `packages/types/src/generated/openapi.ts`: generated DTO source; never hand-edited.
- `packages/types/src/api/**`: generated-schema aliases, operation-shaped `ApiClient`, static
  contract response fixtures, `MockApiClient`, and an explicit future HTTP transport boundary.
- `packages/types/src/view-models/**` and `packages/types/src/adapters/**`: presentation-safe models
  and pure DTO mappings used by the frozen frontend.
- `packages/types/src/enums.ts`, `errors.ts`, and `index.ts`: generated-type-derived enums, stable
  localized error states, and clear public exports.
- `apps/web/src/lib/api/**` plus bounded fixture/component reconciliations: use adapters and label
  local/deferred persistence without changing product flow or visual system.
- `tests/frontend/**`: contract generation, adapters, enums, errors, mocks, pagination, persistence,
  and forbidden-field/algorithm boundary coverage; obsolete provisional algorithm tests removed or
  rewritten.
- `reviews/TASK-005-frontend-contract-review.md`, `TASKS.md`, and `STATUS.md` after verification.

No shared contract, backend source, database source, migration, design token, or motion file changes.

## Thin implementation slices

1. Generate the authoritative TypeScript schema surface from OpenAPI and prove regeneration is
   deterministic.
2. Derive enum/runtime registries and error UI mappings from generated DTO unions and the accepted
   catalogs; keep network-only failures explicitly outside server error codes.
3. Define operation-shaped transport request/response types with opaque cursors, concurrency, and
   idempotency inputs, then implement deterministic mock responses that satisfy generated DTOs.
4. Add pure adapters for Today, Review, Reader/content, dictionary, Brain, Progress, profile, and
   assessment view models. Adapters may format/rename presentation data but never schedule, score,
   recommend, or calculate mastery.
5. Rewire existing frontend fixture entry points through those adapters and remove public/internal
   fields such as `userId`, raw FSRS parameters, `qualityStatus`, saved notes, graph payloads, and
   offset pagination.
6. Make unsupported persistence explicit: local presentation preferences are `LOCAL_ONLY`; reader
   resume and saved-sentence notes are `NOT_YET_PERSISTED`; reminders, configurable new-concept
   budget, export, and deletion workflows are `DEFERRED`.

## Test-first acceptance checks

### RED

- Generated types expose the OpenAPI component/operation shapes and regeneration has no diff.
- `ConceptStatus` has exactly eight values and excludes `due`; due stays `isDue`/`dueAt`.
- Adapters implement all accepted MATCH/RENAME/CHANGE/REMOVE/ADD mappings without raw DTO use in
  React component props.
- Mock responses compile against generated response DTOs, use UUID/RFC 3339 values, envelopes, and
  opaque cursor metadata, and expose no offset page fields.
- Review mocks return static `MemorySnapshot`/`CompetenceSignals` data and contain no FSRS,
  recommendation, placement, due-date, retrievability, or mastery calculations.
- Machine error codes map to safe Vietnamese UI states; raw server/database messages are ignored.
- Unsupported persistence never invokes an API method or produces a successful server mock.
- No public frontend transport/view model includes ownership IDs, ingestion quality state, raw FSRS
  fields, graph endpoints, or saved notes.

### GREEN / REFACTOR

Implement the smallest contract boundary and adapters needed to satisfy each group, retain existing
accessible component behavior, then remove obsolete provisional exports/tests.

## Verification

- generated file freshness check
- focused TASK-005 tests, then `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build-storybook`
- `pnpm build`
- contract-compliance, frontend-architecture, boundary, regression, and code-quality reviews
- explicit filesystem checks proving no changes to forbidden scopes

## Risks and controls

- Existing tests assert forbidden frontend scheduling behavior: replace those assertions with
  transport/boundary invariants rather than preserving obsolete semantics.
- Existing screens are fixture-driven rather than transport-driven: retain their props and UX while
  deriving default fixture values through pure adapters.
- OpenAPI 3.2 generator compatibility: pin the already-validated project generator version and add a
  deterministic freshness test/command.
- The current directory is not a Git repository, so scope safety is verified by targeted filesystem
  inspection and forbidden-path checks rather than Git diff.
