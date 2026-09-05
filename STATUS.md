# LINGUA OS — Project Status

Version: 4.0 starter
Phase: TASK-017 & TASK-008B Completed and Accepted by Sol; GAP-01 Closed; TASK-009 Mini Live Concept Discovery + Save/Learn Ready for Review

## Ready for Review

- `TASK-009 Mini`: Live Concept Discovery + Explicit Save/Learn UI (READY_FOR_REVIEW)
  - Live Concept Discovery: Real debounced search (`GET /v1/dictionary/search`) with sequence counter tracking (`searchSequenceRef`) dropping stale out-of-order responses.
  - Concept Inspection: Lazy concept detail retrieval (`GET /v1/concepts/{conceptId}`) expanding definition, English explanation, and example sentences.
  - Explicit Save/Learn: Button communicates learner intent ("Lưu để học" / "Đã lưu vào kho học", never "Đã thành thạo"), invoking authoritative Library mutation (`PUT /v1/library/concepts/{conceptId}`). Disabled pending state ("Đang lưu...") prevents duplicate submissions.
  - Authoritative Saved State Reconciliation (PAGINATION-009 Fixed & PAGINATION-009-R1 Corrected): Multi-page cursor traversal (`GET /v1/library/items?itemType=concept`) ensuring full saved concept authority across all pages before committing UI state; cycle loop detection (`seenCursors`) with fail-closed termination.
  - Saved-State Authority Tri-State (PAGINATION-009-R1): `SAVED` (positively known IDs preserved even on traversal failure), `NOT SAVED` (valid ONLY upon complete, successful cursor exhaustion), and `UNKNOWN / INCOMPLETE AUTHORITY` (during in-flight traversal or following error). Concepts with unknown status render an accessible retry action ("Thử đồng bộ lại") or checking indicator, strictly suppressing the active "Lưu để học" CTA. Explicit clean retry mechanism (`retryReconciliation`) resets traversal state and initiates a fresh sequence from page 1.
  - Actor Lifecycle Isolation: Guarded across all async boundaries via `isCurrentActor` and `LinguaActorAbortedError`, preventing stale Actor A search, reconciliation, failure, or save operations from mutating Actor B UI state (`TEST-009-PAGE-08`).
  - Zero Backend / Contract Diff: Zero modifications to `contracts/`, `services/`, or `database/`.
  - Verification: 402/402 frontend tests passing across 33 test files (21 invariant tests in `tests/frontend/task009-concept-discovery-save.test.tsx` covering `TEST-009-PAGE-01..08`), 0 typecheck errors, 0 lint warnings, clean Storybook static catalog build, and Next.js 15 production build. Ready for fresh review.

## Completed

- `TASK-008B`: Library API v1 + GAP-01 Memory Activation — ACCEPTED by Sol (GAP-01 CLOSED)
  - Forward migration `0009_library_concept_save_intent_v1`: created `concept_save_intents` with database-level immutability trigger (`enforce_concept_save_intent_immutability`), expanded `learning_events_source_type_check` to permit `'concept_save_intent'`, and created covering index `ix_saved_concepts_user_saved_at`.
  - GAP-01 Memory Activation & MEM-001 Invariant: Only `PUT /v1/library/concepts/{conceptId}` activates Memory via `PostgresMemoryEngine.ensure_lineage_in_transaction()`. Exactly one FSRS review item (`UNIQUE (user_id, concept_id)`) per learner/concept. Subsequent saves/learns never reset existing review items or FSRS state. Reader exposures, reading progress, sentence saves, content saves, assessments, and Dictionary lookups strictly do NOT activate Memory.
  - Canonical Learning Event & Competence Projection: First save intent creates a canonical learning event (`learning.concept.saved.v1`, `source_type = 'concept_save_intent'`) and updates `user_concept_states` to set `has_learning_intent = true` (`ConceptStatus.LEARNING`) with 0 competence mass.
  - Library API Operations: Implemented 7 FastAPI endpoints (`GET /v1/library/items`, `PUT /v1/library/concepts/{id}`, `DELETE /v1/library/concepts/{id}`, `PUT /v1/library/sentences/{id}`, `DELETE /v1/library/sentences/{id}`, `PUT /v1/library/content/{id}`, `DELETE /v1/library/content/{id}`).
  - Opaque Cursor Pagination & Security: Tamper-proof HMAC SHA-256 cursors with timestamp-keyed pagination, actor ownership, fail-closed active profile checks, and exact contract conformity.
  - Standards Gates & Verification: 478/478 backend tests passed (including RLS-GATE-01 behavioral verification across owner/other/anon and 14 library integration tests covering REPLAY-01 rebuild invariance, GATE-01 authorized endpoint whitelist, concurrency barrier overlap, and 3-boundary transactional rollback & retry), ADR-022 recorded with contract paths verified (ADR-PATH-01), Ruff format/lint clean across 108 files, Mypy strict clean across 108 files, Redocly OpenAPI lint valid, contract generation fresh. Accepted implementation HEAD: 6d7c803.

