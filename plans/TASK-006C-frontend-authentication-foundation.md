# TASK-006C — Frontend Authentication Foundation

## Objective

Establish the canonical, testable Supabase Auth foundation for the Next.js App Router frontend required to supply genuine Bearer access tokens to HttpApiClient for authenticated FastAPI requests.

## Scope & Non-Negotiable Boundaries

- Allowed: apps/web/**, packages/types/** (transport/auth token provider interfaces), tests/frontend/**, .env.example, TASKS.md, STATUS.md, plans/**.
- Prohibited:
  - Do NOT modify services/**, database/**, contracts/**.
  - Do NOT modify FSRS or Memory Engine.
  - Do NOT modify Review backend adapter.
  - Do NOT invent or hardcode a login method (report LOGIN METHOD DECISION REQUIRED).
  - Do NOT create direct browser access to product database tables (FastAPI remains authoritative).
  - Do NOT create custom JWTs, fabricate user IDs, or decode JWTs client-side for authorization.
  - Do NOT start TASK-007 automatically.

## Architecture

Browser / Next.js
  ├── Supabase Auth SDK (@supabase/ssr, @supabase/supabase-js)
  │     ├── createBrowserSupabaseClient() [singleton browser client]
  │     └── createServerSupabaseClient() [cookie-aware server client]
  ├── AuthProvider & useAuth() [React session state: loading | authenticated | unauthenticated]
  ├── AuthTokenProvider [getAccessToken(): Promise<string | null>]
  │     └── delegates to supabase.auth.getSession() (auto-refreshing)
  └── HttpApiClient (transport layer in packages/types)
        └── calls AuthTokenProvider.getAccessToken() -> Bearer <JWT> -> FastAPI /api/v1/*

## Implementation Slices

1. packages/types Transport Abstraction:
   - packages/types/src/auth.ts: Define AuthTokenProvider, AuthTokenProviderFn, AuthStateKind, AuthUserIdentity, AuthSessionState.
   - Re-export in packages/types/src/index.ts.
   - Update packages/types/src/client.ts to support AuthTokenProvider on HTTP transport options.

2. Supabase Client & Config Layer:
   - apps/web/src/lib/supabase/config.ts: Safe environment resolver (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) with explicit guard rejecting service-role/private secrets.
   - apps/web/src/lib/supabase/client.ts: createBrowserSupabaseClient() with @supabase/ssr.
   - apps/web/src/lib/supabase/server.ts: createServerSupabaseClient() with @supabase/ssr + Next.js cookies().
   - apps/web/src/lib/supabase/token-provider.ts: createSupabaseAuthTokenProvider() implementing AuthTokenProvider.

3. React Auth Context & Route Protection:
   - apps/web/src/features/auth/AuthContext.tsx: AuthProvider, useAuth() hook managing lifecycle (loading, authenticated, unauthenticated), session subscriptions (onAuthStateChange), and signOut.
   - apps/web/src/features/auth/ProtectedRoute.tsx: Minimal protected boundary showing loading state during bootstrap (avoiding redirect loops) and unauthenticated state without hardcoding unapproved login flows.
   - Wrap AuthProvider in apps/web/src/app/layout.tsx.

4. Environment & Configuration:
   - Update .env.example with public frontend placeholders.

5. Test Suite:
   - tests/frontend/auth.test.tsx: Comprehensive verification of all 18 invariant requirements.

6. Quality Gates & Task Tracking:
   - Update TASKS.md (add TASK-006C as DONE, update TASK-007 dependencies).
   - Update STATUS.md.
   - Run typecheck, lint, test, build-storybook, and build.
