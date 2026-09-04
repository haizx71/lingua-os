# TASK-012 — Language Brain Projection API

Status: **DONE / POSTGRESQL VERIFIED**

## Objective

Freeze the approved Language Brain v1 public contract before any runtime or migration work starts.

## Scope

- Amend only the three existing Brain GET operations and their Brain-specific schemas.
- Expose required nullable concept mastery and required aggregate concept confidence.
- Preserve score/confidence separation for all three competence dimensions.
- Make only `BrainSummary.memoryHealth` nullable because no authoritative metric exists.
- Freeze existence-hiding 404, read-only, learner-scope, and opaque keyset-cursor semantics.
- Regenerate authoritative TypeScript contract types and audit the frozen frontend without editing
  React, UI, ApiClient, or mock runtime code.
- Update `docs/LANGUAGE_BRAIN_PROJECTION_API_V1.md`, `TASKS.md`, and `STATUS.md` after verification.

## Explicit non-scope

- No FastAPI route, application service, PostgreSQL store, migration, seed, mock, frontend
  application, UI, GSAP, or design-system edit.
- No competence, ConceptStatus, mastery, FSRS, Today, placement, graph-inference, AI, speech, or CJK
  algorithm.
- No TASK-007, TASK-011, TASK-013, TASK-014, or later implementation.

## Contract-freeze steps

1. Add focused contract tests for the approved mastery, confidence, zero-state, memory-health, 404,
   enum, pagination, POS, and non-leakage rules; observe the pre-amendment failures.
2. Apply the smallest OpenAPI amendment to Brain paths/schemas only.
3. Regenerate TypeScript types and pass generated-freshness plus contract validation/lint.
4. Update the approved design document from provisional recommendations to frozen decisions.
5. Run frontend typecheck, lint, and the frozen 308-test/27-file regression suite without editing
   frontend application code; report any generated-type integration dependency exactly.
6. Verify no database, runtime, or frontend application diff and update task/status records.

## Approved decisions

The domain/read-model design and the following public semantics are approved: nullable mastery,
aggregate concept confidence, per-dimension score/confidence, nullable Brain memory health,
synthetic zero competence without GET writes, existence-hiding 404, exact eight-value
ConceptStatus, learner-anchored collection scope, depth-one stored relations, and opaque keyset
pagination. Runtime implementation and real-PostgreSQL verification are complete.

## Verification

- OpenAPI 3.2 validation and Redocly lint pass.
- Focused and full contract tests pass, including generated TypeScript freshness.
- Generated TypeScript changes only as implied by the approved Brain schema amendment.
- No migration/runtime/frontend application file is changed.
- TASK-012 contract freeze and runtime are DONE.
- TASK-007 and TASK-011 remain blocked; the frontend baseline remains 308 tests / 27 files.

## Runtime implementation phase

1. Add failing domain/cursor/boundary and real-PostgreSQL API tests for the frozen design.
2. Implement the domain/read model, signed cursor, DTO mapping, read-only PostgreSQL store,
   application service, and exactly three Brain GET routes.
3. Review specification, ownership, publication, scheduling/placement, query, and read-only
   boundaries; resolve all static findings.
4. Run static, contract, frontend, focused PostgreSQL, migration, and full regression gates.
5. Update durable task records only after real verification.

Steps 1–5 are complete. The final tree passes static and contract gates, 15/15 focused Brain
PostgreSQL tests, 150/150 database tests, 250/250 full backend tests, and 3/3 focused migration
tests on PostgreSQL 17.11. No migration, OpenAPI, generated TypeScript, or frontend application
change was introduced by runtime verification.
