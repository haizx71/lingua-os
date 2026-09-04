# LINGUA OS Backend Engineering Policy

This document defines the non-negotiable architectural laws and engineering standards for backend development within LINGUA OS. These project-specific invariants override generic library guidance or assistant preferences.

---

## 1. Authoritative System Boundaries

- **OpenAPI is the API contract source of truth.**
  - `contracts/openapi.yaml` is the single authoritative contract for all public HTTP endpoints, request/response bodies, query parameters, and error codes.
  - The frontend never guesses backend contracts, and backend routes never invent undocumented fields or endpoints silently.

- **Authenticated actor identity comes only from verified server-side claims.**
  - Identity is resolved exclusively via cryptographically verified server-side JWT / session claims.
  - Client-supplied IDs in request bodies, path parameters, or headers NEVER establish ownership.

- **PostgreSQL is the persistent product authority.**
  - Relational database schema, foreign keys, `CHECK` constraints, and `UNIQUE` constraints are the authoritative persistence layer for all user progress, content references, and system state.

- **Frontend authority restrictions:**
  - The frontend NEVER calculates FSRS intervals, competence decay, placement levels, ETags, or server authorization.
  - All authoritative learning math, scheduling, and revision tokens are strictly server-computed.

---

## 2. Learning Domain & FSRS Architecture Laws

- **Memory owns FSRS initialization.**
  - The Memory module is the sole creator and updater of FSRS memory cards, scheduling state, and revision intervals.

- **Exactly one FSRS scheduling lineage exists per learner × concept.**
  - Every concept learned by a user has a single authoritative memory lineage for the MVP. No fragmented or duplicate FSRS states per concept are permitted.

- **Recognition, listening, and production are competence projections, not separate schedulers.**
  - Multi-dimensional skill competence reflects domain projections of learning evidence, not independent FSRS review schedules.

- **Passive Reader exposure never activates Memory.**
  - Reading or viewing content in the Reader does not create an active memory card or schedule reviews.
  - Passive exposure contributes zero competence mass.

- **Library Save / Learn is the approved active-learning intent boundary for concept activation.**
  - Concept activation into Memory requires deliberate learner intent (e.g. saving from Reader to Library or clicking "Learn").

- **Starting Level Assessment creates no learning evidence.**
  - The Starting Level Assessment provides an initial starting level estimate band only.
  - It does not insert review logs, does not activate FSRS cards, and does not register learning evidence mass.

- **Starting Level remains optional.**
  - Learners can skip the assessment entirely without being penalized, without receiving a synthetic "A0" estimate, and without being locked out of the core product loop.

- **Brain is read/projection authority only.**
  - The Brain module provides analytical views, graph projections, and aggregated memory health. It does not own transaction scheduling or mutate review cards.

- **Today cannot fabricate evidence.**
  - The Today engine heuristic schedules study queues from existing due memory items and new concept budgets; it never invents artificial progress or evidence.

---

## 3. Transaction & Migration Invariants

- **Application / orchestration owns cross-module lifecycle.**
  - When an operation spans multiple domain modules (e.g. Library Save $\rightarrow$ Concept Activation $\rightarrow$ Memory Card Creation), the application orchestration service owns the workflow.

- **Cross-module transactions must have one explicit transaction owner.**
  - Exactly one service coordinates the database transaction. Individual stores participate using the passed transaction connection and do not commit independently.

- **Never rewrite historical applied migrations casually.**
  - Once a migration is applied or committed to the repository, it is immutable. Schema evolutions and corrections must always use forward migrations.

- **Every backend feature touching PostgreSQL must be verified on real PostgreSQL.**
  - Constraint validation, JSONB handling, foreign keys, and row locks must be tested against an actual PostgreSQL instance, not mocked or run against SQLite.

- **Concurrency-sensitive mutations require concurrency tests.**
  - Operations subject to race conditions (e.g. duplicate creation, idempotency replay, counter increments) must include automated concurrency tests using parallel workers.

- **Transactional mutations require rollback/failure-path testing.**
  - Every transactional workflow must have automated tests demonstrating that simulated mid-operation errors result in clean, complete rollbacks without partial database writes.

---

## 4. Verification & Review Invariants

- **Implementation model never self-certifies acceptance.**
  - A model or session that implements code cannot unilaterally declare a task finished or verified based solely on its own generated output.

- **A different session/model performs independent adversarial review.**
  - Critical integration slices, contract reconciliations, and security-sensitive boundaries require independent, read-only adversarial review before final task closure.

- **Architecture precedence:**
  - Architecture decisions from approved LINGUA specs (`MASTER_PROJECT.md`, `CODEX_PROJECT_SPEC.md`, `GEMINI_PROJECT_SPEC.md`) and Sol adjudications strictly override generic skill advice, framework defaults, or agent preferences.
