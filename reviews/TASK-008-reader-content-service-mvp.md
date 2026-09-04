# TASK-008 Reader / Content Service MVP — implementation review

Date: 2026-08-30  
Verdict: PASS — no required implementation finding open

## Specification compliance review

- PASS: frozen Content list/detail, catalog sentence save, segment progress and Reader exposure
  operations are executable without changing `contracts/openapi.yaml` or frontend application code.
- PASS: content ordering is a bounded content-fit heuristic only; no Today, placement, FSRS,
  pronunciation, AI Tutor or future-language behavior was added.
- PASS: Reader resolves catalog hierarchy, UTF-16 occurrences and distinct concepts server-side.
  Full lexical detail remains Dictionary-owned.
- PASS: progress, Library membership and evidence history remain separate authorities. Progress
  creates no evidence; save state creates no progress; unsave cannot delete progress/exposure.
- PASS: passive fan-out participates in TASK-006D's transaction and changes no competence mass,
  score, confidence, mastery, evidence count, non-unseen status or FSRS state.

## Schema and publication review

- PASS: paired migration `0005_reader_content_service_v1` adds only curated level, segment type,
  progress, mutation snapshot and Reader source-to-concept fan-out state required by the frozen
  model. IDs/FKs, profile-language ownership, timestamptz, checks, RLS and query indexes are present.
- PASS: one `(user_id, content_id)` progress row is authoritative. Source facts, exact result
  snapshots, concept links and canonical learning events have constrained distinct identities.
- PASS: publication is fail-closed across English/A0-B1/review timeline/structure/metrics/offsets,
  full dependency provenance/attribution and exactly `allowed` licenses. Published content
  structures and Reader historical snapshots are database-enforced append-only/immutable.
- PASS: deterministic seed contains 5 content items, 14 sentences, 30 concepts, 42 occurrences and
  one audio asset, including published, unpublished and restricted/quarantined fixtures only.

## Migration review

- PASS: clean PostgreSQL database applies `0001..0005`; unchanged reapply is a no-op; one-step
  down/up succeeds; a changed historical checksum is rejected.
- PASS: `0005` down refuses after Reader learner activity. The empty-database round-trip test uses
  its own disposable database so it never attempts to delete TASK-006D append-only history.
- PASS: migration and concurrency gates ran on PostgreSQL 17.11, not a mock database.

## Transaction, security and performance review

- PASS: FastAPI owns one transaction per mutation. PostgreSQL actor/key locks protect retries;
  actor/content locks make progress monotonic; publication identities are share-locked until
  mutation commit. No Python process lock is used.
- PASS: actor/profile ownership, English language, publication, content/segment/sentence hierarchy,
  catalog audio and lookup spans are validated server-side. Client `userId`/`conceptIds` are not
  accepted and internal errors are mapped to safe envelopes.
- PASS: list uses one grouped overlay query and exact Decimal keyset keys. Detail uses three bounded
  batch queries; there is no annotation, learner-state or Dictionary N+1 path.
- PASS: exposure source, all canonical children, projections and exact result commit or roll back
  together. Same key/body returns historical data; changed body conflicts; concurrent duplicate and
  cross-fingerprint races have one database winner.

## Verification evidence

- Ruff format check: 48 files formatted.
- Ruff lint: zero findings.
- strict mypy: 47 source/test files, zero findings.
- Backend suite: 198 passed.
- PostgreSQL suite: 121 passed; focused TASK-008 PostgreSQL matrix: 37 collected.
- OpenAPI Spec Validator: OK.
- Generated TypeScript freshness: PASS.
- Redocly CLI 2.13.0 recommended lint: valid, exit 0, one warning on the unchanged frozen
  `ReaderExposureRequest` discriminator requesting `defaultMapping`. The union's three request
  schemas already require literal `exposureType`; no contract change was made during TASK-008.
- Frontend: typecheck PASS, lint PASS, 307/307 tests across 27 files PASS.
- Storybook static build and Next.js production build: PASS; existing non-failing
  dependency/sourcemap/chunk and ESLint-plugin notices remain.

## Boundary / regression conclusion

No OpenAPI schema, enum/error registry, generated TypeScript artifact, frontend source, UI, GSAP or
design-system behavior changed. TASK-007 remains blocked. No required schema decision remains before
the next explicitly authorized core task; infrastructure rate limiting and transient Reader Analyze
remain deferred outside TASK-008 runtime scope.
