# TASK-006D implementation review

Date: 2026-08-23  
Verdict: PASS — no required finding open

## Specification compliance

- Implemented the frozen `competence-beta-v1` equations, reliability weights, mode mappings,
  mastery eligibility/policies and all eight deterministic ConceptStatus values. Every numeric
  formula/constant resolves from the profile's immutable parameter lineage.
- Preserved exactly one FSRS scheduling lineage per learner × concept. Competence projections are
  separate and do not schedule reviews.
- `user_concept_states` is the per-concept authority; `user_skill_states` is profile aggregate only.
- Passive exposure changes history/exposure/status only. Reader and Assessment public ingestion are
  intentionally deferred.
- OpenAPI and frontend source were not changed.

## Schema and migration review

- Migration `0004` is paired, transactional through the existing runner, and reproducible from an
  empty database. It seeds one immutable parameter set and no learner/content corpus.
- New parameter/policy/head tables have explicit PK/FK, ownership, version and bounded-value
  constraints. New projection columns use `timestamptz` and exact numeric masses.
- Canonical source identity, fingerprint, profile sequence and lineage are all-or-none; direct
  canonical event update/delete is rejected. The replay index follows the concrete actor/profile
  ordered replay query.
- The down migration refuses a lossy rollback after competence activity. Pre-TASK-006D scalar rows
  remain physically intact with null lineage and are treated as zero evidence on first v1 write.

## Transaction and concurrency review

- Review owns one database transaction across FSRS transition, source Review event, canonical
  event, concept/profile projections and exact result snapshot.
- Lock order is Review/FSRS → profile projection head → ordered skill rows → concept row. Source
  derivation uniqueness and actor-scoped fingerprints prevent double projection.
- Real PostgreSQL tests prove rollback-after-FSRS, retry, same-concept concurrent distinct evidence,
  duplicate/conflicting idempotency, ownership isolation and no lost update.
- Incremental projection equals a full rebuild from canonical events, including delayed occurrence
  times and mixed Review/passive exposure.

## Architecture, security and performance review

- Pure domain/projector code is independent of PostgreSQL and FastAPI; stores own parameterized SQL;
  application services own orchestration and transaction participation.
- Actor/user-language/concept integrity is verified server-side. RLS own-select is enabled on the
  new user projection head; anonymous access is revoked.
- Review queue batch-loads concept competence in its existing query and performs no read-side
  persistence. Rebuild loads the profile language once rather than once per concept.
- No new dependency, public endpoint, frontend algorithm, Neo4j, AI/speech or future-language
  behavior was introduced.

## Calibration observations

For clean objective successes equally distributed across every required dimension:

| State | Evidence per required dimension | Score | Confidence |
|---|---:|---:|---:|
| familiar | 3 | `5/7 ≈ 0.7143` | `3/7 ≈ 0.4286` |
| active | 6 | `0.8` | `0.6` |
| mastered | 12 | `0.875` | `0.75` |

Thus a word/phrase needs approximately 9/18/36 clean objective observations in total across its
three required dimensions; grammar needs approximately 6/12/24 across recognition and production.
Half-weight self-reported evidence needs roughly twice as many observations to supply the same
confidence mass. These are golden-test observations, not threshold changes.

## Verification evidence

- Ruff format/lint: PASS.
- strict mypy: PASS, 33 source files.
- Backend/PostgreSQL tests: PASS, 158 / 158 after the last full run.
- Generated OpenAPI TypeScript freshness/typecheck: PASS.
- Frontend lint: PASS.
- Frozen frontend tests: PASS, 307 tests / 27 files.
- Storybook static build: PASS (existing bundle/sourcemap warnings only).
- Next.js production build: PASS (existing ESLint-plugin warning only).

Known compatibility boundary: Review events created before TASK-006D may lack a competence result
snapshot. Their replay fallback is deliberately zero/current-due compatible; every new event stores
the exact historical result.
