# TASK-004 — Shared API contract v1

## Objective

Replace the starter placeholder with the authoritative, executable OpenAPI 3.2 contract for the
LINGUA OS MVP. The contract must present product DTOs rather than database rows, preserve one
primary learner/concept FSRS lineage, keep competence projections separate, and define the
frontend/backend handoff without implementing product endpoints or learning algorithms.

## Dependency and scope check

- `TASK-001` is DONE and supplies the FastAPI/backend toolchain.
- `TASK-003` is DONE and supplies the accepted PostgreSQL v1 schema and migration workflow.
- `TASK-004` is READY and owns only the shared contract checkpoint.
- `TASK-005` remains blocked until this contract is audited and accepted.
- `TASK-006` and later implementation work are explicitly out of scope for this task.

## Architecture decision applied

Use one deliberate request path: browser clients authenticate with Supabase Auth, then send the
Supabase JWT to FastAPI; FastAPI validates the actor and owns all product reads/writes to
PostgreSQL/Supabase. The browser never reads or writes product tables directly. PostgreSQL RLS is
defence in depth, while FastAPI still applies actor-scoped ownership checks and never trusts a
client-supplied `userId`. `auth.users.id` and `public.users.id` share the authenticated UUID; public
DTOs do not expose that storage relationship.

## Expected files

- `contracts/openapi.yaml`: executable OpenAPI 3.2 product contract.
- `contracts/enums.json`: API-facing enum registry synchronized with OpenAPI.
- `contracts/errors.json`: stable error-code/status registry synchronized with reusable errors.
- `contracts/TASK-004_RECONCILIATION.md`: provisional frontend to authoritative contract mapping.
- `tests/backend/contracts/test_openapi_v1.py`: contract validation and architectural invariant tests.
- `requirements/backend-dev.in` and `requirements/backend-dev.lock`: pinned contract-validation
  tooling only; runtime dependencies remain unchanged.
- `reviews/TASK-004-contract-review.md`: final spec/schema/boundary/migration review record.
- `TASKS.md` and `STATUS.md`: updated only after all verification gates pass.

No files under `apps/web/**`, `packages/ui/**`, `design-system/**`, or the frontend motion system
will change. No database migration or application API route will be added.

## Contract slices

1. Identity/profile and language-profile bootstrap, including Starting Level Estimate state.
2. Backend-owned Today plan retrieval and idempotent activity completion.
3. Content recommendations/detail, Reader analysis/save, concept detail, and dictionary search.
4. Saved Library lists and explicit concept/content/sentence save/remove operations.
5. One cursor-paginated Review queue and idempotent answer submission updating one memory snapshot
   plus separate competence projections.
6. Brain summary/list/detail and bounded Progress overview.
7. Starting Level Estimate session/response/result contracts with evidence and confidence wording,
   never certification semantics.
8. Shared envelopes, UUID/RFC 3339 UTC conventions, cursors, concurrency headers, auth, error
   responses, provenance/attribution, operation IDs, tags, and examples.

## Test-first sequence

### RED

Add contract tests which initially fail against the placeholder for:

- OpenAPI 3.2 parsing and specification validation.
- non-empty approved path inventory and globally unique stable `operationId` values.
- complete local `$ref` resolution and reusable success/error components.
- enum registry synchronization, including exactly eight `ConceptStatus` values and no `due`.
- consistent UUID IDs, RFC 3339 date-time fields, camelCase wire names, and no client-owned `userId`.
- cursor pagination on growing lists and no pagination on bounded singleton/summary resources.
- no raw database table schemas, no post-MVP/forbidden endpoints, and no operational health path.
- one review memory lineage with competence projections kept outside the memory object.
- required bearer auth, ownership-safe writes, publication/provenance notes, and idempotency headers.
- error registry/status synchronization and coverage for validation, authentication, authorization,
  not-found, conflict/invalid transition, rate/availability, and internal failures.

### GREEN

Implement only enough shared contract and registries to satisfy the tests, then validate with the
officially published OpenAPI 3.2 semantics and a pinned OpenAPI validator.

### REFACTOR/REVIEW

Remove duplicated inline schemas, tighten descriptions and examples, generate a client and static
documentation as smoke checks, then perform spec-compliance, schema, migration, boundary, and code
quality reviews.

## Pagination policy

Use opaque cursor pagination for collections that grow with catalog/user history: dictionary
results, recommended content, Review queue, Brain concept list, and Library items. Today, profile,
concept detail, content detail, Brain summary, Progress overview, and assessment state are bounded
resources and are not paginated.

## Acceptance and verification

- `python -m openapi_spec_validator contracts/openapi.yaml`
- focused contract tests, followed by the complete backend suite
- Ruff format/lint and strict mypy
- clean OpenAPI local-reference resolution
- TypeScript client generation smoke from `contracts/openapi.yaml`
- static API documentation generation smoke
- existing database migration verification from an empty PostgreSQL database
- existing frontend lint, typecheck, tests, and production build
- no frontend/design-system source changes and no database migration changes
- all four requested reviews plus a code-quality review have no open required findings

## Known risks and controls

- OpenAPI 3.2 tooling support is newer: pin a validator with explicit 3.2 support and avoid
  optional 3.2-only constructs when equivalent portable JSON Schema works.
- Provisional frontend models contain raw ownership IDs, raw quality states, Page pagination,
  graph fixtures, and exposed FSRS internals: record every mismatch explicitly instead of silently
  inheriting those fields.
- Settings in the frontend mix persistent learning preferences with client-only presentation
  preferences: expose only fields backed by the approved database and keep UI-only state local.
- The accepted database has no generic opaque ETag column: define HTTP ETag/If-Match behavior using
  the authoritative resource version derived by the future service, without changing schema here.
