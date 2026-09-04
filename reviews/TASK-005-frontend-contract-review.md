# TASK-005 frontend contract reconciliation review

Date: 2026-08-22  
Outcome: PASS — no required findings open

## Contract-compliance review

- `packages/types/src/generated/openapi.ts` is generated from `contracts/openapi.yaml` by pinned
  `openapi-typescript@7.9.1`; `pnpm contracts:check-generated` proves the checked-in output is fresh.
- DTO aliases and all 29 operation inputs/outputs derive from generated `components`, `paths`, and
  `operations`; no OpenAPI schema was manually duplicated.
- Runtime enums are loaded from `contracts/enums.json` while their TypeScript unions derive from
  OpenAPI. `ConceptStatus` contains exactly the accepted eight values and excludes `due`.
- Every development transport fixture is a success envelope that uses UUID request IDs, RFC 3339
  instants, structured attribution, and `satisfies` an OpenAPI-derived response DTO.
- All reconciliation outcomes were applied: renamed fields are mapped in adapters; raw ownership,
  FSRS internals, ingestion/quality state, graph transport payloads, saved notes, and offset
  pagination were removed; competence and memory remain separate.
- Errors branch on the 11 machine-readable catalog codes and map to safe Vietnamese UI copy. Raw
  server/database messages are never displayed by the mapper.
- No contract defect was found. `contracts/**` remains unchanged by TASK-005.

## Frontend-architecture review

The production dependency direction is now:

`generated OpenAPI DTOs -> ApiClient/MockApiClient -> pure adapters -> UI view models -> React components`

- `ApiClient` is operation-shaped and accepts contract headers/query/body fields, including opaque
  cursors, ETag/If-Match, and idempotency keys where required.
- `MockApiClient` returns deterministic contract DTO fixtures and can be replaced behind the same
  interface. `HttpApiClient` is intentionally only a future transport marker; no nonexistent
  endpoint receives a network request.
- Screen fixtures are generated through adapter entry points. React component props contain
  presentation models, not DTOs or database records.
- Adapters only rename, select, format, or localize server values. They do not schedule reviews,
  recommend activities, calculate mastery, score placement, or derive FSRS state.
- The old test “Mock API” logic was reduced to a clearly labeled UI scenario harness: it no longer
  calculates rating-to-mastery transitions, placement results, memory fields, or Brain/Progress
  projections. Authoritative mock transport remains in `@lingua/types`.

## Boundary review

- Raw FSRS fields (`difficulty`, `stability`, `retrievability`, `lapses`, scheduling parameters) do
  not occur in production frontend models/transport fixtures except generated contract text checks
  or ordinary dictionary prose.
- `due` is not a `ConceptStatus`; due presentation uses server-owned `isDue`/`dueAt`.
- Brain consumes relational summary/list/detail DTOs. No graph API or node/edge DTO was invented.
- Cursor collections expose `cursor`/`limit` and `CursorResponseMeta`; no offset/page-number API
  model was added.
- Ownership comes from future bearer authentication. No product method accepts `userId`.
- Persistence classifications are explicit: theme/reduced-motion/audio/playback preferences are
  `LOCAL_ONLY`; reader position and saved-sentence notes are `NOT_YET_PERSISTED`; reminders,
  learner new-concept budget, export, and deletion are `DEFERRED`.
- No source edits were made under `services/**`, `database/**`, `contracts/**`, `packages/ui/src/**`,
  `design-system/**`, or the GSAP motion system. The required Storybook gate regenerated only its
  build output directory.

## Regression and code-quality review

- Existing page structure, visual hierarchy, accessibility behavior, and motion implementation were
  preserved. Component changes are bounded field/label reconciliation only.
- Generated code is isolated and never hand-edited. Domain naming is concentrated in DTO aliases,
  view models, and pure adapters instead of repeated through screens.
- Mock fixtures are static, deterministic, deep-cloned at the transport edge, and compile against
  generated response DTOs.
- One existing React test emits a non-failing controlled-input warning. It predates this contract
  work and does not affect the TASK-005 behavior or any quality-gate result.
- Storybook emits existing bundle-size, `use client`, sourcemap, dependency deprecation, and eval
  warnings; its build exits successfully. Next.js emits the existing ESLint-plugin detection
  warning; the production build exits successfully.

## Verification evidence

- `pnpm typecheck` — PASS; includes generated-contract freshness and all workspace TypeScript checks.
- `pnpm lint` — PASS; zero ESLint warnings/errors under the configured `--max-warnings=0` gate.
- `pnpm test` — PASS; 26 files, 270 tests.
- `pnpm build-storybook` — PASS; static catalog generated.
- `pnpm build` — PASS; Next.js production build and all 14 static routes generated.
- Targeted source scans — PASS; no DTO props in React, no frontend ownership IDs/graph methods,
  no raw FSRS model fields, and no offset pagination transport.

## Remaining limitations

- Product FastAPI operations are not implemented, so runtime development remains mock-only.
- `HttpApiClient` is deliberately not implemented until a later integration task has real product
  endpoints.
- The five persistence gaps above remain local, deferred, or not yet persisted as labeled. Resolving
  them requires a future product/schema/contract decision.
