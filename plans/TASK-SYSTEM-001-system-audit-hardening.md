# TASK-SYSTEM-001 — System Audit & Production Hardening

Date: 2026-09-15
Owner: Codex
Branch: `codex/system-audit-hardening-2026-09-15`
Base: `561bbc27e10b4d44637d5c14a6ce00d3514522ea`

## Goal

Audit LINGUA OS end-to-end and close high-confidence production gaps without reopening accepted FRLL or changing authoritative learning semantics.

## Non-negotiable invariants

- Preserve accepted FRLL, Memory/FSRS, competence, Today, Reader, Review, Library, Profile and assessment semantics.
- Supabase Auth remains identity/session authority.
- FastAPI + PostgreSQL remain application authorization/data authority.
- Browser must not access product/domain tables directly through Supabase Data API.
- No service/secret key in browser code.
- No speculative product features in the v0.1 critical path.
- Contract/schema changes require matching tests/docs/migrations.

## Audit tracks

1. Repository/release hygiene
   - CI coverage and branch checks
   - generated/cache artifacts
   - deterministic dependency installation
   - release verification command
2. Runtime resilience
   - liveness vs readiness
   - dependency/config readiness
   - request correlation
   - safe error behavior
3. Web security
   - security headers
   - cache policy on auth/account/admin surfaces
   - route boundary behavior
4. Admin system
   - separate admin presentation shell
   - explicit server-authorized admin capability probe
   - fail-closed handling for non-owner actors
5. Supabase security
   - advisors
   - direct Data API privileges
   - Auth lifecycle and account deletion
6. Deployment
   - Render health/readiness
   - Vercel build status
   - environment consistency
7. Documentation drift
   - stale project status / task board / release notes
   - clearly mark external/platform limitations

## Planned changes

- Add GitHub Actions quality gate running pinned Node/pnpm/Python installs, generated-contract freshness, frontend tests/typecheck/lint/build and backend format/lint/typecheck/tests.
- Ignore/remove TypeScript incremental build cache artifacts.
- Add production web security headers in Next.js.
- Add `/ready` dependency/config readiness endpoint while retaining `/health` as liveness; point Render health check to `/ready` only after tests pass.
- Propagate a stable `X-Request-ID` response header for operational correlation.
- Add an admin capability endpoint and a dedicated Admin route boundary/shell so authenticated non-owners fail closed before rendering the owner console.
- Reconcile status/task documentation with the auth hardening and this task.

## Explicitly out of scope unless a proven defect requires it

- Rewriting accepted learner algorithms.
- Changing FSRS scheduling policy.
- Adding AI Tutor, social/community, pronunciation scoring, marketplace or post-MVP systems.
- Enabling paid Supabase features that are unavailable on the current plan.

## Verification gates

- GitHub Actions quality gate green.
- Vercel preview/build green.
- Render deployment healthy if deployment-facing files change and are merged.
- Supabase advisors contain no actionable error introduced by this task.
- No direct `anon`/`authenticated` grants to public product tables.
- `git diff --check` equivalent enforced by CI.
- Existing tests remain green; new tests cover every new runtime/security boundary.
