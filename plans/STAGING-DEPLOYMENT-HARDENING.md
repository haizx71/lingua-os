# Private staging deployment hardening

## Objective

Remove the repository-level blockers for the frozen topology:

Browser → Next.js origin → `/api/*` → hosted FastAPI → Supabase.

FRLL, contracts, database migrations and learner-state semantics remain
unchanged. The deployment boundary must fail closed when its server-only
upstream or live browser configuration is missing.

## Scope and affected files

- `apps/web/src/app/api/[...path]/route.ts`: production server-side API proxy.
- `apps/web/src/lib/api/client.ts`: fail-closed hosted configuration check.
- `tests/frontend/staging-api-proxy.test.ts`: proxy method/header/body/status tests.
- `tests/frontend/staging-api-client.test.ts`: hosted configuration selection tests.
- `render.yaml`: minimal Render web-service configuration without secrets.
- `.gitignore`: ignore staging/production env variants.
- `docs/PRIVATE_STAGING_DEPLOYMENT.md`: operator setup, environment names and
  Supabase hosted-auth requirements.
- `TASKS.md`, `STATUS.md`: record implementation state and verification only.

No changes are planned under `contracts/`, `services/`, `database/`, or the
accepted FRLL evidence.

## Implementation steps

1. Add focused red tests for server-side forwarding and fail-closed selection.
2. Implement the dynamic Node.js route handler using only `API_INTERNAL_URL`
   server-side; strip the `/api` route segment by construction.
3. Make `getApiClient()` throw a typed configuration error in production,
   staging, or Next production runtime when the public live configuration is
   incomplete; preserve explicit injected mocks for tests/development.
4. Add the minimal Render manifest and operator documentation.
5. Add env-file ignore patterns without ignoring `.env.example`.
6. Run focused tests, frontend gates, contract freshness, build and diff checks.
7. Review specification compliance, code quality, ownership boundaries and
   zero drift in contracts/services/database.

## Acceptance checks

- `/api/v1/...` forwards to the configured backend without the `/api` prefix.
- GET/POST/PUT/PATCH/DELETE preserve method, query, body and required request
  headers (`Authorization`, `If-Match`, `Idempotency-Key`).
- Upstream status, body, `ETag` and `Cache-Control` are preserved.
- Missing or invalid `API_INTERNAL_URL` returns a generic contract-shaped 503
  and never calls an upstream.
- Hosted frontend configuration cannot silently select `MockApiClient`.
- Hosted frontend configuration requires the exact same-origin `/api` base and
  rejects direct browser-to-backend origins.
- Development/test callers may explicitly inject a mock client.
- Render start command binds `0.0.0.0` and `$PORT`, with `/health` check.
- No secret value is added to tracked files; `.env.example` remains visible.
- `contracts/`, `services/`, `database/` and FRLL behavior remain unchanged.

## Risks and follow-up

- Supabase Site URL and redirect allowlists are dashboard configuration and are
  intentionally not changed here.
- `API_INTERNAL_URL` must be configured in the Next/Vercel server environment;
  it is never a `NEXT_PUBLIC_*` variable.
- Reader/Progress/Library live integrations and password recovery remain
  separate pilot-readiness work.
