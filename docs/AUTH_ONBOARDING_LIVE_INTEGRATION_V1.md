# TASK-017 — Live Auth + Onboarding Integration v1

## Scope

TASK-017 connects the first authenticated learner journey to the frozen FastAPI
contract. The journey ends at `/today`; Today, Review, Reader, Brain, Progress,
Library and Dictionary remain mock-driven until their owning tasks.

The identity authority is Supabase Auth with email/password only. Supabase is
used by the browser for session/authentication state; all product data reads and
writes go through the shared `ApiClient` boundary.

## Runtime path

```text
Supabase email/password
  -> AuthProvider / AuthTokenProvider
  -> HttpApiClient
  -> GET /v1/me
  -> learner profile (explicit timezone confirmation)
  -> active vi -> en language profile
  -> optional Starting Level assessment
  -> /today (still mock-driven)
```

`GET /v1/me` is the only application bootstrap operation. The client does not
create application users, learner profiles, or language profiles in Supabase.
Readiness is derived from returned profile state; no `onboardingComplete`
boolean is persisted.

## Auth and route boundary

`AuthProvider` reuses the existing Supabase browser client, session listener,
sign-out behavior and token provider. `AuthEntry` supports sign-up and sign-in,
including the legitimate email-confirmation state where sign-up returns no
session. `AppRouteBoundary` keeps `/auth` public and protects application routes
after session restoration; redirects wait for a definitive auth state to avoid
hydration and auth/onboarding loops.

## HTTP transport

`packages/types/src/client.ts` now contains the contract-compatible
`HttpApiClient` implementing the existing `ApiClient` interface. It owns base URL
joining, bearer authorization, JSON envelopes, safe typed errors, request IDs,
Retry-After, ETag capture and exact forwarding of `If-Match` and
`Idempotency-Key`. It never retries or creates keys. Logical action keys are held
by the onboarding flow and reused for an ambiguous retry.

`apps/web/src/lib/api/client.ts` selects `HttpApiClient` only when both
`NEXT_PUBLIC_API_BASE_URL` and a configured Supabase browser client are present;
otherwise the deterministic `MockApiClient` remains available for local UI,
Storybook and tests. No endpoint URL or secret is hardcoded.

## Onboarding semantics

- The browser timezone is only an editable suggestion. It is persisted only
  after an explicit profile PATCH with the actual strong `/me` ETag in
  `If-Match`.
- `PRECONDITION_FAILED` refetches authoritative state and requires a new
  intentional mutation; it never silently overwrites a stale profile.
- Language creation sends canonical `vi`, `en`, approved `LearningGoal` values,
  and a bounded `dailyMinutes` value with one stable idempotency key.
- An active vi→en profile is reused. If the only matching row is archived, the
  flow never creates a duplicate; it offers reactivation only when a matching
  child ETag has been supplied by the transport. The current frozen list
  response does not declare a child ETag, so the safe UI blocks rather than
  guessing with the `/me` ETag. This is a contract follow-up for a future
  backend/contract task, not a reason to weaken concurrency control.
- Starting Level uses only the three frozen operations. Start handles both 201
  new and 200 resume responses; answers use backend-returned `currentItem` and
  status. The frontend never computes score, confidence, level, mastery,
  scheduling or placement.
- Skip and abandoned/no-result states never synthesize A0. A completed result is
  displayed as a Starting Level Estimate and no retake action is offered.

## Error and security behavior

Machine-readable API errors are converted through the existing Vietnamese UI
registry; raw database/provider text is not rendered. Missing session and token
provider infrastructure failure remain distinct typed failures. A 401 is not
treated as proof that local auth state should be destroyed. Passwords are sent
only to Supabase Auth, never logged or persisted by the application.

## Verification

TASK-017 added focused HTTP, auth/onboarding, archived-profile boundary and
anti-algorithm tests. The frontend regression floor remains intact and the exact
results are recorded in `reviews/TASK-017-auth-onboarding-live-integration-v1.md`;
the final workspace run is 330 tests across 30 files.
