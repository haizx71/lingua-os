# TASK-007 — Review UI real-API integration

Status: BLOCKED before implementation

## Objective

Connect the existing Review UI to the authoritative Review queue and answer operations through the
existing `ApiClient` boundary, while preserving the current UI, motion, accessibility, and
backend-owned learning behavior.

## Authorized scope

- `apps/web/**`
- `packages/types/**`
- `tests/frontend/**`
- frontend transport configuration

No backend, database, contract, design-system, FSRS, or motion-system changes are authorized.

## Mandatory authentication gate

TASK-007 requires the browser to obtain a Supabase Auth access token from an approved existing
frontend session provider and pass it to `HttpApiClient` as a Bearer token. The repository audit
found no such provider:

- `apps/web/package.json` has no Supabase/auth client dependency;
- `apps/web/src/**` has no auth/session provider, access-token source, or token bridge;
- the root layout has no authenticated-session provider;
- `.env.example` exposes no approved public Supabase client configuration; and
- the current process has no `NEXT_PUBLIC_*`, `SUPABASE_*`, or `LINGUA_*` environment variables.

Creating a second auth architecture, reading an arbitrary token from browser storage, or embedding
a development JWT is explicitly prohibited by TASK-007. Therefore implementation stopped before
tests or production source changes.

## Resume condition

Resume this plan only after an approved frontend authentication foundation provides a canonical,
testable Supabase session/access-token source. Then execute the original task in bounded slices:

1. Add contract-shaped Review-only HTTP transport tests and implementation.
2. Add queue/answer response adapters and server-result view models.
3. Integrate Review orchestration through dependency injection without mock/real component branches.
4. Verify idempotency-key reuse, opaque cursors, cancellation, error mapping, keyboard/a11y, and
   reduced-motion regressions.
5. Run all frontend quality gates and an authenticated smoke test when legitimate credentials exist.

## Verification at this stop point

Read-only source, dependency, configuration, and environment-name searches confirmed the missing
auth boundary. No frontend source, generated type, contract, backend, database, design-system, or
test file was changed, so the previously verified 287-test baseline remains the last executed
frontend evidence rather than a newly claimed TASK-007 result.