- `TASK-017`: Live Auth + Onboarding Integration Hardening (Findings C-1..C-6 + Required Fix Pass DEF-01..DEF-03 + DEF-03-R1) — ACCEPTED by Sol
  - C-1: Assessment pointer strictly actor-scoped in local storage (`lingua:starting-level:active-assessment:${userId}`); foreign pointers completely isolated.
  - C-2: `HttpApiClient` actor generation tracking (`setActor`), flushing cached ETags on actor switch and rejecting stale in-flight responses with `LinguaActorAbortedError` (`code: 'ABORTED'`).
  - C-3: Unified readiness predicate (`useProductReadiness`); unassessed learners with confirmed timezone and active profile are authoritatively ready and route to `/today` without assessment entrapment; explicit re-entry gated on `mode=assessment`.
  - C-4: `AppRouteBoundary` deterministic route gating truth table preventing unready data-leak loops and rendering accessible loading state during bootstrap.
  - C-5: Language profile 409 `CONFLICT` reconciliation via collection discovery (`listMyLanguageProfiles`), smoothly adopting active profiles or presenting reactivation UI for archived profiles with child ETags; fails closed on `IDEMPOTENCY_KEY_REUSED`.
  - C-6: Stimulus preservation (`textSnippet` + `audioUrl`) through adapter view models and accessible audio player with playback reset on question switch, visible focus, keyboard controls, and non-blocking error handling.
  - DEF-01: Authoritative 6-point product readiness predicate (`evaluateProductReadiness`) checking authenticated actor, learner profile ID, confirmed valid IANA timezone, active vi→en language profile, valid canonical `LearningGoal`, and persisted `dailyMinutes` 5..180; Starting Level Estimate remains optional.
  - DEF-02: Paused vi→en `LanguageProfile` recovery & resumption with explicit resume UI, PATCH with same ID and child ETag, 412 refetch without automatic second PATCH, and 409 CONFLICT collection discovery.
  - DEF-03: Stale actor `LinguaActorAbortedError` outcomes completely isolated without mutating state, corrupting stages, or showing erroneous error banners across onboarding and route readiness.
  - DEF-03-R1: Application-level actor operation identity and generation/epoch tracking implemented across `AuthContext`, `LiveOnboardingFlow`, and `useProductReadiness`. All async mutation and bootstrap paths guarded across every await, catch block, 412 recovery, and finally block. Stale mutations cannot clear active actor busy states, commit foreign profiles, advance stages, or post recovery banners. 5 deterministic lifecycle race tests added (`TEST-ACTOR-LIFECYCLE-01..05`). Final Sol re-acceptance received; marked DONE.

- `TASK-017A`: Language Profile child ETag transport correction
  - Shared `LanguageProfile` response schema now provides required, read-only opaque `etag: string` across collection, nested `/me`, create, and update representations.
  - FastAPI Profile route mappers project `language_profile_etag` and create replay projects the original child token from the historical snapshot without schema migrations.
  - Frontend types regenerated; onboarding adapter and view models preserve child ETag for authoritative PATCH operations.
  - Verification passed: 458/458 backend tests (including real PostgreSQL suite), 338/338 frontend tests across 30 files, typecheck, lint, Storybook static catalog build, and Next.js production build. Real deployed Supabase smoke remains environment-conditional and does not block task closure.
- Product/system specification v2.0
- UI/UX/frontend specification v2.0
- Master project contract v4.0
- Codex and Gemini ownership instructions
- Starter shared contracts (`contracts/enums.json`, `contracts/errors.json`, `contracts/openapi.yaml`)
- UI UX Pro Max policy and setup workflow
- Superpowers policy and setup workflow
- Shared engineering workflow
- Parallel Git/worktree workflow
- Agent-specific v4 start prompts
- `TASK-001`: Repository/backend foundation
  - Python 3.12+ FastAPI service package under `services/api/src/lingua_api`
  - Operational `GET /health` check excluded from the public product OpenAPI schema
  - Exact runtime/development dependency locks and clean-install workflow
  - Backend format, lint, strict type-check, test and development commands
  - Test-first smoke coverage proving health behavior and zero premature product endpoints
- `TASK-003`: Core PostgreSQL schema v1
  - 46 normalized MVP tables for identity/profile, language/CEFR metadata, relational Language
    Brain, provenance/licensing/QA, sentences/content/audio metadata, learner projections/events,
    one primary FSRS lineage, saved library state, Today persistence and Starting Level Estimate
    evidence
  - Paired `0001_core_schema_v1` up/down SQL and a transactional, advisory-locked,
    checksum-verified migration runner
  - Supabase-native identity/RLS boundary across all 18 user-owned tables; authenticated own-row
    read only, anonymous denied, server-side writes preserved
  - Database-enforced score/domain bounds, idempotency keys, owner/language integrity, provenance
    publication gate and concrete access-path indexes
  - Minimal deterministic `en`/`vi` and CEFR A0/pre-A1 through B1 reference seeds only
- `TASK-004`: Shared API contract v1
  - Authoritative OpenAPI 3.2 contract with 24 MVP product paths, 29 operations, 94 product/shared
    schemas, stable operation IDs, UUID/RFC 3339 conventions and reusable success/error envelopes
  - Deliberate Browser → FastAPI → PostgreSQL/Supabase architecture; Supabase JWT actor mapping,
    FastAPI-owned product access and RLS defence-in-depth boundaries documented
  - Cursor pagination on five growing collections; ETag/If-Match for concurrent profile edits;
    retry-safe POST mutations and idempotent Library operations
  - One public memory snapshot per learner/concept with recognition/listening/production competence
    projections kept separate; no FSRS parameters or algorithm internals exposed
  - Published-content provenance/attribution boundary and evidence-based Starting Level Estimate
    contract without certification/IRT semantics
  - Synchronized API enum/error registries, 13 contract invariant tests, generated-client/docs smoke
    checks and MATCH/RENAME/CHANGE/REMOVE/ADD frontend reconciliation report
