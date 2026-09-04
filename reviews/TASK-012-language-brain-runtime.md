# TASK-012 — Language Brain Projection API v1 runtime review

Verdict: **APPROVED — POSTGRESQL VERIFIED**

## Specification compliance

- Implements only the three frozen Brain GET operations and preserves their operation IDs and DTO
  semantics.
- Preserves nullable mastery, required aggregate confidence, per-dimension score/confidence/count,
  nullable memory health, exact eight-state ConceptStatus, synthetic zero state, existence-hiding
  404, direct stored relations, and opaque keyset pagination.
- Does not add OpenAPI fields, migrations, frontend behavior, placement logic, FSRS scheduling,
  Today logic, inference, AI/speech, Neo4j, or CJK behavior.

## Architecture and code quality

- Domain/read models, cursor codec, DTOs, application service, PostgreSQL adapter, and route wiring
  are separated.
- Shared Review transport DTOs are reused where the frozen contract has identical semantics.
- One repeatable-read/read-only transaction and one database timestamp serve each request.
- Bounded batched queries avoid per-concept reads; all learner access paths bind actor/profile.
- Static boundary coverage rejects write SQL, offset pagination, event replay, and scheduler paths.

## Correctness and boundary findings resolved

1. **Required:** summary status aggregation initially omitted actor/profile parameters in two union
   branches. The query now binds ownership consistently across every learner anchor.
2. **Required:** an early implementation draft attempted to infer Starting Level confidence from
   persistence that does not carry the frozen confidence-band semantics. That derivation was
   removed; TASK-012 returns `null` until the owning placement task provides authoritative state.
3. **Quality:** duplicate response/meta shapes were replaced by existing shared DTOs, and example
   projection was made distinct and bounded.

4. **Test fixture:** an invalid FSRS `new` fixture shape and cross-suite canonical-key collisions
   were corrected without changing production behavior.
5. **Runtime:** PostgreSQL timestamps at the Brain boundary are now required to be timezone-aware
   and rendered in UTC, matching the RFC 3339 contract and the accepted Reader/Content convention.
6. **Environment:** the disposable portable PostgreSQL cluster was configured explicitly to UTC
   after the first run inherited the host timezone. No Memory or Today behavior was changed.

No open specification, runtime, migration, security, or query finding remains.

## Security and data boundaries

- Authentication uses the established actor boundary; non-owned and absent profiles are
  indistinguishable 404s.
- Catalog provenance/license/review/quality gates fail closed.
- Cursor signatures bind actor and filter scope and cannot be replayed across learners/profiles.
- No ownership identifiers, private projection internals, raw database errors, or policy
  parameters enter public DTOs.
- Brain GET code contains no learner-state write statement.

## Verification evidence

- Ruff format check: 67 files already formatted.
- Ruff lint: all checks passed.
- strict mypy: no issues in 67 source files.
- non-database backend suite: 100/100 passed.
- focused Brain PostgreSQL suite: 15/15 passed on PostgreSQL 17.11.
- complete database suite: 150/150 passed on a fresh database.
- full backend suite: 250/250 passed.
- focused migration suite: 3/3 passed for empty `0001..0006`, reproducible reapply, down/up,
  checksum rejection, and protected rollback.
- measured PostgreSQL data-statement counts: summary 6, concept page 3, detail 6, plus one
  transaction-setup statement per request; all fixed budgets pass and no N+1 path exists.
- read-only/no-mutation, synthetic-zero non-persistence, ownership-hidden 404, and repeatable-read
  concurrency cases are included in the passing 15-case focused suite.
- Contract/frontend freeze evidence remains valid because contract and frontend application state
  did not change after those gates passed.

## Approval

All mandatory real-PostgreSQL, migration, static, contract, boundary, and regression gates pass.
TASK-012 is approved as DONE. TASK-014 is not started by this approval.
