# LINGUA OS private staging deployment

This document describes the repository-level preparation for the frozen
topology:

```text
Browser → Vercel Next.js → same-origin /api/* → Render FastAPI → Supabase
```

It does not provision hosts, configure a Supabase project, run migrations or
deploy. FRLL remains the accepted, frozen regression baseline.

## Frontend (Vercel)

- Root Directory: `apps/web`.
- Package manager: pnpm `11.22.0` from the root `package.json`.
- Install: `pnpm install --frozen-lockfile`.
- Build: `pnpm build` from `apps/web`, or
  `pnpm --filter @lingua/web build` from the repository root.
- Runtime output: the default Next.js `.next` output; do not enable static
  export.

Required browser-safe build variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the code also accepts the
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` fallback)
- `NEXT_PUBLIC_API_BASE_URL=/api` (exactly; hosted configuration rejects a
  direct or absolute backend origin)

The backend origin is server-only:

- `API_INTERNAL_URL` — absolute `http(s)` origin of the Render FastAPI service;
  never prefix it with `NEXT_PUBLIC_`.

Hosted builds fail closed when the public API/Supabase configuration is
missing or when the public API base is not the same-origin `/api` boundary.
Development and tests may explicitly inject the deterministic mock client.

## API proxy

`apps/web/src/app/api/[...path]/route.ts` is the production server-side
boundary. A request to `/api/v1/...` is forwarded to the configured origin as
`/v1/...`. It preserves method, query, body, status, body bytes and relevant
headers, including `Authorization`, `If-Match`, `Idempotency-Key`, `ETag` and
`Cache-Control`. Missing or invalid `API_INTERNAL_URL` returns a generic 503;
the backend origin is not returned to the browser.

The Playwright-only `tests/acceptance/support/same_origin_proxy.ts` is not a
production component.

## Backend (Render)

The committed `render.yaml` is intentionally minimal and contains no values.
Configure Python 3.12 in the Render service and use:

```text
Build:  python -m pip install -r requirements/backend.lock
Start: python -m uvicorn --app-dir services/api/src lingua_api.main:app --host 0.0.0.0 --port $PORT
Health: /health
```

Required Render runtime variable names:

- `DATABASE_URL`
- `SUPABASE_URL`
- `REVIEW_CURSOR_SECRET`

`SUPABASE_SECRET_KEY` and publishable/admin variables are not required by the
FastAPI web process; keep them out of the service unless a separately
controlled acceptance/admin job needs them.

## Supabase hosted Auth

Configure these later in the staging Supabase dashboard, using exact hosted
URLs and no wildcard redirects:

- Site URL: `https://<staging-domain>/auth` (or the hosted root only if the
  redirect is verified to land on `/auth`).
- Allowed redirect URLs: the exact staging `/auth` URL and, if needed, the
  exact root URL. Add individual preview URLs only when deliberately tested.
- Email confirmation is enabled in the current project settings; verify the
  confirmation email and final redirect manually.

There is currently no `/auth/callback`, password-recovery method or recovery
exchange flow. Do not configure a callback path that the application does not
implement, and do not claim recovery readiness from this task.

## Database and migrations

Supabase PostgreSQL remains the system of record. Apply migrations manually
after a verified staging backup:

```text
pnpm db:migrate
```

Verify `schema_migrations` contains `0001` through `0013`, RLS policies are
present and a second run is a no-op. Never run migrations from API startup and
do not use destructive down migrations for hosted learner data. Require TLS
for the runtime/admin connection (`sslmode=require` or the platform-equivalent
setting).

The hosted staging baseline already contains `0010`–`0012`; apply the additive
`0013` migration through the reviewed migration path. Do not rewrite an applied
migration file to repair its checksum.

## First-deploy smoke and rollback

1. Deploy Render and verify `/health`.
2. With a real Supabase session, verify authenticated `/v1/me` through the
   backend.
3. Deploy Vercel and verify `/auth` renders the real form.
4. Verify `/api/v1/me`, onboarding, Today, Review, Brain and Dictionary.
5. Record that Reader, Progress and Library remain fixture/backlog-dependent
   until their live tasks are accepted.
6. Check refresh/reopen, mobile, empty/loading/error and actor isolation.
7. Roll back by promoting the previous Vercel/Render deployment. Restore or
   issue a corrective forward migration for data incidents; do not down-migrate
   production data.

No deployment is authorized by this document alone.