- `TASK-005`: Frontend contract types and mock layer
  - Pinned `openapi-typescript@7.9.1` generation from the authoritative OpenAPI 3.2 contract with a
    checked-in immutable TypeScript surface and deterministic freshness gate
  - Generated-schema DTO aliases and operation-shaped `ApiClient`; deterministic `MockApiClient`
    responses satisfy OpenAPI envelopes, UUID/time, cursor, attribution, ETag and idempotency shapes
  - Explicit `DTO -> adapter -> UI view model -> component` dependency direction for Today, Review,
    Reader, Dictionary, Brain, Progress, Profile and Starting Level Estimate surfaces
  - Strict eight-value `ConceptStatus`; server-owned `MemorySnapshot` kept separate from
    recognition/listening/production competence and from due presentation
  - Safe Vietnamese mappings for all 11 API error codes without exposing server/database messages
  - Persistence gaps labeled `LOCAL_ONLY`, `NOT_YET_PERSISTED`, or `DEFERRED`; no successful server
    mocks invented for settings, resume position, notes, new-concept budget, export or deletion
  - Provisional raw FSRS, ownership, ingestion-quality, graph, offset-pagination and frontend
    placement/mastery calculation assumptions removed from production and legacy test scenarios
- `TASK-006`: Memory Engine / FSRS MVP
  - Maintained MIT-licensed `py-fsrs==6.3.2` implementing FSRS-6 behind a narrow backend scheduler
    adapter; no scheduling equations copied into LINGUA OS
  - Immutable `fsrs6-global-default-v1` parameter seed with exact algorithm/library/version lineage
    on every memory state and review event
  - One primary learner/concept lineage, deterministic injected UTC clock, four authoritative
    ratings and explicit five-mode presentation-to-evidence mapping
  - Actor-scoped activation/review/due service with atomic review-event/state/item writes,
    PostgreSQL row locking, state-version protection and conflict-safe idempotent replay
  - Index-compatible owned active-due query only; no Today ranking, competence scheduling,
    placement, content recommendation, product endpoint or frontend behavior added
- `TASK-006A`: Review API Adapter v1
  - Exactly two product routes: authenticated Review queue and Review answer; health remains outside
    product OpenAPI and all other product endpoints remain unimplemented
  - Asymmetric Supabase JWT verification to actor, strict ownership, signed opaque keyset cursor,
    contract-valid DTO/error mapping and no client ownership/private FSRS input
  - Exact persisted post-transition result snapshots for delayed idempotent replay, legacy-history
    reconstruction boundary, and deterministic domain conflict for cross-lineage same-key races
  - Current three-dimension `user_skill_states` projection returned without competence math;
    remaining due count derived after transition in the same transaction
- `TASK-006B`: ConceptSummary part-of-speech contract correction
  - `ConceptSummary` and `ConceptDetail` now model POS as optional/nullable for grammar and skill
    concepts while lexical concepts retain normalized POS values
  - Generated TypeScript exposes `partOfSpeech?: PartOfSpeech | null`; deterministic fixtures cover
    lexical, grammar and skill concepts without placeholder values
  - Review due projection accepts absent lexemes/POS without weakening ownership, concept status,
    prompt, competence, cursor or Memory Engine validation
  - Review, Dictionary, Reader and Brain adapters/presentations omit absent POS without empty
    parentheses, dangling separators or visual redesign
- `TASK-002`: Frontend/design-system foundation (`design-system/MASTER.md`, DTCG 3-tier tokens, Storybook suite, base primitives, AppShell, semantic token refactoring)
- Frontend Architecture Correction Pass:
  - Contract authority preserved; provisional status explicit on frontend types pending `TASK-004`
  - Backend business logic (FSRS scheduling math, difficulty/retention calculations) removed from frontend
  - Strict 8-status `ConceptStatus` aligned with `contracts/enums.json`; `due` modeled cleanly as `isDue` / presentation state
  - Single source of truth in test harness (`tests/frontend/harness/types.ts` imports `@lingua/types`)
  - DTCG Tier-3 component token layer implemented and consumed across UI shells & features
  - UI test classifications properly designated (Unit, Component, Integration, Contract/View-Model)
  - Hardcoded domain fixtures extracted into `apps/web/src/fixtures/*.ts`
- GSAP Motion System & Token Consistency (Frontend Layer Stable):
  - Motion Design specification (`design-system/MOTION_DESIGN.md`) and Motion Opportunity Audit (`design-system/MOTION_AUDIT.md`) complete.
  - Complete 3-tier DTCG motion token architecture (`primitiveMotion` -> `semanticMotion` / `motionSeconds` / `motionNumeric` / `gsapEasings` -> `componentMotionTokens` / `componentMotionNumeric`).
  - GSAP animations in `ReviewCard`, `ReviewSession`, `ConceptNode`, `LanguageBrainCanvas`, `ProgressAnalytics` strictly consume component/semantic motion tokens with zero hardcoded magic numbers or raw easing strings.
  - Standard `usePrefersReducedMotion()` hook (SSR-safe `useSyncExternalStore`) universally enforced across all 5 animated surfaces with immediate fallback and zero animation leaks (`useGSAP` scoped with automatic lifecycle cleanup).
  - Synchronous non-blocking feedback (<= 300ms) and immediate DOM/ARIA data correctness preserved from Frame 0.
  - Note for Codex: The frontend motion system is complete, verified, and stable. Do not rewrite or modify frontend motion layers during backend development.

