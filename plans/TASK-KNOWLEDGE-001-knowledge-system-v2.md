# TASK-KNOWLEDGE-001 — Knowledge System v2 completion

Status: DOING
Owner: CODEX / system
Base: 491abcce573edf38462483c10f1775887436682b

## Goal

Complete the learning-knowledge layer without reopening frozen FSRS, competence, Reader, Brain, Today, Library, or FRLL semantics.

## Existing authoritative core

The repository and staging database already contain the accepted engine boundaries:

- one primary FSRS lineage per learner × concept;
- `user_concept_states` as the sole learner × concept competence projection;
- recognition, listening, and production as separate evidence/confidence dimensions;
- immutable/replayable `learning_events`;
- Language Brain as a read-only projection;
- Today as orchestration only;
- explicit Library Concept Save/Learn as the sole MVP Memory activation boundary.

These are frozen and must not be duplicated or replaced.

## Current gap

Staging proves the knowledge catalog is structurally present but practically empty:

- concepts: 1
- lexemes: 1
- word senses: 1
- concept relations: 0
- topics: 0
- concept-topic links: 0
- sentences: 0
- content items: 0
- content-concept links: 0
- framework mappings: 0

The next knowledge task is therefore catalog/graph completeness and operational hardening, not a second learner-state engine.

## Scope

1. Preserve canonical Concept → Lexeme → Sense structure and provenance.
2. Preserve relational knowledge graph through `concept_relations`, `topics`, `concept_topics`, `framework_mappings`, `sentence_concepts`, and `content_concepts`.
3. Add only indexes that support known learner/catalog access paths and do not alter semantics.
4. Keep catalog data separate from learner state.
5. Do not infer competence from catalog membership, passive browsing, page views, or topic relations.
6. Do not create parallel schedulers or concept-state tables.
7. Keep browser roles denied direct table/function access; application backend remains the authority boundary.
8. Seed/ingest actual English-for-Vietnamese A0–B1 catalog data only through approved provenance/licensing workflows; do not fabricate third-party provenance.

## Acceptance gates

- no changes that violate ADR-003, ADR-015, ADR-016, ADR-017, ADR-018, ADR-022;
- one learner × concept FSRS lineage remains enforced;
- learner/catalog separation remains intact;
- catalog relationship tables have query-supporting indexes where justified;
- staging browser grants remain empty for application tables;
- Supabase security advisors produce no new security regression;
- full repository tests/type/lint/build must pass before merge to `master`.

## Operational notes

Supabase's generic RLS lint reports catalog tables with RLS disabled. On the current staging project, the hardened application boundary has already revoked `anon` and `authenticated` table grants, so those tables are not directly browser-reachable. Do not blindly enable RLS on the catalog tables without a coordinated policy change, because that could block backend/database access paths and change the accepted trust boundary.

Performance advisor currently reports many unindexed foreign keys across the broad schema. Fixing all 98 findings is outside this knowledge task. Only indexes directly relevant to the knowledge graph/catalog read paths should be added here, with broader indexing handled separately after query-profile evidence.
