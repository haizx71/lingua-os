# TASK-016 review — Starting Level Estimate v1

## Specification review

The implementation preserves the frozen policy version, 3/4 primary gate,
6/8 verified gate, 8/12/16 terminal lengths, four objective domains and the
0.85 confidence cap. Skips count as presented slots but never as evidence.
Production, speech, pronunciation, AI Tutor, Today, Content, Brain and FSRS
scheduling are outside this bounded slice.

## Boundary and security review

- All reads and writes bind the verified actor identity and owned language
  profile; missing and foreign resources use the same not-found path.
- Public snapshots contain no answer key, difficulty, correctness or private
  diagnostics.
- Item selection is fail-closed on active template, approved quality/provenance,
  allowed license, policy domain/type, four-option shape and listening audio.
- Attempt snapshots, responses and results are append-only, and assessment state is isolated from
  learning/competence/FSRS tables.
- Idempotency replay uses the stored request fingerprint and a per-actor/key
  transaction advisory lock.
- Start/resume locks the actor-owned language-profile row, so concurrent requests using distinct
  idempotency keys converge on one active attempt instead of leaking a database uniqueness error.
- FastAPI exposes the three frozen operation IDs, camel-case assessment path
  parameters, and required `Idempotency-Key` header from the authoritative contract.

## Migration review

The migration is versioned and paired with a protected rollback. It refuses
legacy assessment templates/items whose new semantics cannot be inferred without
inventing values, enforces two-decimal confidence and evidence bounds, binds an
attempt's policy version to its template, limits positions to 0..16, and protects
terminal attempt identity/status.

## Verification status

**APPROVED — no Critical or Required finding remains.** Verification used PostgreSQL 17.11 on an
isolated loopback-only UTC cluster. Results: 43/43 focused Assessment PostgreSQL tests, 231/231
complete database tests, 195/195 non-database backend tests, and 426/426 full backend tests.
Migration empty apply/reapply/checksum/down-up/protected rollback/preflight checks all pass.

The focused security matrix passes for IDOR/resource hiding, cross-profile replay, fake item and
option rejection, server-derived score/level/confidence, stale-item and final-answer races,
idempotency-key reuse, service-role actor scoping, completed-result/snapshot mutation and public
answer-key leakage. No Assessment path mutates Evidence, Competence, FSRS, Review, Today, Content or
Brain state. Candidate loading is one bounded set-oriented read per four-slot bundle, followed by
four required immutable snapshot inserts; current-item and result reconstruction use fixed query
bounds and show no unbounded N+1 path.

Final gates also pass: Ruff format/lint and strict mypy across 86 files, 32/32 contract tests,
OpenAPI validator, generated TypeScript freshness, Redocly exit 0 with the unchanged Reader
warning, workspace typecheck, ESLint, 314/314 frontend tests across 27 files, Storybook and Next.js
production build. OpenAPI and frontend application behavior were not changed.
