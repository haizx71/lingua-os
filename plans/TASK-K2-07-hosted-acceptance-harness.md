# TASK-K2-07 — Hosted Acceptance Harness

Status: SOURCE READY; HOSTED RUN BLOCKED BY SECURE INFRASTRUCTURE
Scope: Reusable, staging-only hosted acceptance runner; K2-07 first, later waves
Owner: BACKEND / acceptance tooling

## Contract

The acceptance runner may create exactly two fresh confirmed Auth actors: a primary fixture actor
and a disposable observer for cross-actor isolation. Both receive server-owned `app_metadata`
ownership marks, use normal Supabase password sign-in, and are removed through Auth Admin deletion.
The run never selects or mutates an existing learner. Each mark binds its actor to the exact staging
Supabase project, GitHub repository, protected environment, workflow ref, run and attempt, and
bounded expiry. Cleanup re-fetches the Auth user and requires the exact mark and reserved
`example.invalid` address to remain unchanged before deletion. Fresh create results are kept in memory
for finalizer retries. If a process stops after an unmarked partial create, same-run recovery accepts
only exact reserved addresses for this workflow run and attempts within 24 hours, with confirmed
email, no sign-in, complete pagination, exact re-fetch, Auth 404, and zero actor-owned rows. This
recovery does not broaden the TTL janitor, which remains server-marker-only.

The workflow is serial per staging project; its credential-free security gate also runs on pull
requests to `master`, while mutation jobs run only from protected `master` dispatch/schedule. Staging
provider credentials are step-scoped from GitHub's protected `k2-staging` environment. The runner
derives the exact immutable Vercel Production origin from successful GitHub deployment/status records
for the current SHA; it requires matching `environment_url`, `target_url`, and `log_url`, the
`vercel[bot]` creator, and a protected OIDC challenge/access check. Protected Vercel access uses
GitHub Actions OIDC Trusted Sources in memory. Missing staging settings, protected access, or OIDC
configuration fails closed before actor creation. The runner creates no share links, does not
alter deployment protection, and never writes credentials, JWTs, actor IDs, or email addresses to
files, artifacts, logs, or reports.

Before baseline or actor creation, the run reaps expired exact-marker actors and cleans marked
actors from earlier attempts of the same workflow run. A separate crash-recovery path may clean an
unmarked actor only when its exact reserved email encodes this same run and an earlier/current
attempt, Auth confirms it is within the 24-hour recovery bound, confirmed, and never signed in, and
a fresh UUID/email/timestamp re-fetch still has no server marker. The runner also keeps fresh IDs and
emails in memory for finalizer retry; no recovery identity is persisted locally. The TTL janitor
remains marker-only. Any unmarked reserved identity from another run, malformed metadata, ambiguous
match, incomplete enumeration, or stale recovery candidate blocks baseline and deletion. It takes a
bounded read-only snapshot of the frozen 27-table learner inventory, with
complete `pg_catalog` discovery and verified read-only privileges. It creates only actor-owned
profile and review fixtures through existing APIs, checks the weakest observed Review dimension
against available canonical material, exact answer replay, one FSRS lineage and competence
projection, and primary-to-observer isolation. Auth deletion must prove canonical Auth absence and
zero actor-owned rows; retained counts and SHA-256 hashes must match the pre-run baseline even if
cleanup fails. The strict TTL janitor can delete only expired exact-marker actors; malformed or
ambiguous matches stop cleanup.

## K2-07 staging constraints

The currently recorded staging catalog has one typing sense (`frll-anchor`), no HTTPS audio, and no
published content with aligned cloze targets. Consequently typing and self-recall can be exercised
when the live queue selects them; listening and cloze remain explicitly untested until eligible
canonical staging material exists. Their absence is reported as untested, never as a pass. Typing
is submitted as production evidence with rating-based weight; the API does not grade typed text,
so acceptance must not call this objective correctness. K2-08, K2-09, and K2-10 can add
wave-specific fixture/action plugins behind the same lifecycle, snapshot, replay, isolation, and
cleanup gates.

## Bounded implementation and gates

1. Add a durable staging acceptance plan and read-only schema fingerprint/probe.
2. Add exact-environment preflight, in-process actor lifecycle, protected OIDC transport, and a
   marker-only guarded janitor with bounded pagination and re-fetch before deletion.
3. Add the K2-07 Playwright/HTTP plugin: bootstrap a new learner, save the canonical anchor, verify
   selected mode, answer/replay, and confirm one scheduler lineage plus complete retained-state
   equality.
4. Add focused adversarial unit coverage and a protected GitHub Actions environment workflow with
   an unprivileged pull-request gate, a single staging mutation lock, and unconditional current-run
   cleanup.
5. Add the staging-only Render source attestation to operational health and every API response,
   document its optional response-header contract, and update `STATUS.md` and `TASKS.md`. No
   database migration or hosted state change is in scope.

The harness requests GPT-6 Luna Max; this runtime does not expose the actual model or reasoning
effort for independent verification. Independent source security review passed. Local verification
passed 47/47 hosted-harness Vitest tests, 6/6 Python probe tests, the 1/1 real Chromium redirect
test, workspace typecheck, and `pnpm backend:check` (600 backend tests). It creates no actors and
does not establish hosted acceptance. Read-only staging checks confirmed migration `0019` and the
built-in `supabase_read_only_user` has broad `BYPASSRLS` read capability without `pg_write_all_data`
membership; the protected CI connection URL/password remains unavailable. The already-authorized
hosted run will proceed only after independent code review and
protected staging environment setup; it does not need another owner approval round. The current
repository has no `k2-staging` environment secrets, and private-repository protected environments
may require a paid GitHub plan, so CI must fail closed until that secure infrastructure exists.
