# TASK-006E — Profile / Language Profile API & Auth Bootstrap v1

Current phase: **DONE — VERIFIED**

Implementation approval: 2026-09-01

Completion: 2026-09-02. Migration 0007, exactly five Profile operations, sole minimal bootstrap,
nullable IANA timezone lifecycle, revision-backed ETags, exact create replay, lifetime vi→en
profile lifecycle, downstream no-bootstrap, and RLS/security boundaries are implemented. Final
verification: Ruff/mypy clean, 133 non-database tests, 188 PostgreSQL tests, 321 full backend tests,
26 contract tests, generated freshness, Redocly exit 0, and frozen frontend 313/313 across 27 files
with Storybook and production builds passing. Review records no remaining Critical or Required
finding.

## Runtime implementation slices

1. Add migration `0007` with fail-closed legacy preflight, nullable timezone, independent
   revisions, separate native-language authority, exact goal constraint, Profile-only replay
   persistence, protected rollback, and own-read/no-browser-write RLS.
2. Extend the existing verified actor with an optional syntactically valid token email without
   persisting it or adding a second auth flow.
3. Implement `GET /v1/me` as the sole minimal race-safe bootstrap transaction, then implement its
   revision-backed PATCH.
4. Implement list/create/update Language Profile operations with actor scoping, strong ETags,
   exact create replay, lifetime target uniqueness, and archive/reactivate semantics.
5. Make Today fail closed on null timezone and move Brain pair resolution to
   `native_language_code`.
6. Verify focused unit tests after each slice, then real-PostgreSQL migration/API/race/RLS tests,
   the full backend/contract gates, and the frozen 313-test/27-file frontend gates.

## Implementation preflight result

Passed on 2026-09-01: the legacy interface-language column is still present and unrenamed;
timezone is still non-null with a geographic default; revisions and native-language authority are
absent; no generic reusable idempotency table exists; existing identity/profile RLS remains
own-select only with no authenticated browser writes; and OpenAPI still contains exactly the five
approved Profile operations. No contract defect or task-boundary conflict was found.

## Objective

Freeze the identity, bootstrap, application-profile, language-profile, onboarding-readiness,
optimistic-concurrency, idempotency, authorization, and RLS boundaries before TASK-006E runtime
implementation.

## Design-turn scope

- Audit the current Supabase JWT, `auth.users`, `public.users`, `learner_profiles`, and
  `user_languages` architecture.
- Audit all five existing Profile OpenAPI operations and their frontend boundary.
- Produce `docs/PROFILE_LANGUAGE_AUTH_BOOTSTRAP_V1.md`.
- Record the durable choice as a proposed ADR.
- Move TASK-006E to DESIGN / AWAITING APPROVAL.

## Explicit non-scope

- No runtime, route, migration, OpenAPI, generated TypeScript, frontend, mock, or test change.
- No login-method choice or login UI.
- No Starting Level, Dictionary, Library, Progress, Today, FSRS, competence, AI, speech, or CJK
  implementation.
- No automatic language-profile creation and no direct browser mutation of product tables.

## Approved contract-freeze increment

1. Re-audit the historical meaning of `user_languages.interface_language_code`; preserve it when
   native-language equivalence cannot be proven and freeze a separate native-language authority.
2. Freeze `/v1/me` bootstrap/cache semantics, downstream no-bootstrap behavior, email authority,
   language-profile lifetime/archive rules, timezone/readiness behavior, ETags, revisions, and
   language-create idempotency.
3. Add contract tests first, then make only the required OpenAPI amendments and regenerate the
   authoritative TypeScript declarations.
4. Run OpenAPI validation, Redocly, contract tests, generation freshness, and frontend typecheck.
   If generated nullability breaks frozen frontend code, stop and report the exact compatibility
   boundary without modifying frontend source or weakening the contract.
5. Record the exact future `0007` persistence/RLS/rollback shape. Do not create the migration or
   runtime in this phase.

## Files allowed in this phase

- `docs/PROFILE_LANGUAGE_AUTH_BOOTSTRAP_V1.md`
- `plans/TASK-006E-profile-language-auth-bootstrap-v1.md`
- `DECISIONS.md`, `TASKS.md`, `STATUS.md`, `CONTEXT.md`
- `contracts/openapi.yaml`
- `packages/types/src/generated/openapi.ts` (generated output only)
- `tests/backend/contracts/test_openapi_v1.py`

No migration, backend runtime, frontend application/mock/adapter, UI, GSAP, or design-system file
is authorized.

## Proposed implementation slices after contract/migration approval

1. Freeze the narrow OpenAPI correction and regenerate contract artifacts.
2. Add migration `0007` for nullable learner timezone, profile revisions, native-language naming,
   profile-create idempotency results, and the existing LearningGoal database constraint.
3. Extend the verified actor boundary with optional auth-owned email, without persisting auth
   credentials or choosing a login method.
4. Implement the central `GET /v1/me` application-identity bootstrap transaction.
5. Implement the remaining four Profile operations with actor ownership, IANA timezone validation,
   ETags, exact create replay, and existence-hiding behavior.
6. Add unit, contract, real-PostgreSQL, race, RLS, migration, and downstream-compatibility tests.
7. Run repository quality gates, reviews, and only then mark TASK-006E DONE.

## Acceptance gates for this contract-freeze turn

- Every requested lifecycle/security question has an explicit proposed answer.
- The future database shape is exact and bounded; migration history is unchanged.
- The OpenAPI amendment validates and its generated declaration is fresh.
- Frontend application source remains unchanged; any generated-type compatibility break is
  reported rather than patched in this phase.
- The frontend remains frozen at 308 tests / 27 files.
- TASK-006E remains unimplemented and awaits migration/runtime approval.

## Main risks for implementation

- A valid Supabase identity may not have an email; the current non-null wire field is too strict.
- Geographic timezone defaults can create the wrong learner-local day.
- A composite `/v1/me` representation requires its parent revision to change with nested language
  profiles.
- The creation Idempotency-Key must replay the original result and reject payload reuse, not merely
  rely on target-language uniqueness.
- Existing test fixtures contain product rows without a learner profile and one non-contract goal;
  migration preflight must identify and deliberately reconcile them.
