# TASK-012 — Language Brain Projection API contract-freeze review

Status: **APPROVED FOR RUNTIME IMPLEMENTATION; RUNTIME NOT STARTED**

## Scope and result

The TASK-012 domain/read-model decisions are frozen in `contracts/openapi.yaml` without a database
migration or backend runtime implementation. The amendment is limited to the three existing Brain
GET operations, Brain-specific concept/summary DTOs, generated TypeScript, focused contract tests,
and the approved narrow frontend mock compatibility patch.

## Contract compliance

PASS. `BrainConceptSummary` and `BrainConceptDetail` require `mastery: number | null` and bounded
aggregate `confidence`. All three competence dimensions continue to expose separate bounded score
and confidence plus non-negative evidence count. `BrainSummary.memoryHealth` is required nullable
and has no default or Brain-owned formula. Synthetic zero state and passive discovered state remain
representable without a GET write.

PASS. The exact eight ConceptStatus values remain registry-backed and exclude `due`. Explicit
missing/non-owned language profiles use the same reusable 404 response. The collection keeps an
opaque server-controlled keyset cursor, deterministic canonical-key/concept-ID order, and maximum
limit 100. No private competence masses, projection lineage, state versions, or raw ownership
fields are exposed.

## Architecture and boundary review

PASS. The contract remains read-only, PostgreSQL-backed, learner-anchored, and relational. It adds
no endpoint, scheduler, mastery formula, Memory Health formula, graph inference, frontend business
logic, schema, or migration. Reader, Today, Review, Progress, UI, GSAP, and design-system contracts
remain outside the amendment.

## Verification evidence

- OpenAPI Spec Validator 0.9.0: `contracts/openapi.yaml: OK`.
- Redocly CLI 2.13.0 recommended lint: valid, exit 0; one unchanged TASK-008 Reader discriminator
  warning requests `defaultMapping`.
- Focused contract tests: 22 passed.
- Generated TypeScript freshness: passed with `openapi-typescript` 7.9.1.
- Ruff format: 58 files formatted; Ruff lint: all checks passed.
- Strict mypy: no issues in 58 source files.
- Non-database backend tests: 95 passed.
- Full backend attempt: 95 passed before 135 PostgreSQL setup errors because Docker Desktop was
  unavailable. This is environmental and does not block the contract-only change.
- Approved frontend compatibility result: generated freshness, TypeScript, ESLint, Storybook,
  Next production build, and 308 tests across 27 files pass. `apps/web` source is unchanged.

## Verdict

No contract, architecture, security, performance, ownership, schema, migration, or frontend
application blocker remains. TASK-012 is contract-frozen and ready for a separately authorized
runtime implementation turn; it is not DONE.
