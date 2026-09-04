# TASK-003 review record

Date: 2026-08-22  
Scope: `TASK-003 — Core database schema v1`

## 1. Specification-compliance review

Result: **PASS — no required findings open.**

- PostgreSQL is the only persistence/graph implementation; there is no Neo4j, vector, AI,
  speech-scoring, or provider runtime.
- The migration models English-for-Vietnamese MVP reference data only (`en`, `vi`, CEFR
  A0/pre-A1 through B1). No Chinese/Japanese product behavior or seed data exists.
- Competence projections (`user_skill_states`, `user_concept_states`) are physically separate
  from memory scheduling (`review_items`, `fsrs_states`, `review_events`).
- `UNIQUE (user_id, concept_id)` on `review_items` preserves one permanent primary lineage,
  including after suspension/retirement.
- Today and assessment tables persist only identifiers, state, evidence, reason codes, and method
  versions required by the approved MVP. No selection, scheduling, scoring, or placement
  algorithms were implemented.
- Saved concepts/content/sentences and typed exposure evidence support the approved Reader and
  Library loop without copying frontend fixtures.
- No API endpoint or OpenAPI/shared enum change was made.

## 2. Schema review

Result: **PASS — no required findings open.**

- 46 normalized domain tables use stable UUID keys (language codes are stable natural keys) and
  `timestamptz` for instants.
- Foreign keys declare `CASCADE` for user deletion/privacy boundaries and `RESTRICT` for shared
  language/content/provenance/history data.
- Composite foreign keys prevent cross-owner and cross-language references in learner state,
  events, review, saved state, Today, content, and assessment structures.
- Bounded scores/confidence/difficulty, non-negative counters/durations/offsets, lifecycle values,
  JSON object shapes, temporal consistency, and idempotency keys use database constraints.
- Every imported lexical/content/assessment row reaches `source_records`, `data_sources`, and
  `licenses`. Published content has a database trigger requiring reviewed, usable provenance.
- The schema finding that Today activities and assessment items could cross language boundaries
  through simple FKs was fixed with composite language FKs and a regression test.
- 23 explicit indexes map to dictionary lookup, content recommendation, relationship reverse
  lookup, learner/RLS filtering, due review, chronological evidence/history, saved library,
  Today plan, and assessment history access paths. No speculative vector/graph/partition indexes
  exist.

## 3. Migration review

Result: **PASS — no required findings open.**

- The paired `0001_core_schema_v1.up.sql` / `.down.sql` history is the sole DDL source.
- The runner validates ordered pairs and unique versions, stores a combined SHA-256 checksum of
  up and down SQL, serializes deploy processes with a PostgreSQL advisory lock, and applies SQL
  transactionally.
- Applying unchanged history twice is a no-op; changed history is rejected.
- Empty application-schema apply, rollback, re-apply, and checksum-tampering paths pass against a
  real PostgreSQL 17.11 container.
- The down migration removes only v1 application objects in reverse dependency order. It is
  documented for disposable databases; production data requires backup recovery or a corrective
  forward migration.
- Migrations use a fixed `public, pg_catalog` search path and rely only on the documented
  Supabase-owned auth baseline.

## 4. Ownership/boundary review

Result: **PASS — no required findings open.**

- `public.users.id` references the platform-owned `auth.users.id` identity boundary.
- All 18 user-owned tables have direct owner identity (`users.id` or `user_id`), RLS enabled, and
  an authenticated own-row SELECT policy using `(SELECT auth.uid())`.
- The authenticated role has only SELECT privileges on these tables in v1; anonymous has none.
  Mutations therefore remain behind the server/service boundary until executable APIs are
  specified.
- Catalog tests cover every user-owned RLS table/policy/privilege; behavioral tests prove owner
  visibility, other-user isolation, and anonymous denial.
- Contract files and frontend/design-system source files were not modified. A scan found no
  implementation of forbidden post-MVP subsystems or `/v1` routes.

## Verification evidence

- Fresh isolated install from `requirements/backend-dev.lock`: exact freeze match; `pip check`
  clean.
- `pnpm backend:check` in the documented activated environment: Ruff format/lint clean, strict
  mypy clean, 12/12 backend tests passed (10 PostgreSQL schema tests + 2 API-foundation tests).
- Database checks include migration apply/down/re-apply, checksum rejection, table/RLS/timestamp
  catalog, invalid domains, unique FSRS lineage, auth/FK/owner/language integrity, required
  provenance, publish gate, RLS behavior, and access-path indexes.
- Existing frontend: lint clean; typecheck clean; 324/324 tests passed; production build generated
  all 14 routes. The pre-existing Next.js ESLint-plugin warning remains non-blocking.

## Decisions deferred without blocking TASK-004

- TASK-006 must choose and seed the actual FSRS parameter values/version; v1 only provides the
  versioned storage and FK boundary.
- TASK-004 must define API DTO names and exposure rules rather than returning database rows.
- Full license policy interpretation for `restricted` sources belongs to content-ingestion policy;
  v1 safely blocks `unknown` and `prohibited` provenance from publication.

