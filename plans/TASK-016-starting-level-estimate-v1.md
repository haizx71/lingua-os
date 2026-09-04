# TASK-016 — Starting Level Estimate v1

Current phase: **CONTRACT / POLICY / PERSISTENCE FROZEN — READY FOR MIGRATION-RUNTIME IMPLEMENTATION**

Design date: 2026-09-02

## Outcome of this phase

The approved domain design is now frozen as exact deterministic scoring, slot/transition,
confidence, lifecycle, persistence, contract, security, and data boundaries in
`docs/STARTING_LEVEL_ESTIMATE_V1.md`. ADR-020 records the durable decision. The narrow
Assessment-only OpenAPI amendment and generated TypeScript declarations are part of this phase.

No runtime, migration, frontend source, mock, Today/Content integration, or executable scoring
algorithm is changed in this phase. Migration `0008` remains a reviewed future shape only.

## Objective after approval

Implement one authenticated, actor-owned, deterministic and auditable Starting Level Estimate for
the vi→en MVP. Return only A0/A1/A2/B1 with explicit uncertainty and no certification claim, while
preserving Assessment evidence isolation and all Memory/Competence/Today/Brain boundaries.

## Explicit non-scope

- no IRT, ML, AI-generated questions, formal CEFR/IELTS claims, or permanent learner-level truth;
- no competence, ConceptStatus, mastery, FSRS, Review, Today recommendation, or Progress algorithm;
- no speech, pronunciation, free-form production, Chinese, or Japanese behavior;
- no frontend UI, GSAP, design-system, or auth-foundation change;
- no production external question-bank ingestion pipeline.

## Proposed implementation sequence after separate approval

1. **Contract freeze**
   - add failing contract tests for mutually exclusive answer/skip, 200 resume vs 201 create,
     nullable completion time, lifecycle invariants, A0 wording, idempotency, and hidden ownership;
   - apply only the approved OpenAPI amendment;
   - regenerate authoritative TypeScript and stop for a bounded compatibility patch if the frozen
     frontend no longer compiles.
2. **Migration `0008` test-first**
   - add template pair/publication authority, item band/type/slot/audio metadata,
     `assessment_attempt_items`, one-active-attempt uniqueness, exact mutation replay,
     confidence-band/result immutability, RLS, and protected rollback;
   - prove empty apply, reapply, down/up, checksums, preflight, ownership, and answer-key denial.
3. **Pure policy module**
   - implement `starting-level-heuristic-v1` gates, stop rules, score anchors, confidence calculation, and
     A0/A1/A2/B1 golden cases with no database or HTTP dependency.
4. **Question-bank gate and deterministic fixture**
   - add the 24-item LINGUA-authored test/dev bank and fail-closed activation checks;
   - keep it explicitly non-production until human review/sign-off.
5. **Application/store slice**
   - implement start/resume/get/answer with actor scoping, stable incremental snapshots, row locks,
     exact replay, terminal result transaction, and archived-profile rejection.
6. **FastAPI adapter**
   - expose exactly the three frozen operations and map only public DTO fields/errors;
   - prove no answer key/private diagnostics/database row leakage.
7. **Read-model integration decision**
   - only if separately approved, let Content read the latest completed estimate as an initial
     ordering hint; do not mutate Profile level or Today policy.
8. **Reviews and verification**
   - spec, policy, schema, migration, transaction/concurrency, security, boundary, data/provenance,
     and code-quality reviews;
   - Ruff, mypy, backend/unit/contract/database/full tests, real PostgreSQL races/migrations,
     OpenAPI/Redocly/generated freshness, and frozen frontend 314/27 gates;
   - update task/status/ADR only after every required check passes.

## Acceptance gates

- exact deterministic calibration examples and confidence bands match the approved policy;
- one active attempt per learner/profile and exact cross-device resume;
- selected items/order/scoring policy survive refresh and catalog changes;
- selected-option and skip are exclusive; answers/results are immutable;
- same-key replay is exact and concurrent start/final answer create no duplicates;
- missing/foreign resources share 404; paused/archived mutations fail closed;
- server alone derives correctness, level, confidence, and result;
- assessment completion creates zero Competence, FSRS, Brain mastery, Today, or Progress mutation;
- A0 is described as LINGUA pre-A1 and no result implies no estimate, never A0;
- no production data claim is made for deterministic fixtures;
- frontend application behavior remains unchanged unless separately authorized.

## Current blockers

- no contract/policy/persistence-freeze blocker remains;
- migration/runtime implementation still requires explicit authorization;
- current database lacks the frozen future `0008` snapshots, replay, active uniqueness, and result
  immutability until that approved implementation phase occurs;
- production/demo question-bank ownership and sign-off are not yet assigned;
- Content/Today consumption remains separate future work by explicit decision.
