# TASK-004 — final contract review

Outcome: **PASS**  
Required findings open: **0**  
Scope: OpenAPI v1, API enum/error registries, contract tests, database abstraction, auth/ownership
boundary, migration non-impact, and frontend handoff.

## 1. Specification-compliance review — PASS

- OpenAPI is version 3.2.0 and contains 24 product paths / 29 operations; `paths` is non-empty.
- Covered MVP surfaces: learner/profile bootstrap, language profiles, Today, Review, Reader/content,
  dictionary/concept, Library, Starting Level Estimate, Brain summary/list/detail, and Progress.
- No AI Tutor, speech/pronunciation/forced-alignment, full graph, Neo4j, Chinese, or Japanese route.
- Operational `/health` remains excluded.
- Today exposes plan decisions and human-readable reasons but no recommendation formula.
- Starting Level Estimate includes confidence/evidence/method version and avoids certification/IRT
  semantics.
- One public `MemorySnapshot` is used per review item/concept; competence projections are distinct.
- Published content behavior explicitly enforces provenance/license/quality gates, while internal QA
  workflow state is not a learner DTO.
- `contracts/TASK-004_RECONCILIATION.md` records every material provisional frontend mismatch under
  MATCH/RENAME/CHANGE/REMOVE/ADD.

## 2. Schema/contract review — PASS

- All operation IDs are present and globally unique.
- All local `$ref` targets resolve; both OpenAPI Spec Validator and Redocly validate the document.
- Success envelopes consistently contain `data` and `meta`; error responses reuse one strict nested
  `ErrorEnvelope` and shared response components.
- All public ownership IDs are derived from auth; there is no `userId` request/DTO field.
- Public IDs/path IDs are UUIDs, timestamps are RFC 3339 `date-time`, and plan dates are `date`.
- Cursor pagination is limited to growing collections: Review queue, dictionary results, content
  recommendations, Library items, and Brain concepts.
- Bounded bootstrap/detail/summary resources are not paginated.
- Critical POST mutations require UUID `Idempotency-Key`; library PUT/DELETE is intrinsically
  idempotent; editable profile resources use ETag/`If-Match`.
- The eight-value `ConceptStatus` is exact and contains no `due`; due remains `isDue`/`dueAt`.
- Error catalog covers validation, authentication, authorization, not-found, conflict, invalid
  transition, precondition/idempotency conflict, rate limiting, availability, and internal failure.
- TypeScript generation and static documentation generation both succeed from the contract.

## 3. Migration/database abstraction review — PASS

- No migration or database schema file changed in TASK-004.
- DTOs do not mirror raw tables or expose source records, QA rows, FSRS parameters, ownership keys,
  event payloads, or persistence workflow states.
- Accepted database domain constraints are respected for language-profile daily minutes, language
  status, Today plan/activity status and reason codes, content types, assessment state, and the
  three competence dimensions.
- Public content difficulty is the accepted normalized score plus an optional server display label;
  no unsupported CEFR content mapping is claimed.
- Empty-database migration, idempotent application, rollback/reapply, integrity, ownership, and
  provenance tests remain green: 10/10 database tests passed.

## 4. Boundary/security review — PASS

- Architecture is deliberately Browser → FastAPI → PostgreSQL/Supabase, not an accidental hybrid.
- Supabase Auth JWT `sub` establishes the actor; FastAPI owns product access and must enforce actor
  scoping even when a server connection can bypass RLS.
- PostgreSQL RLS is documented as defence in depth; direct browser product-table access is excluded.
- `auth.users.id` / `public.users.id` identity linkage is documented without exposing storage rows.
- All 29 product operations inherit Bearer JWT security; write paths document ownership-safe
  behavior and never accept a caller-chosen owner.
- Errors contain no stack traces/provider details and expose only safe validation issues.
- No component/page/type/mock/frontend motion source changed. One existing frontend contract
  conformance test was updated to recognize the authoritative expanded error registry; UI behavior
  and provisional generated-type work remain owned by TASK-005.

## 5. Code-quality review — PASS

- Contract invariant tests are readable, deterministic, and source files pass Ruff format/lint and
  strict mypy.
- OpenAPI components remove repeated DTO/error structure without exposing database abstractions.
- Redocly recommended lint has zero warnings.
- Development validator dependencies are direct and pinned; clean install of
  `requirements/backend-dev.lock` produced an exact 47-package `pip freeze` match.
- The workspace is not a Git repository, so review used explicit file scope and executable checks
  rather than a Git diff. No force/reset/discard operation was used.

## Findings resolved during review

1. **Internal content QA enum was initially removed.** Restored it in `enums.json` for shared
   compatibility, while leaving it deliberately unbound to public OpenAPI schemas.
2. **Assessed skill duplicated competence dimension.** Removed the duplicate enum/schema and reused
   `CompetenceDimension`.
3. **Part-of-speech was modeled as a speculative exhaustive enum.** Replaced it with a bounded
   source-normalized string because PostgreSQL v1 does not freeze a complete taxonomy.
4. **Redocly warnings for metadata, tags, discriminator, and unused components.** Added contract/tag
   metadata, removed the unnecessary discriminator and unused component, and reached zero warnings.
5. **Contract test typing/format issues.** Added pinned PyYAML stubs, explicit typing, and formatter
   output; Ruff and mypy are clean.

## Non-blocking follow-up obligations

- TASK-005 must regenerate `packages/types` and mocks from OpenAPI; provisional raw ownership,
  Page pagination, raw FSRS fields, and graph fixtures must not survive that reconciliation.
- TASK-006 must define and test the internal mapping from product presentation modes
  (`self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`) to accepted review-event
  evidence modes. This is server behavior, not a second scheduling lineage or public schema field.
- Reader resume position, synchronized audio/accessibility/reminder preferences, saved-sentence
  notes, learner-configurable new-concept budget, and data-export/delete workflows need separate
  product decisions and versioned migrations before being represented as persisted API behavior.

## Verification evidence

- OpenAPI Spec Validator 0.9.0: PASS (`contracts/openapi.yaml: OK`)
- Redocly CLI 2.13.0 recommended lint: PASS, zero warnings
- `openapi-typescript` 7.9.1 generation: PASS (73,488-byte declaration smoke artifact)
- Redocly static docs build: PASS (683,438-byte HTML smoke artifact)
- Ruff format/lint: PASS
- strict mypy: PASS
- backend pytest: 25/25 PASS (including 13 contract tests)
- database pytest: 10/10 PASS
- clean backend development lock install: PASS, exact 47-package match
- frontend ESLint/typecheck: PASS
- frontend Vitest: 324/324 PASS
- frontend Next.js production build: PASS, 14 static routes generated
