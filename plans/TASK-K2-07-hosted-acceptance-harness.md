# TASK-K2-07 — Hosted Acceptance Harness

Status: SOURCE READY; HOSTED ACCEPTANCE BLOCKED DURING LEARNER PROFILE BOOTSTRAP
Scope: Reusable, staging-only hosted acceptance runner; K2-07 first, later waves
Owner: BACKEND / acceptance tooling

## Latest hosted gate evidence — 2026-10-01

Hosted run `36751277032` on `master` at `e01cc21624bda37f59c982498686a6a709ca2264` passed
protected-origin access, API health, application and Supabase migration verification, the runner
recheck, and browser authentication. Two disposable actors were created and authenticated; the
primary actor's first `POST /v1/me/languages` returned HTTP 409 `INVALID_STATE_TRANSITION` instead
of 201. `GET /v1/me` had bootstrapped a learner profile with `time_zone = NULL`; the harness had
not persisted a valid IANA timezone first. The backend correctly rejects language creation until
this ADR-019 precondition is met. The K2-07 plugin's save, answer/replay, and isolation assertions
were not reached, so K2-07 remains BLOCKED and K2-08 remains locked.

The runner correction in this source branch uses each learner ETag returned by bootstrap to
`PATCH /v1/me` with `Asia/Ho_Chi_Minh`, requires HTTP 200, matching actor identity, persisted
timezone, and an updated ETag, then confirms an empty language-profile list before a strict HTTP
201 create. It performs this independently for primary and observer actors. Implementation and
focused verification used GPT-6 Luna / Max. Verification passes 19/19 K2 runner/plugin tests,
workspace typecheck, and changed-file lint. No API contract, backend, migration, or hosted staging
state changed.

The finalizer preserved the original 409. Independent source/sanitized-log review found no cleanup,
actor-residue, or retained-comparison error replacing it; the logs did not expose explicit row
counts. The separate current-run cleanup job passed in 44 seconds. These cleanup observations do
not establish K2-07 learner-state acceptance.

## Previous hosted gate evidence — application migration registry — 2026-10-01

Hosted run `36747649793` on `master` at `fdb4036e436e8b82b9fb67b1358413a2a5b31367` passed the
protected-origin and staging API checks, then failed at the TypeScript migration adapter before
actor creation. The adapter expected application head `0019`/19, while the application registry
contract is `0017`/17. Read-only Supabase migration listing confirmed platform migration
`20260927034218` (`concept_save_intent_auth_erasure_0019`) followed by
`20260928164141` (`k2_hosted_acceptance_reader_staging`); these entries belong to the separate
Supabase platform registry checked by the Python probe. The current-run cleanup job
`109998391323` passed in 45 seconds. No disposable actor was created and the retained learner
comparison was not reached, so hosted acceptance is not established.

## Migration-head semantics — 2026-10-01

The migration probe checks two independent registries. The application registry in
`public.schema_migrations` must contain exactly `0001`–`0017`, ending at
`knowledge_v2_learner_retrievability`, and returns application head `0017` with count 17. The
Supabase platform registry in `supabase_migrations.schema_migrations` must end with
`concept_save_intent_auth_erasure_0019` followed by
`k2_hosted_acceptance_reader_staging` at a strictly later version. The reader role may select
only the `version` and `name` columns; it must lack table-level SELECT, `statements` SELECT, and
INSERT/UPDATE/DELETE/TRUNCATE privileges. Supabase migration `0019` is therefore not the
application migration head. The TypeScript adapter validates the application `0017`/17 proof and
the runner requires the resulting approved `0017` head; the Python probe retains the independent
Supabase `0019` plus staging-reader checks.

## Current hosted gate evidence — 2026-09-30

PR #28 added a fail-closed protected-origin diagnostic and merged to `master` at
`10a00b6c009e83301ba0d4cea4f32cf5714e89a5`. Independent combined-HEAD review at
`459bb45813a8dfae9c1c04c7333ce1325877af65` passed with no HIGH/BLOCKER findings; its security
gate passed. GitHub Production deployment `6763405633` for the exact merge SHA, created by
`vercel[bot]`, has status `success`.

All six required GitHub repository secret names are configured, including
`K2_STAGING_READONLY_DATABASE_URL`; the dedicated staging role
`k2_hosted_acceptance_reader` and its repository secret are configured. No secret values were
inspected. DB-only preflight run `36593505143` passed at harness commit
`3af469084b8106557dcca877572338040a8dc804`. This does not establish the disposable-actor
preflight, which has not run.

The owner-confirmed Vercel Trusted Source rule is scoped to issuer
`https://token.actions.githubusercontent.com`, repository `haizx71/lingua-os`, workflow display
name `K2 Hosted Acceptance`, branch `master`, audience `https://vercel.com`, and target
`Production` only. The guided Vercel UI does not offer `event_name` or `workflow_ref` conditions.
Exact event/ref/workflow/repository/owner checks remain enforced by GitHub Actions; the Vercel
rule is not represented as enforcing the event.