- `TASK-006C`: Frontend Authentication Foundation
  - Official `@supabase/supabase-js@^2.49.1` and `@supabase/ssr` for Next.js App Router
  - Browser-safe configuration resolver `getSupabasePublicConfig()` reading approved `NEXT_PUBLIC_SUPABASE_*` variables
  - `createBrowserSupabaseClient()` with singleton caching and `createServerSupabaseClient()` using Next.js `cookies()` store
  - Transport-agnostic `AuthTokenProvider` interface in `@lingua/types` allowing `HttpApiClient` to obtain legitimate Bearer JWTs without coupling to Supabase internals
  - Canonical `createSupabaseAuthTokenProvider()` delegating to `supabase.auth.getSession()` with automatic SDK token refresh
  - React `AuthProvider` / `useAuth()` lifecycle context managing `loading | authenticated | unauthenticated` states, dynamic session subscriptions (`onAuthStateChange`), and `signOut()`
  - `ProtectedRoute` boundary preventing redirect loops during session bootstrap and presenting unauthenticated state without hardcoding unapproved login methods
  - Product learner profile explicitly decoupled from Supabase user auth identity (auth UUID boundary only)
- `TASK-006C.1`: Authentication Foundation Hardening
  - Upgraded `@supabase/ssr` to current maintained `^0.12.4` with verified supply-chain lockfile consistency
  - Implemented canonical Next.js App Router session-refresh middleware (`apps/web/src/middleware.ts` & `apps/web/src/lib/supabase/middleware.ts`) with automatic cookie synchronization
  - Corrected `AuthProvider.signOut()` semantics to inspect error results, preserve actual session on failure, and expose errors without falsely reporting unauthenticated state
  - Structurally isolated client configuration to strictly read approved `NEXT_PUBLIC_*` variables with defense-in-depth secret guards
  - Implemented typed `AuthTokenProviderError` in `createSupabaseAuthTokenProvider()` to clearly distinguish legitimate session absence (`null`) from unexpected SDK/network failures
- `TASK-006C.2`: Supabase SSR Alignment Patch
  - Aligned Next.js middleware session refresh with `supabase.auth.getClaims()` per official Supabase SSR guidance
  - Implemented full cache-prevention header forwarding from `@supabase/ssr` `setAll` (`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Pragma`, `Expires`) onto `NextResponse` without dropping headers on response clone
  - Retained Next.js 15.5.23 `middleware.ts` structure (documented: future Next.js 16 upgrade will migrate to proxy.ts)
  - Verified exact auth test suite count (20 tests in `auth.test.tsx`, 307 total tests passing across all 27 files)
  - Note: Login method decision remains recorded as pending specification (`LOGIN METHOD DECISION REQUIRED`).
- `TASK-006D`: Learner Evidence Ingestion & Competence Projection v1
  - Immutable `competence-beta-v1` parameter lineage with exact weighted-Beta score/confidence,
    mastery policy and deterministic eight-state ConceptStatus derivation
  - Append-only canonical `learning_events` replay authority; source/canonical identities,
    fingerprints and profile ingestion ordering are separate and constrained
  - `user_concept_states` is the only learner × concept competence authority;
    `user_skill_states` is a separately rebuildable language-profile aggregate
  - Review answer now commits FSRS, source event, canonical evidence, projections and exact
    historical response snapshot in one PostgreSQL transaction
  - Migration `0004_learner_evidence_competence_v1` and real PostgreSQL zero-read, passive exposure,
    replay/rebuild, rollback, idempotency, ownership and no-lost-update coverage
  - No OpenAPI or frontend source change; frozen frontend baseline remains 307 tests / 27 files
- `TASK-008`: Reader / Content Service MVP
  - Migration `0005_reader_content_service_v1` adds curated A0-B1/segment metadata, sole
    learner-content progress authority, durable mutation snapshots and one-source-to-many concept
    exposure linkage with RLS, ownership FKs, indexes and protected rollback
  - Fail-closed publication gate validates reviewed English structure, QA/metrics/offsets, complete
    dependency provenance/attribution and exactly `allowed` licenses; published structure and Reader
    history snapshots are immutable
  - Executable Content list/detail, catalog sentence save, monotonic progress and client-attested
    READ/LISTEN/LOOKUP exposure operations preserve Dictionary, Library, TASK-006D and FSRS boundaries
  - Deterministic LINGUA-authored seed: 5 content items, 14 sentences, 30 concepts, 42 occurrences
    and one audio asset with published/unpublished/restricted fixtures
  - No OpenAPI, generated TypeScript, frontend source, UI, GSAP or design-system change
- `TASK-010`: Today Engine heuristic v1
  - Pure immutable `today-heuristic-v1` policy with exact Review order, deterministic budget
    packing, 8-minute content reserve, 4-unseen new-content cap, 48-hour novel-selection window,
    unfinished/saved/recommended precedence, and no standalone `learn`
  - Migration `0006_today_engine_heuristic_v1` adds all-lifecycle daily uniqueness, UTC `as_of`,
    ordered Review target snapshots, public replay snapshots, private diagnostics, completion
    fingerprint/result metadata, ownership/RLS constraints, and proof-path indexes
  - Repeatable-read generation, PostgreSQL concurrent-winner handling, IANA learner-local dates,
    same-day stability, timezone reconciliation, fail-closed publication invalidation, and bounded
    candidate queries
  - Executable GET/complete Today routes match frozen OpenAPI; completion requires authoritative
    Review/Reader proof and emits no fake evidence or learner-state mutation
  - No OpenAPI, generated TypeScript, frontend source, UI, GSAP, or design-system change
