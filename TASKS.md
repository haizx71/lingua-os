# LINGUA OS — MVP Task Board

Status values: BACKLOG, READY, DESIGN / AWAITING APPROVAL, DOING, BLOCKED, DONE

## Current Knowledge V2 delivery gate — 2026-10-01

- **TASK-K2-07: DONE; HOSTED ACCEPTANCE: PASS** at master SHA
  `c696ac935852c4ebcd9e1183521996e5b12ad273`. Hosted workflow run
  [36780407824](https://github.com/haizx71/lingua-os/actions/runs/36780407824)
  passed; acceptance job `110108944244` succeeded (one test, 12 minutes), and
  separate current-run-cleanup job `110113728287` succeeded (43 seconds).
  Independent GPT-6 Luna / Max verification confirmed the ordered gates through
  baseline, two disposable actors, profiles, `wave_k2_07`, self-recall/typing,
  replay, isolation, both cleanup checks, retained-state comparison, and
  `finalizer_complete`. This does not cover listening or cloze: eligible staging
  material is not published. See `reviews/K2-07-hosted-acceptance-review.md` and
  `plans/TASK-K2-07-hosted-acceptance-harness.md`.
- **TASK-K2-08: DOING (bounded policy/contract/credential-free PostgreSQL CI); HOSTED FULL GATE: BLOCKED.** K2-07 remains PASS and unchanged. Read-only staging inventory found 94 provenance-eligible English word/phrase concepts (enough candidates for 20 distinct Save/Learn-activated due-review items, but not evidence that 20 items are currently due), while eligible published English content, content-linked eligible concepts, selected published cloze targets, selected HTTPS audio, exact-eight-minute content, and default-matched per-concept competence policy overrides each remain at zero. The current standard word/phrase policy weights recognition/listening/production `0.4/0.3/0.3`; accepted self-recall/typing evidence only updates production, and the selector does not bootstrap unobserved dimensions. No privileged synthetic learner-state or policy override path is accepted under the current plan. A compliant eight-minute content item and valid end-to-end review fixture are still required for hosted K2-08; K2-09 and K2-10 remain LOCKED. See `reviews/K2-08-hosted-fixture-readiness.md`.
- **TASK-K2-06: DONE; STAGING: PASS.** Disposable-actor hosted acceptance and
  independent review passed. The synthetic temporal fixture and cleanup limits
  are recorded in `plans/TASK-K2-06-tripartite-dynamic-state.md`.
- **TASK-K2-07: SOURCE DONE; HOSTED ACCEPTANCE PASS.** PR #19 merged at
  `ac02c349f8500975a843633556daf9d1bebc49e8` after the HIGH correctness
  trust-boundary fix, four passing CI jobs, successful Vercel Preview, and
  independent verify-fix review. The fix rejects caller `correct` for explicit
  modes without server grading; tests cover zero writes on rejection, legacy
  self-recall, and rating-fallback weight. Hosted disposable-actor validation
  was required before hosted K2-07 acceptance, now passed as recorded above.
  Select cloze, listening, typing, or self-recall from the weakest observed
  competence dimension and available canonical material. Keep one primary FSRS
  lineage through the existing atomic Memory and competence transaction.
  No schema migration; K2-08 through K2-10 remain downstream of hosted PASS.
- **TASK-K2-07 HOSTED HARNESS: SOURCE READY; HOSTED ACCEPTANCE PASS.** PR #28 adds the
  fail-closed protected-origin diagnostic. Independent combined-HEAD review at
  `459bb45813a8dfae9c1c04c7333ce1325877af65` passed with no HIGH/BLOCKER findings; CI security
  gate and exact-SHA Production deployment passed. PR #28 merged to `master` at
  `10a00b6c009e83301ba0d4cea4f32cf5714e89a5` (Production deployment `6763405633`, `vercel[bot]`,
  success). Independent security review
  passed for the isolated `codex/k2-hosted-acceptance-harness` branch, which implements the shared two-actor wave lifecycle, K2-07
  weakest-dimension/available-material plugin, per-response Render source-SHA verification,
  cross-actor isolation, exact replay, one competence plus FSRS lineage, complete retained-state
  comparison, Auth-only cleanup, in-memory finalizer retry, and bounded same-run crash recovery for
  unmarked partial creation. The workflow has a separate credential-free PR gate; the secret-bearing
  workflow has manual/scheduled triggers, step-scoped repo-secret mappings, a global staging
  mutation lock, and guarded cleanup. Acceptance is owner-only for both actor identities and
  checks the live master SHA before secret mapping and again before actor creation. All six
  repository-level secret names are configured, including the read-only database secret; a dedicated
  `k2_hosted_acceptance_reader` staging role is configured. DB-only preflight run `36593505143`
  passed at `3af469084b8106557dcca877572338040a8dc804`. No secret values were inspected; the
  later hosted run `36780407824` completed disposable-actor acceptance. Their residual risk is
  cross-workflow access by any workflow that references them, so
  the security assumption is that only owner `haizx71` has trusted write/merge access to workflow
  code. Owner-confirmed on 2026-09-30, the Vercel Trusted Source rule binds issuer
  `https://token.actions.githubusercontent.com`, repository `haizx71/lingua-os`, workflow display
  name `K2 Hosted Acceptance`, branch `master`, audience `https://vercel.com`, and target
  `Production` only. Vercel's guided UI does not expose `event_name` or `workflow_ref`; exact
  event/ref/workflow/repository/owner gates remain enforced by GitHub Actions. Do not claim Vercel
  enforces the event. Run `36734233167` (`workflow_dispatch` on `master` at
  `477663743d438364f34fb34f9712cfcf82d47949`) failed at the protected Vercel check before any
  actor; its current-run-cleanup job `109952362357` passed. No retained baseline/learner comparison
  gate was reached. K2-07 remains BLOCKED and K2-08 remains locked. PR #24 TLS certificate/role
  proof and PRs #25/#26/#27 narrow OIDC hostname
  fixes are merged in current `master`. Do not create a Share link, bypass protection, or change
  global protection settings.
  Subsequent run `36737740694` on `master` at `10a00b6c009e83301ba0d4cea4f32cf5714e89a5`
  FAILED at `verifyProtectedVercelOrigin`: HTTP 308, `x-vercel-id` present, redirect classified
  as `vercel-app`; the guard stopped before actor creation. Current-run-cleanup job
  `109964874290` passed (41 seconds). No retained baseline/learner comparison gate was reached.
  K2-07 remains BLOCKED and K2-08 remains locked; hosted acceptance is not established.
  Hosted run `36747649793` on master SHA `fdb4036e436e8b82b9fb67b1358413a2a5b31367` passed
  protected Vercel access and then failed the application migration-head gate before actor
  creation. Its current-run cleanup passed in 45 seconds. No retained baseline or learner
  comparison gate was reached. The app registry diagnosis was: `public.schema_migrations` had
  `0001`–`0017`; the Python probe reported app head `0017` / 17 applied, while the TypeScript
  adapter incorrectly reported app head `0019` / 19 applied. The Supabase migration ledger
  separately requires `0019` plus the custom read-only role, both confirmed. The mismatch blocked
  this run; the later run `36751277032` passed migration verification before failing at language
  creation. K2-07 remains BLOCKED and K2-08 remains locked.
  Hosted run `36751277032` on master SHA `e01cc21624bda37f59c982498686a6a709ca2264` passed
  protected-origin access, API health, migration verification, the runner recheck, and browser
  authentication. Two disposable actors were created/authenticated, then the first primary
  actor `POST /v1/me/languages` returned HTTP 409 `INVALID_STATE_TRANSITION` instead of 201.
  Its learner profile timezone was null; the harness omitted the required ETag-protected
  `PATCH /v1/me` to persist a valid IANA timezone before language creation (ADR-019). K2-07
  plugin assertions, replay, and isolation were not reached. The main finalizer completed without
  overriding the original error. Independent source/sanitized-log review found no cleanup,
  actor-residue, or retained-comparison error replacing the 409; logs did not expose explicit row
  counts. Separate current-run cleanup passed in 44 seconds. K2-07 remains BLOCKED; K2-08 remains
  locked. Do not report hosted acceptance as PASS.
  Hosted run `36755374459` on master SHA `df0947c2ed0dddbedebdcc2652bf83f01b53eff3` passed
  profile-timezone setup and canonical concept fetch/save, then failed the post-save primary
  snapshot row-count assertion (`wave`, line 191), before later K2-07 assertions, replay, or
  isolation. The primary snapshot expectations listed zero `user_concept_states` and lineage-state
  rows. Max review traced the conflict to the zero-row `user_concept_states` expectation: ADR-022
  requires one zero-evidence projection row marked `has_learning_intent` after explicit Save/Learn.
  The observer-row, Review/FSRS-row, and zero-evidence/mass expectations remain correct. Runtime
  row counts were not logged and are not reported. The main finalizer completed
  without overriding the original error and reached Auth deletion, actor-row absence, and retained-
  comparison equality by control flow; separate current-run cleanup passed in 42 seconds. No K2-07
  acceptance PASS: K2-07 remains BLOCKED and K2-08 remains locked. K2-06's accepted
  Save/Learn semantics remain unchanged.
  Current staging modality coverage is self-recall and typing; cloze/listening are untested due to
  missing published aligned content/HTTPS audio. The Supabase ledger is at migration `0019`; the dedicated `k2_hosted_acceptance_reader` role
  is configured with broad read access without
  `pg_write_all_data` membership. DB-only preflight passed; no disposable-actor preflight has run.
  Hosted run `36758861641` on master SHA `5a3920907bb31213d2327995e83107c56d5a8c34` ended
  after the 12-minute test timeout following a long Chromium installation. The internal stage is
  UNKNOWN: only the pre-secret SHA and Chromium checks are verified PASS; no protected-origin, API
  health, migration, profile, or wave gate is recorded as passing. Separate current-run cleanup job
  `110044096458` passed, but this does not prove completion of the original run's finalizer or its
  retained-baseline comparison. No K2-07 acceptance PASS is established; K2-07 remains BLOCKED and
  K2-08 remains locked. No actor identifiers, secret values, or unlogged runtime counts are recorded.
  Local source checks passed before hosted run `36755374459`: 61/61 focused harness Vitest
  (including workflow security), 6/6 probe pytest, 1/1 real Chromium redirect, and workspace
  typecheck. `pnpm backend:check` passed on the prior source snapshot (600 backend tests); this
  revision changes no backend or Python runtime code. These local checks did not create hosted
  actors or mutate hosted state. No schema migration is planned. Cleanup and the TTL janitor
  attempt exact-marker Auth deletion before
  the schema-dependent residue proof; if the frozen inventory no longer matches, they fail after
  deletion rather than being blocked by the acceptance-only migration-head gate.
- **Follow-up (frontend, low severity):** Brain's “Cần củng cố” chip selects
  `weak`; effective `forgotten` concepts appear in “Tất cả” but have no dedicated
  chip. This does not reopen K2-06's Brain/Review API acceptance.
- **Follow-up (cloze, medium severity):** Cloze target offsets can disagree
  between UTF-16 indexing and Python Unicode character indexing for
  supplementary-plane characters. Track separately from the K2-07 HIGH fix;
  add a focused regression test with that follow-up.

Older task snapshots below are historical and do not supersede this gate.

## TASK-K2-03 — Knowledge V2 Knowledge Graph & Concurrency-Safe DAG

Owner: FRONTEND
Status: DONE (integrated & verified in master)
Dependencies: TASK-K2-02

Implements Wave K2-03 Knowledge Graph and Concurrency-Safe DAG:
- Migration `0016_knowledge_v2_graph_dag.up.sql` / `.down.sql`:
  - Table `concept_edges` with foreign keys to `concepts`, check constraint on allowed `relation_type` values, and partial uniqueness index.
  - Concurrency-safe transactional cycle detection trigger function (`check_concept_edge_dag_integrity`) enforcing lock ordering to prevent race conditions and deadlocks.
- Service layer `services/api/src/lingua_api/catalog/graph_service.py` with recursive CTE graph traversal queries bounded by `MAX_PREREQUISITE_DEPTH = 4`.
- Automated test suite in `tests/backend/database/test_knowledge_v2_graph_schema.py` (11 tests).
- Local verification: 537/537 backend pytest PASS, full Vitest/acceptance PASS (Phase B, C, D, E), Next.js build PASS, Storybook build PASS.

## TASK-K2-02 — Knowledge V2 Polysemy Resolution

Owner: FRONTEND
Status: DONE (integrated & verified in master)
Dependencies: TASK-K2-01

Implements Wave K2-02 Polysemy Resolution:
- Migration `0015_knowledge_v2_polysemy_resolution.up.sql` / `.down.sql`:
  - Tables: `concept_senses`, `sense_glosses`, `sense_examples`, `context_senses`.
  - Check constraints, foreign keys to `concepts` and `lexemes`, sense ranking uniqueness, and browser privilege revocation.
- Service layer `services/api/src/lingua_api/catalog/sense_service.py` and ORM models in `models.py`.
- Automated test suite in `tests/backend/database/test_knowledge_v2_polysemy_schema.py` (5 tests).
- Verified as prerequisite foundation for Wave K2-03.

## TASK-K2-01 — Knowledge V2 Canonical Schema Foundations

Owner: FRONTEND
Status: DONE (local implementation & verification gate passed)
Dependencies: STAGING-HARDENING-GATE-20260921

Implements Wave K2-01 canonical schema foundations for Knowledge System V2:
- Migration 0014 (`0014_knowledge_v2_canonical_structures.up.sql` / `.down.sql`) defining `grammar_specifications`, `phrase_specifications`, and `phonetic_transcriptions` with relational integrity, check constraints, indexes, and explicit browser privilege revocation.
- SQLAlchemy 2.0 ORM models and Pydantic v2 DTOs in `services/api/src/lingua_api/catalog/models.py`.
- Automated tests in `tests/backend/database/test_knowledge_v2_canonical_schema.py`.
- Local verification: 521/521 backend pytest PASS, full Vitest/acceptance PASS (Phase B, C, D, E), Next.js build PASS, Storybook build PASS. Ready for remote verification by LUNA.

## STAGING-HARDENING-GATE-20260921 — PR #7 and hosted migration 0013

Owner: BACKEND. Status: BLOCKED (verification gate; K2-01 must not start).

PR #7 was reviewed live and merged into `master` with merge commit
`2e531c30d20eb53f04ac4558b64f38b141430785`; its 16 files are restricted to
`docs/knowledge-v2/**`. Supabase staging project `bdmtdvvnbicgkfririjo` received the exact
`0013_supabase_public_function_default_execute_lockdown_v1` SQL, the hosted and application
migration registries were verified, browser function EXECUTE remained denied, and the migration
pre/post learner snapshot matched exactly. Render deploy `dep-dao6lo7avr4c73b042sg` is live from
the merge SHA with `/health` 200 and authenticated `/v1/me`, language, Today, Brain and Review
read-only smoke responses 200.

The release gate is still blocked: a full disposable-actor cloud R1 4/4 run cannot be authorized
and cleaned up without staging Auth/admin credentials, and the Windows checkout reports generated
OpenAPI CRLF/LF byte drift plus a missing `@storybook/react` materialization in aggregate typecheck.
The local baseline remains backend 512/512 and frontend 711 passed (four local-API-dependent FRLL
tests fail closed). Do not create migration 0014 or begin K2-01. Evidence:
`reviews/FRLL-CLOUD-VERIFICATION-20260920.md`.

## UI-V2-PROMOTION — Promote `chatgpt/ui-redesign-v2-2026-09-15`

Owner: integration. Status: DONE. The accepted flows are reconciled and all 568 frontend
tests pass. `master` is `20c4cd52f2df0096ebf98679c239e119c6471ff6`; Vercel is live at
`https://lingua-os-web-mocha.vercel.app/today`, and Render deploy
`dep-danupg8jo6nc739roda0` is live with `/health` returning HTTP 200. Backend
format/lint/typecheck pass; the promotion checkpoint preceded the Phase A database gate. See
`plans/UI-V2-promotion.md` and `reviews/UI-V2-promotion-checkpoint.md`.

## PHASE-A-STABILIZE — Backend and migration stabilization

Owner: BACKEND
Status: DONE (local gate)
Dependencies: UI-V2-PROMOTION

Docker PostgreSQL 17.11 is available. Migration registry/test expectations now cover the
applied browser boundary migrations `0010`–`0012`, and additive migration `0013` closes the
global PostgreSQL default `PUBLIC EXECUTE` path for future public functions without rewriting
hosted migration history. Verification: `pnpm backend:check` passes Ruff format/lint, strict
mypy, and **512/512** backend tests; targeted lockdown/migration tests pass 12/12. Hosted staging
still needs the reviewed `0013` migration applied through the normal migration path.

## FRLL-REAL-VERIFICATION-20260920 — Real learning loop and promoted UI browser proof

Owner: BACKEND
Status: VERIFIED
Dependencies: UI-V2-PROMOTION, PHASE-A-STABILIZE

Phase B, C, D and E each pass 1/1 against disposable real Supabase Auth/PostgreSQL state.
Playwright R1 passes 4/4, with the canonical response-loss/reload/replay scenario rerun and
passing 1/1; actor ownership, Brain read-only behavior, contract responses and cleanup isolation
are verified. Current `master` and `origin/master` are `eb04318`. Render deploy
`dep-danvd1qjnfac7397dgr0` is live. The hosted staging registry still lacks additive migration
`0013`; no hosted database mutation was made, so applying that migration remains the next staging
hardening action. Full evidence is in `reviews/FRLL-CLOUD-VERIFICATION-20260920.md`.

## Global execution rule for every implementation task

Follow `docs/ENGINEERING_WORKFLOW.md` and `docs/SUPERPOWERS_POLICY.md`.

For non-trivial tasks:

- create a bounded plan under `plans/`
- define meaningful acceptance tests/checks
- implement the smallest complete slice
- perform specification-compliance review
- perform code-quality review
- run real verification before marking DONE

Approved specs and accepted ADRs are locked design by default. Do not brainstorm them again unless the task exposes a genuine unresolved gap.

## Owner administration

### TASK-ADMIN-001 — Owner-only first-party content authoring vertical slice
Owner: BACKEND
Status: DONE
Dependencies: TASK-003, TASK-004, TASK-008, owner self-use baseline

Implement the smallest server-authorized Admin surface needed for the owner to create, inspect,
validate, publish and retire an original English micro-article without editing PostgreSQL manually.

*Completed and verified: fail-closed Supabase actor UUID allowlist, seven versioned Admin API
operations, deterministic sentence segmentation and catalog matching, explicit first-party
provenance/rights, authoritative Reader publication gate, minimal `/admin` UI, generated OpenAPI
types and Reader visibility after publication. Existing PostgreSQL tables were reused; no migration,
learner-state write, learner-domain change, deployment or push was performed. Verification: 506/506
backend tests and 677/677 frontend/acceptance tests (55 files, sequential worker execution), contract
freshness, OpenAPI validation, Ruff, mypy, TypeScript, ESLint, production build and diff check PASS.*

### TASK-ADMIN-002 — Admin manual concept mapping
Owner: BACKEND
Status: DONE
Dependencies: TASK-ADMIN-001

Allow the owner to map exact UTF-16 sentence spans in unpublished first-party content to existing
canonical English catalog concepts. The owner-only API supports catalog search plus idempotent add and
remove operations, rebuilds aggregate `content_concepts` transactionally, and preserves the locked
validation/publication gate. The minimal `/admin/content/[id]` editor shows current mappings, offsets,
roles and an explicit ready/missing summary; it never creates fallback concepts. Existing
`sentence_concepts` and `content_concepts` tables were reused with no migration and no learner-state,
Memory/FSRS, competence or learning-event mutation. Verification: 510/510 backend tests; focused Admin
backend 9/9 and frontend 8/8; frontend/static acceptance 676 PASS with 4 credential-gated live FRLL
tests skipped across 55 files using one worker; generated contract freshness, OpenAPI contract tests,
Ruff, mypy, TypeScript, ESLint, Storybook, production build and diff check PASS.*

## Owner self-use baseline checkpoint — accepted (2026-09-13)

```text
OWNER SELF-USE BASELINE = ACCEPTED
HEAD = 810cea19d5b45021ab7a671ab5d353b235536f75
FINAL REVIEW = OWNER SELF-USE BASELINE ACCEPTED
```

- Local annotated tag: `owner-self-use-stable-2026-09-13` (not pushed).
- This is an owner self-use checkpoint, not a new full-FRLL acceptance claim. It leaves the
  ADR-023 FRLL evidence baseline unchanged. UI work is deferred to a later, separate step.

## Foundation

### TASK-001 — Repository/backend foundation
Owner: BACKEND
Status: DONE
Dependencies: none

Initialize the backend/workspace foundation according to `docs/BACKEND_SYSTEM_SPEC.md`. Add only the tooling needed for the MVP core and shared contracts. Establish test/type/lint commands.

Definition of done:
- reproducible install/start/test commands
- environment example present
- backend project structure matches the spec
- no post-MVP service scaffolding unless required as an interface

### TASK-002 — Frontend/design-system foundation
Owner: FRONTEND
Status: DONE
Dependencies: none

Initialize the web frontend and persistent design-system foundation according to `docs/FRONTEND_PRODUCT_SPEC.md`, `docs/UI_UX_SKILL_POLICY.md` and `design-system/DESIGN_BRIEF.md`. Use the approved UI UX Pro Max skill as design intelligence. Product specifications remain authoritative.

Definition of done:
- UI UX Pro Max guidance was consulted for learning-product design, accessibility and current stack patterns
- `design-system/MASTER.md` created as the approved persistent global design system
- primitive → semantic → component token architecture implemented
- mobile-first application shell
- base accessible primitives
- primary navigation shell for Today, Read, Review, Brain, Progress
- loading/error/empty/success primitives
- responsive and reduced-motion foundations
- test/type/lint commands
- final UI/UX anti-pattern review completed

### TASK-003 — Core database schema v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-001

Implement the minimal Language Brain MVP schema with versioned migrations.

Minimum domain entities:
- users/user language profile integration
- concepts
- user_concept_states
- memory state/review log
- content items
- content concepts
- exposure events
- provenance/quality metadata

### TASK-004 — Shared API contract v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-001, TASK-003

Define the first executable OpenAPI contract for onboarding/profile, Today, Reader/content, Review, Brain and Progress. Keep endpoints minimal and consistent with MVP.
*Completed and accepted: authoritative OpenAPI 3.2 contract with 24 paths / 29 operations, synchronized API enums/errors, cursor/auth/idempotency/concurrency conventions, contract invariant tests, and frontend reconciliation report.*

### TASK-005 — Frontend contract types and mock layer
Owner: FRONTEND
Status: DONE
Dependencies: TASK-002, TASK-004

Generate/use types from shared contracts and create contract-valid development mocks without duplicating backend business rules.
*Completed: pinned OpenAPI TypeScript generation, operation-shaped transport boundary, deterministic contract-valid mock responses, DTO-to-view-model adapters, safe error mappings, opaque cursor semantics, explicit persistence-gap labels, and full frontend reconciliation without backend algorithms or UI redesign.*

## Learning loop

### TASK-006 — Memory Engine / FSRS MVP
Owner: BACKEND
Status: DONE
Dependencies: TASK-003

Implement the primary FSRS memory lineage per learner/concept, due queue and review logging.
*Completed: pinned py-fsrs 6.3.2/FSRS-6, immutable versioned default parameters, deterministic
UTC transition service, atomic PostgreSQL event/state/item writes, row-lock concurrency,
idempotent replay, actor-scoped due query and real-PostgreSQL invariant coverage. Product endpoints
and Today/competence logic remain outside this task.*

### TASK-006A — Review API Adapter v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-004, TASK-006

Implement the thin authenticated FastAPI/application adapter for the authoritative Review queue and
answer operations, harden deterministic Memory Engine idempotency replay/races, and preserve the
contract/domain boundary without adding Today or competence-learning algorithms.
*Completed: Supabase JWT actor boundary, signed keyset queue cursor, strict OpenAPI DTO/error
mapping, current persisted competence reads, transactional server-derived remaining-due count,
exact historical replay snapshots, deterministic cross-lineage key conflicts, and full backend/
frontend regression verification.*

### TASK-006B — ConceptSummary partOfSpeech contract correction
Owner: BACKEND
Status: DONE
Dependencies: TASK-004, TASK-005, TASK-006A

Correct the public concept contract so lexical concepts may expose `partOfSpeech` while grammar and
skill concepts may omit it or return `null`. Reconcile generated types, Review projection,
frontend adapters/view models, deterministic mocks, and non-visual presentation handling without
changing endpoints, algorithms, UX design, or motion.
*Completed: `ConceptSummary` and `ConceptDetail` now expose optional/nullable POS, generated types
are fresh, Review serializes lexical/grammar/skill concepts without fake values, frontend adapters
and presentations omit absent POS cleanly, and all backend/database/frontend gates pass.*

### TASK-006C — Frontend Authentication Foundation
Owner: FRONTEND
Status: DONE
Dependencies: TASK-004, TASK-005, TASK-006A

Establish the canonical, testable Supabase Auth foundation for the Next.js App Router frontend required to supply genuine Bearer access tokens to HttpApiClient for authenticated FastAPI requests.
*Completed: Added official `@supabase/supabase-js` and `@supabase/ssr` client SDKs, `createBrowserSupabaseClient` and `createServerSupabaseClient` with cookie synchronization, `AuthTokenProvider` abstraction in `@lingua/types`, React `AuthProvider` / `useAuth()` lifecycle management, `ProtectedRoute` boundary preventing redirect loops, strict rejection of service-role keys in browser config, 16 comprehensive invariant unit tests, clean Storybook and production builds. Login method decision recorded as pending specification.*

### TASK-006C.1 — Authentication Foundation Hardening
Owner: FRONTEND
Status: DONE
Dependencies: TASK-006C

Harden the frontend authentication architecture:
- Upgrade `@supabase/ssr` to current maintained `^0.12.4` and verify lockfile consistency.
- Implement Next.js App Router session-refresh middleware (`apps/web/src/middleware.ts` & `apps/web/src/lib/supabase/middleware.ts`) with automatic cookie synchronization.
- Correct `AuthProvider.signOut()` semantics to inspect error results, preserve actual session on failure, and expose errors without falsely reporting unauthenticated state.
- Structurally isolate browser config to read only approved `NEXT_PUBLIC_*` variables with defense-in-depth secret guards.
- Implement typed `AuthTokenProviderError` in `createSupabaseAuthTokenProvider()` to clearly distinguish legitimate session absence (`null`) from unexpected SDK/network failures.
*Completed: Hardening requirements satisfied, 19 auth tests passing, clean Storybook and typecheck gates. Login method decision remains pending specification.*

### TASK-006C.2 — Supabase SSR Alignment Patch
Owner: FRONTEND
Status: DONE
Dependencies: TASK-006C.1

Apply upstream Supabase SSR alignment patch:
- Align Next.js App Router middleware with `supabase.auth.getClaims()` for asymmetric JWT verification and refresh per official guidance.
- Propagate authoritative `@supabase/ssr` `setAll` response/cache headers (`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`) onto `NextResponse`.
- Retain Next.js 15.5.23 `middleware.ts` convention (documented: future Next.js 16 upgrade will migrate convention from middleware to proxy).
- Correct and verify exact test counts (20 tests in `auth.test.tsx`, 307 total tests across 27 files).
*Completed: getClaims() session validation aligned, response cache headers preserved on NextResponse, 20/20 auth tests passing, 307/307 total tests passing across all 27 files, clean static Storybook and Next.js production builds (`ƒ Middleware 93.2 kB`). Login method decision remains pending specification.*

### TASK-006D — Learner Evidence Ingestion & Competence Projection v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-003, TASK-004, TASK-006, TASK-006A

Implement the authoritative
replayable learner-evidence boundary and recognition/listening/production competence projections.
Competence confidence, mastery and ConceptStatus remain separate from the learner/concept's one
FSRS memory lineage. The proposed v1 domain policy is recorded in
`docs/LEARNER_EVIDENCE_COMPETENCE_V1.md`. The approved TASK-006A reconciliation makes
`user_concept_states` the Review item competence source and retains `user_skill_states` only as a
language-profile aggregate; OpenAPI and frontend remain unchanged.
*Completed: implemented immutable `competence-beta-v1` parameters, append-only canonical learner
evidence, deterministic concept/profile projections, exact historical Review result replay and a
single atomic Memory + evidence + projection transaction. Migration `0004` is reproducible and
loss-aware; formulas and constants resolve from the immutable lineage and real PostgreSQL
replay/concurrency/rollback tests pass. OpenAPI and frontend source are unchanged, and the frozen
frontend baseline remains 307/307 tests across 27 files.*

### TASK-006E — Profile / Language Profile API & Auth Bootstrap v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-001, TASK-003, TASK-004, TASK-006C.2

Implement the authenticated product-identity bootstrap and exactly the five frozen Profile/
language-profile operations. Begin with a bounded preflight for required email authority,
native-language mapping, onboarding-completion semantics, ETag derivation and idempotent profile
creation. Do not implement login UI, Starting Level logic, frontend integration or new preference
fields.
*Added by the post-TASK-012 core roadmap audit because every completed learning engine requires an
owned product/language profile, while no current runtime can create or update one.*
*Approved domain and contract/persistence freeze are recorded in
`docs/PROFILE_LANGUAGE_AUTH_BOOTSTRAP_V1.md`: only `GET /v1/me` may bootstrap the minimal application
user/learner profile; timezone is explicit before vi→en profile creation; Starting Level remains
optional. OpenAPI, contract tests, and generated TypeScript are updated/fresh. The approved bounded
compatibility patch preserves nullable
display name, email, and timezone through the shared view model, removes email-to-name coupling,
and uses only a presentation-level missing-name label. Generated freshness, workspace typecheck,
lint, 313/313 frontend tests across 27 files, Storybook, and production build pass. TASK-006E is
implemented under the approved five-operation boundary. Migration `0007` adds nullable timezone,
independent revisions, authoritative native language, exact create replay, bounded goals, RLS and
protected rollback. Runtime provides sole minimal `/v1/me` bootstrap, strong ETags, exact replay,
lifetime vi→en lifecycle, IANA timezone, downstream no-bootstrap and ownership hiding. Real
PostgreSQL 17.11 reports 188/188 database tests and 321/321 full backend tests; frozen frontend
remains 313/313 across 27 files. OpenAPI and frontend application behavior are unchanged.*

### TASK-007 — Review UI / Review Live Frontend Integration
Owner: FRONTEND; BACKEND explicitly authorized for bounded interrupted-worktree completion
Status: DONE
Dependencies: TASK-005, TASK-006, TASK-006A, TASK-006B, TASK-006C, TASK-006C.1, TASK-006C.2

Implement Review flow and all specified states using the API contract.
*Accepted: Final review verdict "TASK-007 INDEPENDENT REVIEW: PASS". Resumed from `c6bebbf` and the existing uncommitted implementation by explicit user authorization. TASK-009 Mini and TASK-011 Today Live are accepted prerequisites for this integration. The hook, adapters, explicit answer submission, stable-key recovery receipt, opaque queue pagination, and actor/request lifecycle protection are implemented and accepted. Verified 2026-09-06: 35 Review tests + 13 HTTP tests pass; all 466 frontend tests across 35 files pass; generated freshness, typecheck, lint, Storybook, and production build pass. Zero contracts/services/database changes. See `plans/TASK-007-review-ui-integration.md` and `docs/TASK-007_IMPLEMENTATION_REVIEW.md`.*




### TASK-008 — Reader/content service MVP
Owner: BACKEND
Status: DONE
Dependencies: TASK-003, TASK-004, TASK-006D

Implement content retrieval, concept annotations and learner-known-state projection required by Reader.
*Completed with migration `0005_reader_content_service_v1`, deterministic Reader seed, published
content list/detail, catalog sentence save, monotonic progress and atomic passive-exposure fan-out
through TASK-006D. Real PostgreSQL, backend, contract and frozen frontend gates passed. Frontend
application behavior remained frozen.*

### TASK-008A — Dictionary and Reader Analyze API v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-004, TASK-006D, TASK-008, TASK-006E

Implement the existing `getConcept`, `searchDictionary`, and `analyzeReaderText` contracts by
reusing the authoritative lexical/catalog and learner-projection boundaries. Do not ingest an
external dictionary, add vector search, or duplicate Brain/catalog truth.

Completed with deterministic exact-match dictionary lookup and Reader Analyze, provenance and
ownership enforcement, opaque cursor pagination, and PostgreSQL-backed contract tests.

### TASK-008B — Library API v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-004, TASK-006, TASK-006D, TASK-008, TASK-006E

Implement the existing Library list and concept/content/sentence save/remove contracts with actor
ownership, opaque cursor pagination and intrinsic idempotency. Concept save must preserve the one
Memory lineage and canonical evidence authorities; notes remain not persisted.
*Completed and accepted by Sol at HEAD `6d7c803` (GAP-01 CLOSED). Forward migration `0009_library_concept_save_intent_v1`,
atomic transaction coordination via `PostgresLibraryStore`, `LibraryApplication`, `CompetenceEngine.apply_concept_save`
(calling `PostgresCompetenceStore.update_concept_save_intent`), and `PostgresMemoryEngine.ensure_lineage_in_transaction`.
Implemented immutable concept save intents, canonical evidence ingestion, single FSRS lineage
preservation (MEM-001), 7 Library operations matching OpenAPI, opaque cursor pagination, fail-closed
profile/ownership authorization, and 15 tests covering RLS-GATE-01 behavioral verification,
REPLAY-01 rebuild invariance, GATE-01 endpoint authorization, concurrency barriers, and 3-boundary
transactional rollbacks. Recorded ADR-022 with frozen contract alignment (ADR-PATH-01).*

### TASK-008C — Production content and lexical data pipeline v1
Owner: BACKEND
Status: BACKLOG
Dependencies: TASK-003, TASK-008

Create the bounded, provenance-first import/normalize/dedupe/QA workflow and a production-usable
English-for-Vietnamese A0-B1 content/lexical pack required before external user testing. External
sources require their already-recorded license/source approval; do not expand into AI generation,
speech scoring, CJK or unapproved datasets.

### TASK-009 — Reader UI
Owner: FRONTEND
Status: DONE
Dependencies: TASK-005, TASK-008, TASK-008B, TASK-017

Implement Reader, concept tap/detail and save-to-learning interactions.
*Completed and accepted after independent review: TASK-009 Mini slice connecting authenticated, product-ready learner to real concept
discovery (`GET /v1/dictionary/search`), concept inspection (`GET /v1/concepts/{conceptId}`), explicit
Save/Learn invocation (`PUT /v1/library/concepts/{conceptId}`), authoritative saved state reconciliation
(`GET /v1/library/items?itemType=concept`), search sequence out-of-order race drop, and TASK-017 actor
lifecycle transition isolation. PAGINATION-009 fixed and PAGINATION-009-R1 corrected: Full multi-page cursor traversal
ensuring saved concept authority is complete across all cursor pages before committing UI state; cycle loop detection
(`seenCursors`) with fail-closed termination; saved-state authority tri-state preserving positive evidence on failure
while strictly suppressing the active "Lưu để học" CTA for unconfirmed concepts; accessible retry mechanism
(`retryReconciliation`); and actor lifecycle isolation (`TEST-009-PAGE-08`). Verified with 21 invariant tests in
`tests/frontend/task009-concept-discovery-save.test.tsx` (402/402 frontend tests passing). Zero backend or contract changes.
The remaining full Reader integration is completed by TASK-READ-001 below.*

### TASK-READ-001 — Reader live integration
Owner: BACKEND
Status: DONE
Dependencies: TASK-008, TASK-008A, TASK-009, TASK-017

Replace the default `/read` fixture with the authoritative published-content Reader flow while
preserving the approved UI and learner-state boundaries.
*Completed and verified: `/read` now loads the active English language profile, recommended
published content and full content detail through `ApiClient`; renders authoritative segment and
sentence order, attribution, audio availability, saved state and server reading progress; resolves
annotated concepts by canonical ID; records explicit lookup/read exposure; persists sentence,
content and concept saves through their frozen mutations; and restores progress from server data
without local resume authority. Stable idempotency keys cover ambiguous retries, duplicate clicks
are suppressed, and same-actor plus Actor A/B stale results are dropped. No OpenAPI, backend,
database, migration or generated-type change was required. Verification: 12/12 focused live Reader,
105/105 focused Reader/transport/contract regression, 690/690 frontend/static acceptance, 510/510
backend on PostgreSQL, Ruff, mypy, TypeScript, ESLint, contract freshness, production build and diff
check PASS. See `reviews/TASK-READ-001-reader-live-integration.md`.*

### TASK-LIBRARY-001 — Library live integration
Owner: BACKEND
Status: DONE
Dependencies: TASK-008, TASK-008A, TASK-009, TASK-017, TASK-READ-001

Replace the default `/library` fixture/local-state flow with the authoritative Library API while
preserving the approved presentation and learner-state boundaries.
*Completed and verified: `/library` now traverses every opaque cursor page from
`GET /v1/library/items`, validates each complete response before committing it, preserves server
order and canonical concept/sentence/content identity, and maps transport DTOs through dedicated
view models. All three removal operations use their existing canonical DELETE endpoints, suppress
duplicate clicks, preserve rows on failure and accept only server-confirmed results. Same-actor
request sequencing plus application actor epoch guards prevent stale load, pagination, mutation,
error and finally paths from contaminating a newer request or Actor B. Empty live collections no
longer display fixture rows, and Library reads/filtering create no learner-state writes. No OpenAPI,
backend, database, migration or generated-type change was required. Verification: 20/20 focused
Library tests, 714/714 full frontend/static/live acceptance tests across 57 files, 510/510 backend
tests on PostgreSQL, Ruff format/lint, mypy, generated-contract freshness, TypeScript, ESLint,
production build and diff check PASS. See `reviews/TASK-LIBRARY-001-library-live-integration.md`.*

### TASK-010 — Today Engine heuristic v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-006, TASK-006D, TASK-008

Implement the deterministic MVP Today priority engine using due urgency, weakness, goal, recent exposure, content fit and time budget.
*Completed with pure deterministic `today-heuristic-v1`, migration `0006`, one persisted
learner-local daily plan, bounded authoritative Review/Content candidates, budget allocation,
ordered Review targets, evidence-gated completion, exact replay, PostgreSQL concurrency, private
diagnostics, and the two frozen FastAPI Today operations. Goal relevance is neutral; no standalone
`learn`, OpenAPI change, or frontend application change was made.*

### TASK-011 — Today UI
Owner: FRONTEND
Status: DONE
Dependencies: TASK-005, TASK-010

Implement Today live frontend integration connecting the authenticated product-ready learner to the authoritative Today backend (GET /v1/today and POST /v1/today/{planId}/activities/{activityId}/complete).
*Accepted: Final review verdict "TASK-011 TODAY CONTRACT R2 FINAL REVIEW: PASS — MARK TASK-011 DONE AND PROCEED TO TASK-007 REVIEW LIVE". Live hook with actor lifecycle isolation (epoch / sequenceRef / isCurrentActor / LinguaActorAbortedError), presentation adapters preserving server order with zero client heuristics/sorting, optimistic completion suppression and authoritative rollback, fail-closed timezone authority requiring stored valid IANA timezone (TIMEZONE-011-R1 fixed), strict OpenAPI query shape without manual timeZone widening (TODAY-CONTRACT-011-R2 fixed), 26/26 live integration tests (covering TEST-011-R2-01..06), 429/429 full frontend suite passing, zero backend/contract changes.*

### TASK-012 — Language Brain projection API
Owner: BACKEND
Status: DONE
Dependencies: TASK-003, TASK-006, TASK-006D, TASK-008

Expose learner concept states and summary projections required for Brain and Progress.
*The design/read-model and public contract are frozen and verified. Required nullable mastery,
required aggregate concept confidence, per-dimension confidence, nullable Brain memory health,
synthetic zero-state, existence-hiding 404, eight-value ConceptStatus, and opaque keyset semantics
are authoritative. All dependencies are DONE and no migration is required. The three-route runtime,
read-only projection store, signed cursor, DTO mapping, and focused tests are implemented. Static,
contract, 15/15 focused Brain PostgreSQL, 150/150 database, 250/250 full backend, empty/reproducible
`0001..0006`, rollback, concurrency, read-only, ownership, and query-bound gates pass on PostgreSQL
17.11. No OpenAPI, migration, or frontend application change was made. See
`docs/LANGUAGE_BRAIN_PROJECTION_API_V1.md` and `docs/LANGUAGE_BRAIN_IMPLEMENTATION_V1.md`.*

### TASK-013 — Language Brain UI
Owner: FRONTEND
Status: BLOCKED
Dependencies: TASK-005, TASK-012

Implement visible Language Brain summary and concept detail states defined in the UI spec.
*Note: UI canvas, filters, and 3D skill evidence are complete and TASK-012 is satisfied; the task
remains manually BLOCKED until explicit Frontend/frontend authorization after the core roadmap audit.*

### TASK-014 — Progress API
Owner: BACKEND
Status: BACKLOG
Dependencies: TASK-006A, TASK-006D, TASK-008, TASK-010, TASK-012

Expose evidence-based progress summaries without XP-first metrics.
*Before runtime, freeze the authoritative definitions for Memory Health, successful learning day,
target learning days, minutes, strengthened concepts and review-retention bucketing. Brain state,
Reader progress, Today completion and Progress trends must remain separate authorities.*

### TASK-015 — Progress UI
Owner: FRONTEND
Status: BLOCKED
Dependencies: TASK-005, TASK-014

Implement Progress according to the UI spec.
*Note: UI analytics and evidence breakdown complete; marked BLOCKED pending Backend implementation of TASK-014.*

## FRLL acceptance checkpoint

### FRLL-F1 — Acceptance harness hardening R2/R3/R4/R5

Owner: BACKEND
Checkpoint status: READY_FOR_INDEPENDENT_REVIEW
Baseline: `1878406`; preserves existing B/C/D/E acceptance flows.

Complete replay/snapshot and database equality, full persisted competence observations,
fail-closed disposable Auth cleanup verification and frozen OpenAPI response validation.
All eight required adversarial attacks fail closed. Support: 115 PASS; full Vitest:
581 PASS / 4 environment-conditional SKIP; relevant PostgreSQL/backend: 100 PASS.
Static gates pass; protected product areas unchanged. Evidence and limitations:
`docs/FRLL_F1_HARDENING_REVIEW.md`.

F1 controller phases B/C/D/E and adversarial support checks are LIVE VERIFIED
(4/4 phases; 143/143 support tests). R1 browser checkpoint #1 and checkpoint
#2 are each LIVE VERIFIED at 4/4 with fresh actors, including HTTP 200 answer,
post-commit response-loss/replay, passive zero-write, Actor-B isolation and
fail-closed cleanup. Frontend regression is 657/657; contracts freshness,
typecheck, lint, Storybook and production build pass. Backend baseline is
493/493 on Docker PostgreSQL 17. Sanitized evidence:
`docs/FRLL_CHECKPOINT_EVIDENCE_20260912.md`; implementation/evidence HEAD:
`0723c1d7780bc0f6087da81b5ebac764658c3162`.

Checkpoint status: `ACCEPTED` (final reviewer verdict: `FINAL FRLL ACCEPTED`).
FRLL is frozen as a regression baseline. Reopen only for a real regression or
newly proven acceptance defect; do not refactor it for style. The next planning
milestone is `MVP Pilot Readiness`; no implementation is authorized by this
entry.

## MVP Pilot Readiness (planning milestone)

Status: PLANNED — discovery and acceptance planning only; implementation not started.
Owner: BACKEND / FRONTEND within existing ownership boundaries.
Dependencies: FRLL accepted; TASK-017 and TASK-017A complete.

Goal: verify that a real learner can use the MVP end-to-end without developer
intervention. The readiness review will cover signup/login/logout/recovery,
onboarding and Starting Level, profile/language setup, Dictionary → Learn,
Reader encounters, Today, Review, Brain and Progress; refresh/reopen/browser
restart; mobile layout; empty/loading/error/offline-ish states; deployment and
migration configuration; production secret handling; error logging and
observability; backup/recovery; security/rate limits; and real user-data
isolation. This milestone does not authorize AI Tutor, speech features,
Chinese/Japanese, frontend ownership of domain algorithms, or changes to the
frozen FRLL baseline.

### Private staging deployment hardening (pre-pilot gate)
Owner: BACKEND
Status: READY
Dependencies: FRLL accepted; no product/domain changes permitted.

Repository preparation for the frozen `Browser → Vercel → /api → Render
FastAPI → Supabase` topology is implemented and covered by focused tests.
DEP-01 (server-side `/api` proxy), DEP-04 (minimal Render runtime manifest),
DEP-05 (hosted frontend configuration fails closed), and DEP-10 (environment
file ignore coverage) are resolved in code/config. DEP-03 remains an explicit
external Supabase staging-dashboard action: the hosted Site URL and exact
allowed redirect URLs must be configured and verified before deployment. No
host was deployed or pushed by this work; independent deployment review is
required before enabling staging.

## Onboarding

### TASK-016 — Starting Level Estimate v1
Owner: BACKEND
Status: DONE
Dependencies: TASK-003, TASK-004, TASK-006D, TASK-006E

Implement a bounded heuristic/adaptive Starting Level Estimate. Do not claim certification.
*The post-TASK-012 audit places this before TASK-014 in roadmap priority, but after TASK-006E so an
assessment always belongs to an authenticated, owned language profile.*
*Approved ADR-020 and `docs/STARTING_LEVEL_ESTIMATE_V1.md` freeze the isolated deterministic
`starting-level-heuristic-v1`: exact 8/12/16-slot transitions, A0–B1 output, confidence capped at
0.85, objective listening, immutable snapshots/results, one active attempt, no completed retake,
and no Competence/FSRS/Today/Content mutation. The Assessment-only OpenAPI correction is applied,
32 contract tests, generated freshness and workspace typecheck pass. The completed narrow
compatibility patch preserves all frozen semantics and establishes the 314-test/27-file frontend
baseline with zero skipped/todo tests. Migration `0008` and the Assessment runtime are implemented
under the approved boundary. Final verification used an isolated loopback-only portable PostgreSQL
17.11 UTC cluster: 43/43 Assessment PostgreSQL tests, 231/231 complete database tests, 195/195
non-database backend tests, and 426/426 complete backend tests pass. Empty `0001..0008`, no-op
reapply/checksum protection, `0008` down/up, protected rollback, fail-closed legacy preflight,
runtime concurrency/idempotency/replay, persisted A0/A1/A2/B1 flows, skip/abandonment, immutable
snapshots/results, RLS/IDOR, failure atomicity, and Evidence/Today/Content isolation are verified.
Required verification fixes serialize start through the owned profile row and make attempt-item
snapshots append-only. Contract/static and frozen 314-test/27-file frontend gates pass without an
OpenAPI or frontend application behavior change. See
`docs/STARTING_LEVEL_ESTIMATE_IMPLEMENTATION_V1.md` and
`reviews/TASK-016-starting-level-estimate-v1.md`.*

### TASK-017 — Live Auth + Onboarding Integration v1
Owner: BACKEND (temporary integration execution; frontend foundation remains Frontend-owned)
Status: DONE
Dependencies: TASK-004, TASK-005, TASK-006C.2, TASK-006E, TASK-016, TASK-017A

Connect Supabase email/password authentication, the shared HttpApiClient, `/v1/me`
bootstrap, explicit profile/timezone confirmation, vi→en language-profile creation,
and optional Starting Level start/resume/answer. End at `/today`; Today, Review,
Reader, Brain, Progress, Library and Dictionary remain mock-driven.
*Completed controlled hardening across all four slices (A: actor runtime isolation & actor-scoped pointer C-1/C-2; B: readiness predicate & route gating C-3/C-4; C: language profile 409 conflict reconciliation C-5; D: assessment stimulus preservation C-6), subsequent Required Fix Pass (DEF-01 complete 6-point readiness predicate; DEF-02 paused profile recovery & resumption; DEF-03 stale actor lifecycle outcome isolation), and DEF-03-R1 final actor lifecycle fix (application-level operation epoch guarding across AuthContext, LiveOnboardingFlow, and useProductReadiness). Child ETag transport dependency resolved by verified TASK-017A. Final Sol re-acceptance received; marked DONE.*

### TASK-017A — Language Profile child ETag transport correction
Owner: BACKEND
Status: DONE
Dependencies: TASK-004, TASK-006E, TASK-017

Add required read-only `etag: string` to shared LanguageProfile response schema across collection, nested `/me`, create, and update representations.
*Completed and verified: OpenAPI 3.2 contract updated and validated with Redocly; generated TypeScript fresh; child ETag exposed in Profile DTO and route mappers via `language_profile_etag`; preserved through frontend adapter/view model; same-ID archived reactivation with child ETag verified. Verification passed: 458/458 backend tests (including real PostgreSQL suite), 338/338 frontend tests across 30 files, typecheck, lint, Storybook static build, and Next.js production build. Real deployed Supabase smoke remains environment-conditional and does not block task closure.*