Earlier workflow run `36734233167` was dispatched on `master` at
`477663743d438364f34fb34f9712cfcf82d47949` and failed the protected Vercel check before actor
creation. Its separate current-run-cleanup job `109952362357` passed. No retained baseline or
learner comparison gate was reached, so this is not hosted learner-state acceptance. K2-07 remains
BLOCKED and K2-08 remains locked. PR #24 TLS
certificate/role proof and PRs #25/#26/#27 narrow OIDC hostname fixes are merged in current master.
No Share link, protection bypass, or global protection change was made or is authorized by this
plan.

The subsequent hosted run `36737740694` on current master SHA
`10a00b6c009e83301ba0d4cea4f32cf5714e89a5` FAILED at `verifyProtectedVercelOrigin`: the check
received HTTP 308 with `x-vercel-id` present and classified the redirect as `vercel-app`. It failed
closed before creating any actor. Separate current-run-cleanup job `109964874290` passed in 41
seconds. No retained baseline or learner comparison gate was reached. K2-07 remains BLOCKED and
K2-08 remains locked; no hosted acceptance pass is established.

The canonical-origin correction is implemented in isolated source commits and remains under
independent review. Its local focused security gate passed 114/114 tests, workspace typecheck and
changed-file lint passed, the real cross-origin browser redirect test passed, and the Next.js
production build registered `/api/k2-vercel-attestation` as a dynamic route. This source has not
been merged or deployed; no hosted acceptance result or actor lifecycle is claimed from it.

Independent review of PR #29 then found a HIGH reporting issue in the browser sign-in helper:
Playwright 1.63 can include `.fill(value)` arguments in action errors, which the list reporter may
print if the error escapes the helper. The follow-up wraps credential fills, submit, response
handling, and destination waits in a fixed error with no original cause, and consumes the response
wait rejection even when an earlier fill fails. Fake in-memory email/password markers cover those
failure stages; no live credentials or actors are used. PR #29 remains unmerged pending delta review
and its credential-free CI rerun.

## Contract

The acceptance runner may create exactly two fresh confirmed Auth actors: a primary fixture actor
and a disposable observer for cross-actor isolation. Both receive server-owned `app_metadata`
ownership marks, use normal Supabase password sign-in, and are removed through Auth Admin deletion.
The run never selects or mutates an existing learner. Each mark binds its actor to the exact staging
Supabase project, GitHub repository, logical `k2-staging` label, workflow ref, run and attempt, and
bounded expiry. Cleanup re-fetches the Auth user and requires the exact mark and reserved
`example.invalid` address to remain unchanged before deletion. Fresh create results are kept in memory
for finalizer retries. If a process stops after an unmarked partial create, same-run recovery accepts
only exact reserved addresses for this workflow run and attempts within 24 hours, with confirmed
email, no sign-in, complete pagination, exact re-fetch, Auth 404, and zero actor-owned rows. This
recovery does not broaden the TTL janitor, which remains server-marker-only.

The secret-bearing workflow is serial per staging project and has only manual dispatch and scheduled
triggers; acceptance is manual dispatch from the exact repository/master workflow ref by owner
`haizx71` as both actor and triggering actor. A separate credential-free workflow runs the security
gate only for pull requests to `master`. Six repository secrets are mapped only to the step that
uses them; a no-secret GitHub API preflight checks the dispatch SHA against the live master tip
before those secrets are mapped, and the runner checks again immediately before actor creation.
Current-run cleanup is conditioned on the hosted job having started, retains exact repository/ref/
workflow/owner guards, and does not recheck the current master SHA so cleanup remains possible if
master advances after a failure. The runner derives the exact immutable Vercel Production origin from
successful GitHub deployment/status records for the current SHA; it requires matching
`environment_url`, `target_url`, and `log_url`, the `vercel[bot]` creator, and a protected OIDC
challenge/access check. Protected Vercel access uses GitHub Actions OIDC Trusted Sources in memory.
The Vercel rule is owner-confirmed to bind issuer `https://token.actions.githubusercontent.com`,
repository `haizx71/lingua-os`, workflow display name `K2 Hosted Acceptance`, branch `master`,
audience `https://vercel.com`, and target `Production` only. The guided UI does not expose
`event_name` or `workflow_ref`; exact event/ref/workflow/repository/owner checks are enforced by
the GitHub Actions workflow and preflight, not claimed as Vercel conditions. It must not depend
on a GitHub environment claim or assumed `sub` shape. Missing staging settings, protected
access, or OIDC configuration fails closed before actor creation. The runner creates no share links,
does not alter deployment protection, and never writes credentials, JWTs, actor IDs, or email
addresses to files, artifacts, logs, or reports.