- `TASK-012`: Language Brain Projection API v1
  - Exactly three authenticated read operations for summary, concept list, and concept detail
  - Read-only repeatable-read PostgreSQL composition of accepted learner, competence, Memory,
    catalog, relation, provenance, license, and quality state; Brain GETs persist nothing
  - Nullable mastery and memory health, explicit confidence/evidence, exact eight-state
    ConceptStatus, synthetic zero-state, passive discovered-zero competence, and hidden-ownership
    404 semantics preserved from the frozen contract
  - Signed actor/profile/filter-bound keyset cursor and fixed batched query bounds with no N+1
  - PostgreSQL 17.11 verification passes: 15/15 focused Brain, 150/150 database, 250/250 full
    backend, and 3/3 focused migration tests
  - No OpenAPI, migration, generated TypeScript, or frontend application change; frozen frontend
    baseline remains 308 tests / 27 files
- `TASK-006E`: Profile / Language Profile API & Auth Bootstrap v1
  - Migration `0007_profile_language_auth_bootstrap_v1` adds nullable learner timezone,
    independent positive revisions, separate native-language authority, exact Profile create replay,
    bounded LearningGoal values, own-read/no-browser-write RLS and loss-aware rollback
  - Exactly five Profile operations implement sole minimal `/v1/me` bootstrap, optional JWT email,
    IANA timezone updates, strong revision ETags, actor-scoped vi→en lifecycle, archive/reactivate
    preservation and PostgreSQL-safe exact idempotency replay
  - Today fails closed before timezone; Brain resolves the native/target pair from authoritative
    `native_language_code`; Brain/Today/Review/Content never bootstrap application identity
  - PostgreSQL 17.11: 188/188 database and 321/321 full backend tests pass; contract/static and
    frozen 313/313 frontend gates pass with no OpenAPI or frontend application behavior change

- `TASK-016`: Starting Level Estimate v1
  - Frozen deterministic `starting-level-heuristic-v1` with persisted 8/12/16-slot A0–B1 flows,
    exact idempotent replay, actor ownership, immutable question/result history and no downstream
    Evidence, Competence, FSRS, Review, Today, Content or Brain mutation
  - Migration `0008`, FastAPI Assessment runtime and PostgreSQL integration suite verified on
    PostgreSQL 17.11; 426/426 full backend and frozen 314/314 frontend tests pass
- `TASK-017`: Live Auth + Onboarding Integration v1
  - Supabase email/password sign-up/sign-in/sign-out and session restoration reuse the existing auth foundation
  - Shared contract-compatible `HttpApiClient` fronts the existing `ApiClient`; `/v1/me`, profile/timezone, vi→en language profile and optional Starting Level flow are live
  - `/auth` is public, application routes are session-protected, and `/today` remains the explicit end boundary with mock data

## In progress

- None (TASK-017 Controlled Hardening implementation complete, pending independent review)

## Blockers

- `TASK-007` remains **BLOCKED** awaiting explicit user authorization to begin Review UI real-transport integration. The canonical frontend authentication and hardened token provider foundation (TASK-006C, TASK-006C.1, TASK-006C.2) are established, but execution must not resume automatically.
- `TASK-009` and `TASK-011` have satisfied dependencies but remain manually blocked until explicit
  Gemini/frontend authorization. TASK-012 satisfies TASK-013 and the Brain portion of TASK-014,
  but TASK-014 is not the recommended next task. TASK-015 retains its stated upstream dependency.

## Verification Status

- `TASK-016` contract/policy/persistence freeze -> **PASSED CLEAN / READY FOR IMPLEMENTATION**:
  OpenAPI Validator passes; Redocly 2.13.0 exits 0 with only the pre-existing Reader discriminator
  warning; 32/32 contract tests pass; openapi-typescript 7.9.1 generation/freshness passes; focused
  Ruff format/lint and all workspace typechecks pass. The separately completed compatibility patch
  reports generated freshness, ESLint, 314/314 Vitest tests across 27 files, Storybook and Next.js
  production build passing with zero skipped/todo tests. Frozen Assessment semantics remain
  unchanged; no frontend/shared application source was edited in this resume turn.
- `TASK-016` runtime/database -> **PASSED CLEAN** on an isolated loopback-only portable PostgreSQL
  17.11 UTC cluster: 43/43 Assessment PostgreSQL tests, 231/231 complete database tests, 195/195
  non-database backend tests, and 426/426 complete backend tests. Empty `0001..0008`, no-op
  reapply, checksum rejection, `0008` down/up, protected rollback, fail-closed legacy preflight,
  start/answer/completion concurrency, exact replay, A0/A1/A2/B1 persisted transitions,
  skip/abandonment, deterministic confidence, snapshot/result immutability, RLS/IDOR, transaction
  atomicity, and Evidence/Today/Content/Memory isolation pass. Required fixes serialize distinct-key
  concurrent starts on the owned profile row and enforce append-only attempt-item snapshots.
- `TASK-016` final static/contract/frontend -> **PASSED CLEAN**: Ruff format/lint across 86 files,
  strict mypy across 86 source files, 32/32 contract tests, OpenAPI Spec Validator OK, generated
  TypeScript freshness, workspace typecheck, zero-warning ESLint, 314/314 frontend tests across 27
  files, Storybook build, and Next.js production build. Redocly 2.13.0 exits 0 with the unchanged
  Reader discriminator warning. OpenAPI and frontend application behavior remain unchanged.
