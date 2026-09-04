# TASK-003 — Core database schema v1

## Objective

Create the first reproducible PostgreSQL schema and versioned migration workflow for the
approved LINGUA OS MVP domain. This task models state and evidence only; it does not implement
application endpoints or FSRS, Today, placement, AI, or speech algorithms.

## Locked boundaries

- PostgreSQL/Supabase is the sole system of record; the concept graph is relational.
- English for Vietnamese learners is the only seeded MVP language pair.
- Recognition, listening, and production projections remain separate from a single primary
  FSRS memory lineage per learner and concept.
- Every imported or curated language/content record has traceable provenance, license,
  attribution, checksum, transform version, and review state.
- User-owned tables carry a direct `user_id`, use Supabase-compatible RLS, and deny anonymous
  access. Client roles receive read-only access to their own rows; writes remain server-side.
- `contracts/openapi.yaml` and all frontend/design-system files stay unchanged.

## Deliverables

1. A transactional migration runner with ordered version discovery, checksums, idempotent
   re-application, and bounded rollback support.
2. `0001_core_schema_v1` up/down migrations covering:
   - identity and learner language profiles;
   - languages and CEFR metadata;
   - licenses, data sources, and source records;
   - concepts, lexemes, senses, relations, framework mappings, and topics;
   - sentences, translations, content, segments, concept occurrences, metrics, and versions;
   - learner skill/concept projections and append-only learning events;
   - review items, one-to-one FSRS states, parameter-set references, and review events;
   - saved concept/content/sentence library rows;
   - minimal persisted Today plans/activities and Starting Level Estimate structures.
3. Minimal deterministic English/Vietnamese and CEFR seed rows in the migration.
4. PostgreSQL integration tests and a Supabase-auth compatibility bootstrap used only by tests.
5. Updated schema documentation and executable repository commands.

## Constraints and invariants

- UUID primary keys and UTC-aware `timestamptz` timestamps.
- Explicit foreign-key delete behavior; cross-owner and cross-language references are blocked
  with composite foreign keys where an ordinary foreign key is insufficient.
- Bounded scores use `CHECK (value BETWEEN 0 AND 1)`; counts/durations/offsets are non-negative.
- Shared contract values are represented by checks without modifying the contract files.
- `review_items` has a permanent unique `(user_id, concept_id)` key. Exercise modes never create
  a second schedule.
- `fsrs_states` is one-to-one with `review_items`; competence scores never live in that table.
- Imported learner-visible lexical/content rows require a `source_record_id`.
- Learning and review evidence rows are append-only by privilege boundary; algorithms are later
  tasks.
- No speculative vector, graph, search, or partitioning infrastructure.

## Test-first acceptance checks

1. Applying all migrations to an empty Supabase-compatible PostgreSQL database succeeds.
2. Applying again is a no-op, and changed checksums are rejected.
3. Rolling back then re-applying succeeds without residue.
4. Invalid domain/check values are rejected.
5. Duplicate learner-concept review lineage is rejected.
6. Foreign-key and cross-owner/cross-language violations are rejected.
7. Imported lexical/content data without provenance cannot be persisted.
8. Each user-owned table has RLS enabled; an authenticated learner can read only their rows and
   anonymous sessions read none.
9. Concrete query-path indexes and all expected tables/constraints are present.
10. Backend Ruff, strict mypy, and tests pass; existing frontend lint, typecheck, tests, and build
    remain green.

## Implementation sequence

1. Add database test dependencies and migration-runner tests.
2. Add schema-invariant and RLS tests; demonstrate the expected RED state.
3. Implement the migration runner and auth test bootstrap.
4. Implement migration v1 in vertical slices: shared metadata/content, learner state, memory,
   persisted workflow state, then RLS/indexes.
5. Implement the down migration and verify rollback/re-apply.
6. Run specification, schema, migration, and ownership-boundary reviews.
7. Update project status only after all required verification passes.

## Recovery plan

- Before application data exists, `0001_core_schema_v1.down.sql` removes only objects introduced
  by v1 in reverse dependency order.
- After data exists, production rollback must restore a backup or use a corrective forward
  migration; the destructive down migration is intended for local/test recovery only.

