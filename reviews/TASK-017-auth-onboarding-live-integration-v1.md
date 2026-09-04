# TASK-017 — Live Auth + Onboarding Integration v1 Review

Date: 2026-09-03

## Scope review

Implemented the first real new-user path only: Supabase email/password auth,
session restoration, shared HTTP transport, `/v1/me` bootstrap, explicit
timezone/profile completion, vi→en language profile creation, optional Starting
Level start/resume/answer, and navigation to `/today`. Today and all later
product surfaces remain mock-driven. No services, database, migrations,
OpenAPI contracts or frontend motion/design-system files were changed.

## Architecture and security review

- Existing Supabase browser client, AuthProvider, AuthTokenProvider,
  ProtectedRoute and middleware foundation are reused.
- Product transport is centralized in `HttpApiClient`; feature code does not call
  `fetch` or Supabase product tables directly.
- Actor identity comes from the authenticated session; no UI `userId` is sent.
- Auth infrastructure failures are distinct from a missing session.
- Profile writes require the actual strong ETag and `If-Match`; stale 412 state is
  refetched without an automatic overwrite.
- Language creation and assessment mutations use stable UUID idempotency keys;
  rapid duplicate submission is serialized by the busy state.
- Assessment state/result is server-owned; no scoring, placement, FSRS or Today
  logic exists in the frontend.
- Sign-up without an immediate session is treated as email confirmation, with no
  premature `/v1/me` call.

## Contract gap

`PATCH /v1/me/languages/{languageProfileId}` requires a strong child ETag, while
`GET /v1/me/languages` declares no ETag response header and exposes no per-row
revision. Therefore an archived profile returned by the list cannot be safely
reactivated by a contract-compliant browser without a future contract/backend
change. TASK-017 deliberately refuses to create a duplicate or reuse the
learner-profile ETag. This is the sole remaining integration blocker for the
archived-returning-learner edge case; new-user onboarding is unaffected.

## Tests added

- `tests/frontend/http-client.test.ts`: six tests for auth header, missing vs
  infrastructure session failure, error envelope/request ID, ETag/If-Match,
  idempotency-key replay forwarding and malformed/network failures.
- `tests/frontend/task017-live-onboarding.test.tsx`: six tests for sign-in,
  email-confirmation sign-up, skip-to-Today, backend-shaped assessment
  completion and refresh/resume from a server-session pointer.
- `tests/frontend/task017-boundaries.test.ts`: four tests for transport
  boundaries, anti-scoring/anti-Today logic, strict idempotent submissions and
  DTO-to-view-model mapping.

## Verification evidence

Focused TASK-017 tests: 16/16 pass.

Workspace frontend Vitest after implementation: 330 tests across 30 files pass
(baseline before TASK-017: 314 tests across 27 files; no tests were removed or
skipped). `pnpm typecheck` (including OpenAPI freshness), `pnpm lint`,
`pnpm build-storybook` and `pnpm build` pass. The Storybook run retains existing
module-directive/eval/chunk-size warnings; Next retains the existing missing
ESLint-plugin warning. Ruff format/lint, strict mypy and the complete backend
suite pass: 446/446 tests, including 32/32 contract tests. OpenAPI Spec Validator
reports `contracts/openapi.yaml: OK`; Redocly 2.13.0 exits 0 with its one
unchanged Reader discriminator warning. No external Supabase/FastAPI credentials
are present, so a real-auth smoke test was not attempted.

## Verdict

All required deterministic quality gates pass for the approved new-user path.
The task remains **BLOCKED overall** until the frozen contract supplies a safe
child ETag path for archived language-profile reactivation (or explicitly
removes that onboarding requirement). No concurrency guarantee was weakened.
