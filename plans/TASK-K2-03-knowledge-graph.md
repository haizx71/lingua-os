# TASK-K2-03 — Knowledge Graph and Concurrency-Safe DAG

Status: IN PROGRESS
Branch: agent/k2-03-knowledge-graph
Base: agent/k2-02-polysemy at e94edb14294e1d184b145d24570ce6257a9ee15f

## Scope

K2-03 owns the V2 graph table, the eleven typed relation values, bounded prerequisite
recursive queries, and database-level cycle prevention for prerequisite_of, part_of,
hypernym_of, and derived_from. It does not add API routes, frontend behavior, learner
state, FSRS logic, or K2-04/K2-05 functionality.

## Existing graph compatibility decision

The historical V1 table public.concept_relations remains unchanged and is retained as a
compatibility/source table. It has a different relation vocabulary, a language column,
relational source provenance, and ON DELETE RESTRICT semantics. Renaming it in place would
rewrite a historical contract and would make the V1/V2 boundary ambiguous.

The V2 canonical table public.concept_edges is therefore additive. Migration 0016
backfills only deterministic mappings:

- prerequisite -> prerequisite_of
- synonym -> synonym_of
- antonym -> antonym_of

Backfilled provenance is retained in metadata as the legacy table name, relation type,
language code, and source record UUID. family and related are intentionally not mapped
because the approved V2 taxonomy does not define an equivalent relation. No learner data
is written.

## Edge identity and invariants

Identity is the directed triple (source_concept_id, target_concept_id, relation_type).
Self-edges are rejected. Weight is bounded to [0, 1]. Metadata is a JSON object.

The four strict DAG relation types are checked per relation type. Symmetric relation values
remain able to represent both directions; no reverse row is silently synthesized.

## Cycle prevention

The trigger takes pg_advisory_xact_lock(hashtext('lingua_concept_dag_mutation_lock'))
before checking a recursive path from the proposed target back to the proposed source.
The trigger covers INSERT and UPDATE and excludes the current row when evaluating UPDATE.
The table check handles self-cycles. The lock closes the READ COMMITTED phantom path race.

## Migration numbering contradiction

The migration plan currently assigns 0016 to learner retrievability in a later wave, while
the implementation-waves document places learner retrievability in K2-05 and gives K2-03 no
migration number. Because the actual accepted chain ends at 0015 and K2-03 requires new DDL,
this branch uses 0016 for the graph wave. K2-05 must be renumbered to 0017, or the release
sequence must be reconciled, before either wave is promoted.

## Security and learner boundary

The graph table is not exposed to browser roles and has RLS disabled consistently with the
accepted canonical-table architecture. The trigger function is SECURITY INVOKER with a
pinned search_path; EXECUTE is revoked from PUBLIC, anon, authenticated, and authenticator,
and granted only to service_role. No learner table is referenced by the migration.

## Verification target

Required database coverage includes schema/constraints/indexes, all relation values,
duplicate/self/deep-cycle rejection, update checks, delete cascade, legacy backfill and
reapply idempotency, ORM/DTO round trip, recursive query depth bounds, concurrency race
serialization, browser/function privilege lockdown, and learner-state isolation.
