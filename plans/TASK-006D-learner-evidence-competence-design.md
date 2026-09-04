# TASK-006D — Learner Evidence and Competence Policy Design

## Objective

Freeze the domain and persistence policy for replayable learner evidence, competence projections,
concept mastery, and ConceptStatus before TASK-006D implementation begins.

## Scope

- Create `docs/LEARNER_EVIDENCE_COMPETENCE_V1.md`.
- Record the durable architecture choice as a proposed ADR in `DECISIONS.md`.
- Add TASK-006D in DESIGN / AWAITING APPROVAL state to `TASKS.md`.
- Add TASK-006D as a dependency of TASK-008 and TASK-012.
- Correct stale dependency language in `STATUS.md`.

## Explicit non-scope

- No runtime code, migration, tests, endpoint, OpenAPI, generated type, or frontend change.
- No FSRS algorithm change, Reader/Today/Brain/Progress/Starting Level implementation, AI, speech,
  Chinese/Japanese behavior, or Neo4j.

## Design steps

1. Audit authoritative specifications, contracts, schema/migrations, services, and accepted reviews.
2. Define canonical evidence types, raw evidence fields, modality mapping, and validation rules.
3. Select and specify a deterministic, bounded, replayable competence and confidence model.
4. Define concept mastery, ConceptStatus, idempotency, ordering, transaction, and concurrency rules.
5. Define Review integration and isolate the Reader exposure public-contract gap.
6. Propose only the schema changes required by the frozen policy.
7. Write implementation acceptance criteria and the future test matrix.
8. Self-review the artifact against every A–R design question and the non-negotiable invariants.

## Verification

- Every required deliverable and design question has an explicit section or decision.
- TASK-007 remains BLOCKED and the frontend baseline remains 307 tests / 27 files.
- `contracts/**`, `database/migrations/**`, `services/**`, and frontend-owned files are unchanged.
- TASK-006D remains DESIGN / AWAITING APPROVAL; no implementation is marked complete.

## Risks and gates

- ConceptStatus thresholds are policy, not observed scientific truth; they must live in an immutable,
  versioned parameter set and be recalibrated only through a future accepted version.
- A normal Reader exposure cannot be transported through the current OpenAPI contract. TASK-006D
  can build an internal boundary later, but TASK-008 must not record browser exposure until a
  bounded contract amendment is separately approved.
- Skill concepts require an explicit competence-dimension profile; canonical keys must never be
  parsed to infer a modality.