- `TASK-017` implementation verification -> **PASSED CLEAN for new-user path**: OpenAPI Spec Validator,
  Redocly 2.13.0 (one unchanged Reader discriminator warning), 32/32 backend contract tests,
  openapi-typescript freshness, workspace typecheck, zero-warning ESLint, 330/330 frontend tests
  across 30 files, Storybook build, Next.js production build, Ruff, strict mypy and 446/446 backend
  tests all pass. No services, database, migrations, contracts or generated OpenAPI types changed.
  External Supabase/FastAPI smoke credentials are absent from this environment. Archived language
  profile reactivation remains safely gated because the frozen language-list response has no child ETag.
- `TASK-006E` runtime/migration -> **PASSED CLEAN** on PostgreSQL 17.11: 32/32 final Profile API
  tests, 188/188 complete database tests, 133/133 non-database backend tests, and 321/321 complete
  backend tests. Empty 0001..0007 apply, no-op reapply, checksum rejection, 0007 down/up,
  fail-closed legacy preflight/backfill, and protected rollback pass.
- `TASK-006E` static/contract/frontend -> **PASSED CLEAN**: Ruff confirms 76 formatted files and
  zero lint findings; strict mypy reports no issues in 76 source files; OpenAPI Spec Validator 0.9.0,
  26/26 contract tests, and openapi-typescript 7.9.1 freshness pass. Redocly CLI 2.13.0 exits 0 with
  the unchanged Reader discriminator warning. Workspace typecheck, zero-warning ESLint, 313/313
  frontend tests across 27 files, Storybook, and the 14-route Next.js production build pass.
- `TASK-006E` review/diff -> **APPROVED** with no remaining Critical or Required finding. Required
  review fixes added downstream no-bootstrap 404 enforcement, corrected semantically stale
  Reader/Review identity fixtures, and completed the concurrency/boundary/revision test matrix.
  OpenAPI, generated TypeScript, and frontend application behavior were not changed by runtime.
- `TASK-006E` contract compatibility patch -> **PASSED CLEAN**: nullable display name/email/timezone
  are preserved in the shared view model; the adapter no longer derives name from email or creates
  empty/default timezone values; Profile renders `Chưa cung cấp` only as presentation text. Generated
  freshness, all three workspace typechecks, zero-warning ESLint, 313/313 frontend tests across 27
  files, Storybook build, and 14-route Next.js production build pass. `apps/web` changed only at the
  single Profile heading expression; auth, transport, layout, styles, GSAP, design system, backend,
  database, migrations, and OpenAPI are unchanged by this compatibility patch.
- `TASK-006E` contract freeze -> OpenAPI Spec Validator and focused contract suite PASS (26/26);
  OpenAPI TypeScript generation and freshness PASS. Redocly 2.13 validates the contract with one
  pre-existing Reader exposure discriminator warning outside this Profile-only scope.
- `TASK-006E` design preflight -> **PASSED**: all five Profile operations, identity/bootstrap,
  application/language lifecycle, timezone/daily target, derived onboarding readiness, Starting
  Level boundary, ETag/idempotency, authorization/RLS, legacy safety, exact contract/migration gaps,
  A–X test matrix, eight worked journeys, and security failure review are documented. OpenAPI
  remains at 31 operations; no runtime, migration, generated type, frontend, mock, or test changed.
- `TASK-012` runtime static/non-database -> **PASSED CLEAN**: Ruff format confirms 67 files already
  formatted; Ruff lint passes; strict mypy reports no issues in 67 source files; 100/100
  non-PostgreSQL backend tests pass.
- `TASK-012` runtime PostgreSQL/migration/full backend -> **PASSED CLEAN** on an isolated portable
  PostgreSQL 17.11 UTC cluster: 15/15 focused Brain tests, 150/150 complete database tests, 250/250
  full backend tests, and 3/3 focused migration tests pass. Empty `0001..0006`, reproducible
  reapply, `0006` down/up, checksum rejection, protected rollback, repeatable-read concurrency,
  read-only/no-mutation, zero-state non-persistence, ownership-hidden 404, and fixed query bounds
  are verified.
- `TASK-012` runtime contract/database/frontend diff -> OpenAPI, generated TypeScript, migrations,
  and frontend application source are unchanged. Contract-freeze and frozen-frontend evidence below
  remains authoritative; baseline is 308 tests / 27 files.

- `TASK-012` contract freeze -> **PASSED**: OpenAPI Spec Validator 0.9.0 reports
  `contracts/openapi.yaml: OK`; 22/22 focused contract tests and generated TypeScript freshness
  pass. Redocly CLI 2.13.0 exits 0 with the one unchanged TASK-008 Reader discriminator warning.
- `TASK-012` static/backend non-database regression -> **PASSED CLEAN**: Ruff format/lint, strict
  mypy across 58 source files, and 95/95 non-PostgreSQL backend tests pass. The full suite was
  attempted but its 135 PostgreSQL tests could not start because Docker Desktop was unavailable;
  TASK-012 contract freeze contains no database, migration, or backend runtime change.
- `TASK-012` frontend compatibility -> **PASSED CLEAN** through the approved narrow patch:
  generated freshness, TypeScript, ESLint, Storybook, Next production build, and 308/308 tests
  across 27 files pass. `apps/web` source is unchanged and MockApiClient has no business-logic
  change. Gemini/frontend is frozen again at 308 tests / 27 files.

- `TASK-010` backend -> **PASSED CLEAN**: Ruff format/lint, strict mypy across 58 files, 90/90
  non-database tests, 135/135 real PostgreSQL tests, and 225/225 full backend tests.
