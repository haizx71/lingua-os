# TASK-017 — Live Auth + Onboarding Integration v1

## Scope

Connect the existing Supabase email/password foundation to the authoritative FastAPI profile,
language-profile, and Starting Level contracts. `/today` remains mock-driven and is only the final
navigation target. Review, Reader, Brain, Progress, and Library remain mock-driven.

## Architecture

- `HttpApiClient` is the shared typed transport and obtains Bearer tokens only through the existing
  `AuthTokenProvider`.
- Auth UI uses the existing Supabase browser client; no product-table Supabase access is added.
- Onboarding derives readiness from `/v1/me` and `/v1/me/languages`; no persisted completion flag is
  introduced.
- Assessment state is always rendered from backend-shaped responses. The client does not score or
  infer a level.

## Implementation slices

1. Add failing transport tests, then implement typed HTTP request/error/header handling and all
   existing `ApiClient` operations.
2. Add failing auth-entry/session tests, then implement email/password sign-up/sign-in/sign-out
   flow while preserving the existing AuthProvider semantics.
3. Add failing bootstrap/onboarding tests, then implement `/v1/me`, timezone/profile update,
   vi-to-en language-profile create/list, and derived readiness.
4. Add failing assessment flow tests, then implement start/resume, answer/skip, refresh recovery,
   result presentation, and navigation to `/today`.
5. Review security, transport boundaries, mock/live parity and route protection; run all repository
   gates and document remaining mock surfaces and external-auth availability.

## Acceptance checks

- No direct product `fetch`, axios, or Supabase table query exists outside the shared transport.
- Missing session and token-provider infrastructure failures remain distinguishable.
- Mutations forward caller-provided `If-Match`/`Idempotency-Key` unchanged; no automatic new key or
  stale-ETag retry is generated.
- Email-confirmation signup with no immediate session does not call `/v1/me`.
- Profile timezone is explicitly confirmed, language creation is canonical `vi` → `en`, and daily
  minutes remains 5..180.
- Assessment current item, lifecycle and result come only from the API response; skipping produces
  no fake A0 and completed sessions expose no retake action.
- `/today` is the final target and continues using existing mock data.
- Frontend baseline does not decrease from 314 tests / 27 files; typecheck, lint, Storybook and
  production build pass.

## Known limits

Real Supabase smoke testing is only performed when safe local credentials are available. No
backend, database, migration, OpenAPI, generated-contract or unrelated product-surface changes are
authorized by this task.