The protected-origin gate also requires independent evidence for the browser-facing canonical host.
The operational `GET /api/k2-vercel-attestation` route is dynamic and returns a private, no-store
JSON object with this versioned shape: `schemaVersion`, `sourceSha`, `deploymentOrigin`,
`deploymentId`, `environment`, `repositoryOwner`, `repositorySlug`, and `canonicalOrigin`. Its
values come from Vercel-managed runtime variables (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_URL`,
`VERCEL_DEPLOYMENT_ID`, `VERCEL_ENV`, `VERCEL_GIT_REPO_OWNER`, and `VERCEL_GIT_REPO_SLUG`) plus
the effective canonical origin constrained to the repository-owned
`DEFAULT_CANONICAL_WEB_ORIGIN`. Missing or malformed runtime values and any non-production,
repository, SHA, deployment, or canonical mismatch fail closed. The route does not read `Host` or
forwarded-host headers and does not return request data or secrets. It is operational deployment
metadata, not a learner/product API; it is intentionally excluded from `contracts/openapi.yaml`.

For the immutable deployment origin already attested by successful GitHub Production statuses, the
runner first requires anonymous Vercel challenges on `/auth` and the operational route, then
OIDC-fetches that route with redirects disabled and checks the metadata against `GITHUB_SHA`, the
exact immutable origin, repository, and Production environment. It next requires the authenticated
immutable `/auth` response to be the exact 308 to the metadata-bound canonical `/auth` path over
HTTPS, with no userinfo, port, query, or fragment. Only after that does it challenge anonymous
access at canonical `/api/k2-vercel-attestation` and `/auth`, then OIDC-fetch the canonical
operational route. The canonical response must report
the same exact SHA, immutable Vercel URL, deployment ID, repository, Production environment, and
code-owned canonical origin; the canonical authenticated `/auth` response must be HTTP 200 with
`x-vercel-id` and `text/html`. Redirects are never followed with the OIDC token. The runner returns
only the independently verified canonical origin to Playwright, whose request guard scopes the
OIDC header to that exact origin. Vercel system-variable behavior is documented at
[Vercel System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables);
Trusted Sources uses the `x-vercel-trusted-oidc-idp-token` request header as documented at
[Vercel Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources).

The six staging values are repository-level secrets because GitHub environment secrets are not
available under the current plan. No plan upgrade is needed for this path, but any workflow in the
repository can read the values if it references them. This leaves a cross-workflow secret risk and
assumes `haizx71` is the only trusted writer/merger of workflow code. Do not grant untrusted
collaborators write access; review every workflow change. The six required secret names and the
dedicated read-only staging role are configured. No secret values have been read into this plan or
the source tree.

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
2. Add exact-repository/ref/owner preflight, in-process actor lifecycle, protected OIDC transport, and a
   marker-only guarded janitor with bounded pagination and re-fetch before deletion.
3. Add the K2-07 Playwright/HTTP plugin: bootstrap a new learner, save the canonical anchor, verify
   selected mode, answer/replay, and confirm one scheduler lineage plus complete retained-state
   equality.
4. Add focused adversarial unit coverage and separate pull-request-only and secret-bearing GitHub
   workflows with a single staging mutation lock and guarded current-run cleanup.
5. Add the staging-only Render source attestation to operational health and every API response,
   document its optional response-header contract, and update `STATUS.md` and `TASKS.md`. No
   database migration or hosted state change is in scope.

Historical hosted-harness implementation runtime and effort remain unverified. PR #28 diagnostic
implementation: GPT-6 Luna / Max; independent combined-HEAD review: GPT-6 Luna / Max, PASS with no
HIGH/BLOCKER findings; CI security gate: PASS; documentation update: GPT-6 Luna / Medium. Current
local verification passed 61/61
focused hosted-harness Vitest tests (including workflow security), 6/6 Python probe tests, the 1/1
real Chromium redirect test, and workspace typecheck. `pnpm backend:check` passed on the prior
source snapshot (600 backend tests); this revision changes no backend or Python runtime code. It
creates no actors and does not establish hosted acceptance. Read-only staging checks confirmed
migration `0019` and the dedicated `k2_hosted_acceptance_reader` has broad read capability without
`pg_write_all_data` membership. DB-only preflight run `36593505143` passed; no disposable-actor
preflight has run. Workflow run `36734233167` failed at the protected Vercel check before actor
creation; cleanup job `109952362357` passed. The newer workflow run `36737740694` also failed
closed at protected-origin verification before actor creation; cleanup job `109964874290` passed.
No baseline or learner comparison was reached. Hosted acceptance remains blocked until the current
protected-origin issue is resolved and that gate passes.
No GitHub plan upgrade is needed for this path, but repository-wide secret availability
requires the documented owner-only trusted-writer assumption. CI must fail closed until secure setup
is complete. Cleanup and the TTL janitor do not require migration head `0019` before attempting
owner-marker-guarded Auth deletion; their post-delete residue proof remains strict and fails if the
known schema inventory cannot be proven. Acceptance still requires migration head `0019` before any
wave actors are created.