- `TASK-010` migration -> **PASSED CLEAN** on PostgreSQL 17.11: empty `0001..0006`, no-op reapply,
  `0006` down/up, checksum rejection, protected rollback, ownership/shape/cardinality constraints,
  same-day uniqueness, exact replay, timezone identity, and real concurrent generation.
- `TASK-010` contract -> **PASSED CLEAN**: 18/18 focused OpenAPI/runtime checks, generated
  TypeScript freshness, and Redocly 2.13.0 validation. One unchanged TASK-008 Reader discriminator
  warning remains; OpenAPI changed by zero bytes in TASK-010.
- `TASK-010` frozen frontend -> **PASSED CLEAN**: typecheck/lint, 307/307 tests across 27 files,
  Storybook build, and Next production build. Frontend application source changed by zero files.
- `TASK-010` specification/schema/migration/transaction/security/performance/boundary/code reviews
  -> **PASSED**; evidence is in `reviews/TASK-010-today-engine-heuristic-v1.md`.

- `TASK-008` implementation -> **PASSED**: Ruff format/lint clean; strict mypy clean; 77/77
  non-database tests, 121/121 real PostgreSQL tests and 198/198 full backend tests pass on
  PostgreSQL 17.11. Empty database `0001..0005`, no-op reapply, `0005` down/up, checksum rejection,
  protected rollback and real concurrency all pass.
- `TASK-008` contract/runtime -> **PASSED**: OpenAPI Spec Validator OK, generated TypeScript fresh,
  FastAPI operation metadata and success DTOs conform. Redocly CLI 2.13.0 exits 0 with one warning
  on the unchanged frozen Reader discriminator requesting `defaultMapping`; no OpenAPI change was
  made.
- `TASK-008` frozen frontend regression -> **PASSED**: typecheck, lint, 307/307 tests across 27
  files, Storybook build and production build. No frontend application source changed.
- `TASK-008` spec/schema/migration/transaction/security/performance/boundary reviews -> **PASSED**;
  evidence is recorded in `reviews/TASK-008-reader-content-service-mvp.md`.

- `TASK-008` contract freeze -> **PASSED CLEAN**: OpenAPI Spec Validator and Redocly recommended
  lint accept OpenAPI 3.2; 17 / 17 focused contract invariants pass; TypeScript generation
  freshness passes.
- `TASK-008` static/backend non-database regression -> **PASSED CLEAN**: Ruff format/lint, strict
  mypy across 33 source files, and 77 non-PostgreSQL tests pass. The unchanged 84 PostgreSQL tests
  could not start because Docker Desktop was unavailable; this phase contains no schema, migration,
  database runtime, or backend runtime change.
- `TASK-008` frozen frontend regression -> **PASSED CLEAN**: typecheck, lint, 307 / 307 tests across
  27 files, Storybook build, and production build. No frontend application source was modified.

- `TASK-006D` backend checks -> **PASSED CLEAN** (Ruff format/lint, strict mypy across 33 source
  files, 158 / 158 backend tests)
- `TASK-006D` PostgreSQL checks -> **PASSED CLEAN** (migration empty/down/up/re-apply, append-only
  constraints, atomic rollback/retry, full rebuild equality and concurrent no-lost-update)
- `TASK-006D` specification/schema/migration/transaction/boundary/code-quality reviews ->
  **PASSED**, no required finding open
- `TASK-006D` public boundaries -> **ZERO OpenAPI change and ZERO frontend source change**;
  generated contract freshness passes
- `TASK-006C.2` frontend authentication tests -> **PASSED CLEAN** (20 / 20 auth invariant tests)
- `pnpm typecheck` -> **PASSED CLEAN** (generated OpenAPI freshness plus 0 TypeScript errors across all 3 workspace packages)
- `pnpm lint` -> **PASSED CLEAN** (0 ESLint warnings/errors)
- `pnpm test` -> **PASSED CLEAN** (307 / 307 tests passed across all 27 test files)
- `pnpm build-storybook` -> **PASSED CLEAN** (Storybook static catalog compiled successfully)
- `pnpm build` -> **PASSED CLEAN** (Next.js production build succeeded with static generation for all 14 routes + Next.js Middleware)



- OpenAPI Spec Validator 0.9.0 and Redocly recommended lint -> **PASSED CLEAN** (OpenAPI 3.2,
  zero warnings, all local references resolved)
- TypeScript client generation and static API documentation smoke -> **PASSED**
- Clean backend development lock install -> **PASSED**, exact 52-package environment match,
  including `fsrs==6.3.2` and `PyJWT[crypto]==2.13.0`; `pip check` reports no broken requirements
- TASK-004 contract tests -> **PASSED CLEAN** (13 / 13 invariants)
- Backend checks -> **PASSED CLEAN** (Ruff format/lint, strict mypy, 71 / 71 backend tests)
- PostgreSQL schema/Memory Engine verification -> **PASSED CLEAN** (38 / 38 DB integration tests
  against PostgreSQL 17.11, including rollback and real concurrent submissions)
- Empty application-schema migration through `0003`, deterministic FSRS seed, idempotent re-apply,
  rollback/re-apply and checksum rejection -> **PASSED**
- Database spec/schema/migration/ownership reviews -> **PASSED**, no required findings open
- Runtime smoke check `GET http://127.0.0.1:8765/health` -> **200 OK** with expected service/status/version payload
- `python -m pip check` -> **PASSED CLEAN** (no broken requirements)
- `pnpm typecheck` -> **PASSED CLEAN** (generated OpenAPI freshness plus 0 TypeScript errors across workspace)
- `pnpm lint` -> **PASSED CLEAN** (0 ESLint warnings/errors)
- `pnpm test` -> **PASSED CLEAN** (287 / 287 tests passed across all 26 test files after the
  pre-TASK-006 regression audit; 42 historical tests remain intentionally removed because they
  enforced provisional DTOs or frontend-owned backend algorithms)
- `pnpm build-storybook` -> **PASSED** (Storybook static catalog compiled successfully; existing
  dependency/sourcemap/chunk warnings remain non-failing)
- `pnpm build` -> **PASSED** (Next.js production build succeeded with static generation for all 14 routes)
- TASK-005 contract, frontend architecture, boundary, regression and code-quality reviews ->
  **PASSED**, no required findings open and no contract defect found
- Pre-TASK-006 test-suite regression audit -> **PASSED**; the original 54-test drop was traced to
  two overwritten files, all 29 meaningful lost coverage areas were restored in consolidated form,
  and all 42 intentionally obsolete removals have explicit justification in
  `reviews/TEST-SUITE-REGRESSION-AUDIT.md`
- Pre-TASK-006 regression-audit scope boundary -> **ZERO SOURCE MODIFICATIONS** under `services/**`,
  `database/**`, `contracts/**`, `packages/ui/src/**`, `design-system/**`, or the stable GSAP motion
  implementation during that audit
- TASK-006 FSRS/domain, transaction/concurrency, schema-integrity, contract-boundary and regression
  reviews -> **PASSED**, no required finding open and no contract defect found
- TASK-006A backend suite -> **PASSED CLEAN** (105 / 105, including real PostgreSQL historical
  replay and same-key same/different-lineage concurrency)
- TASK-006A Review/OpenAPI focused checks -> **PASSED CLEAN** (15 / 15), with success/error payload
  schema validation and FastAPI operation conformance
- TASK-006A specification, architecture, security/privacy, code-quality, migration, boundary and
  regression reviews -> **PASSED**; its recorded non-lexical `partOfSpeech` limitation is resolved
  by TASK-006B
- TASK-006B OpenAPI/Redocly/generated-type checks -> **PASSED CLEAN**; `ConceptSummary` and
  `ConceptDetail` are optional/nullable and all affected `$ref` consumers are consistent
- TASK-006B backend checks -> **PASSED CLEAN** (Ruff format/lint, strict mypy, 41 / 41 non-database
  tests and 66 / 66 real-PostgreSQL database tests)
- TASK-006B frontend/architecture/boundary/regression reviews -> **PASSED**; 287 / 287 tests,
  Storybook and production build passed with no required findings or unresolved schema decision

## Current architecture state

- `TASK-008A` Dictionary and Reader Analyze API v1 -> **DONE**: exact deterministic dictionary
  lookup, concept detail, opaque cursor pagination, and side-effect-free Reader Analyze are
  implemented with provenance and actor ownership enforcement. Real PostgreSQL backend suite:
  446 passed. OpenAPI validation and generated TypeScript freshness passed; Redocly 2.13.0 passed
  with the existing Reader discriminator default-mapping warning. Frontend remained frozen at
  314 tests across 27 files; typecheck, lint, Storybook and production build passed.

- Backend foundation, PostgreSQL schema v1, Memory/Competence engines, five Profile operations, two
  Review operations, five TASK-008 Content/Reader operations, two Today operations, and three
  TASK-012 Brain read operations are implemented, dependency-locked, and PostgreSQL verified.
  Remaining product endpoints stay unimplemented and `contracts/openapi.yaml` remains authoritative.
- Memory transitions use FSRS-6 through py-fsrs 6.3.2 with immutable parameter lineage, one
  learner/concept schedule, actor-scoped transactional persistence and a due-query boundary.
- PostgreSQL remains the sole persistence/graph layer. Learner competence projections are
  separate from the unique learner-concept FSRS lineage. Canonical `learning_events` are append-only
  replay authority; concept and language-profile projections are rebuildable.
- Review queue competence is loaded per concept from `user_concept_states`; a missing/unversioned
  row is a synthetic zero-evidence read and never causes GET-side persistence.
- Imported/curated lexical, content and assessment records trace through source record, source,
  license/attribution, checksum, transform version and review status.
- User-owned database tables use direct ownership keys and Supabase-compatible default-deny RLS.
- Operational health behavior is intentionally outside the versioned public product contract.
- Frontend transport architecture is generated DTOs -> `ApiClient`/`MockApiClient` -> pure adapters
  -> UI view models -> components; no backend business algorithm is computed on the client.
- Concept POS is lexical metadata, not a universal concept property: transport values may be
  omitted/null, and non-lexical grammar/skill presentations do not invent a fallback.
- 3-tier token architecture: Primitive -> Semantic -> Component tokens.
- Design tokens enforce WCAG 2.2 AA contrast, reduced motion, and non-color-only state indicators.
- Contract mocks return deterministic OpenAPI-conforming response DTOs with optional latency/error
  injection; no nonexistent HTTP endpoint is called. The future HTTP transport remains an explicit
  interface boundary only.

## Next

- TASK-008A is DONE. Do not start another task without explicit authorization.
- TASK-017 hardening in progress across Slices A–D (C-1 through C-6).
- TASK-017A is DONE and verified (458/458 backend, 338/338 frontend).
- Keep TASK-007 blocked and the Gemini-owned frontend surface outside this bounded integration frozen.
- Reader resume position, synchronized preferences, saved-sentence notes, configurable learner
  new-concept budget, data export and account deletion remain future schema/contract decisions.
