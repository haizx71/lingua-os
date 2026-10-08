# K2-10 Hosted FRLL Acceptance Extension

## Objective

Extend the existing protected K2 hosted acceptance lifecycle so each owner-dispatched,
current-master K2-10 run proves the frozen FRLL/R1 behavior with fresh disposable actors,
normal Auth JWTs, read-only persisted-state evidence, and the existing fail-closed cleanup
and retained-state comparison. This is verification work only: no product/API/schema change,
new migration, grant, or hosted write is part of source implementation.

FRLL-16 completion requires two sequential full K2-10 owner-dispatched runs at the same
accepted master SHA. Each run must use fresh actors and independently pass Auth absence,
27-table zero-residue, and retained-state comparison. The workflow runner executes one wave
per dispatch; no source-level loop or run orchestrator is added.

## Frozen scope and safety boundaries

- Preserve K2-07, K2-08, K2-08-DUE-ONLY, and K2-09 selector defaults, behavior, fixture gates,
  and permissions.
- Add only `K2-10` as a strict wave selector on the existing protected workflow dispatch.
  Keep repository, master ref, exact workflow ref, owner actor, triggering actor, current SHA,
  and minimal permissions checks intact.
- Use exactly four runner-created marked actors. Before any `/v1/me` request, require all
  27 learner tables to have zero rows for every new actor. Bootstrap through the existing
  normal-JWT endpoints and validate/read back the complete profile DTO.
- Keep credentials and Auth JWTs inside the runner process. The wave-facing sign-in seam accepts
  only actor handles; the runner uses its in-memory factory credentials in an ephemeral same-origin
  Auth controller. No report or annotation may contain passwords, tokens, cookies, Auth UUIDs,
  real email addresses, service keys, database URLs, response text, or row identifiers.
- Before binding a browser JWT, verify its Auth identity with real `getUser(accessToken)` and
  require an exact match to the factory actor. Unknown bearer requests may wait behind a
  runner-owned, 15-second maximum sign-in barrier, then must re-match the original bearer
  against the verified session map. Known in-flight Actor A requests remain A throughout a
  switch to B. Read the initial token from a separate `about:blank` page in the same context;
  never navigate the original page during the late-A-response scenario.
- Preserve the production browser guard that blocks `/api` proxy requests: the current
  protected Next route forwards Vercel bypass headers. K2-10 intercepts only exact FRLL
  browser API paths and fulfills them through a runner-owned direct Render client using the
  runner-bound actor's normal JWT. No OIDC, cookie, Admin, or bypass header may reach Render.
  Browser coverage is explicitly UI + intercepted authenticated Render API, not an
  end-to-end test of the protected Next proxy.
- Add one fixed-anchor, read-only semantic probe that returns only bounded, sanitized
  projection values and relation booleans. It proves F1-D/E persisted state against API DTOs;
  it does not return actor/profile/row IDs, learner text, credentials, or raw DSNs.
- Every execution path remains under `runK2HostedWave` finalization: sign out and clear the
  browser, delete only current marked Auth actors, prove fresh Auth absence and 27-table zero
  residue, then compare the retained-table snapshot. No alternate provisioner or teardown.
- Keep traces, screenshots, and video disabled. Redact all caught errors and enforce a
  30-minute K2-10 test timeout within the 35-minute hosted job.

## FRLL and R1 coverage map

| Coverage | K2-10 evidence |
|---|---|
| F1-B / FRLL-01..06 | Four fresh Auth identities; zero-table pre-bootstrap snapshots; normal-JWT `/v1/me`, timezone ETag PATCH, empty languages GET, fixed profile POST; full contract validation and exact list readback; fixed-anchor API/material readback; passive Dictionary zero-write; explicit Save Learn and idempotent replay; one Memory lineage. |
| F1-C / FRLL-07 | Authoritative Today plan against persisted review targets and profile/timezone; same-plan replay; no new learning/FSRS rows from passive plan reads. |
| F1-D / FRLL-08..11 | Read-only queue; HTTP 200 answer; read-only semantic probe confirms atomic persisted FSRS, review event, learning event, and competence changes; lost-response reload/retry exact replay; changed same-key conflict and zero second mutation. |
| F1-E / FRLL-12 | Real persisted non-synthetic Brain concept/summary/list DTO parity with fixed-anchor database state; GETs leave all 27 actor tables unchanged. |
| R1 passive-zero-write | A fresh passive actor hydrates Dictionary/Today/Brain; learner state is byte/count stable except the three documented Today coordination tables. |
| R1 late Actor B isolation | Actor B cannot read/answer Actor A's review item; both actors remain unchanged; a delayed Actor A Brain response released after same-context switch to B cannot render stale A data. |

## Implementation sequence

1. Add adversarial tests for the new strict wave selector, complete profile/list DTO parser,
   K2-10 browser route method/path/header allowlist, semantic probe parser/environment, and
   the workflow owner/master/secret selector.
2. Add the fixed-anchor read-only semantic proof to the K2 Python probe and its TS client.
   Fake-connection tests must prove fixed SELECT-only behavior and sanitized bounded output.
3. Extend the shared runner with K2-10-only strict bootstrap, pre-bootstrap zero snapshots,
   page-to-actor ownership, named FRLL API methods, and a fail-closed direct-Render browser
   interceptor. Existing wave defaults and network guards remain unchanged.
4. Add a dedicated K2-10 wave plugin and focused tests implementing the mapped B-E/R1 cases
   using frozen FRLL assertion helpers plus semantic persisted-state comparisons.
5. Wire only the K2-10 dispatch option, selected test, strict K210 janitor/recovery allowlist,
   harness typecheck includes, and CI test lists. Preserve existing scope/permissions.
6. Run focused Vitest, Python probe tests, harness typecheck, relevant workflow/security tests,
   static diff/privacy checks, and line-ending/hash manifest capture. Do not run hosted actors,
   cloud writes, migrations, or Git operations in this implementation task.

## Review and completion packet

The implementation packet will list exact changed paths, SHA-256 raw hashes and Git-LF hashes,
test commands/results, coverage limitations, and cleanup invariants. Independent review is
required before any source promotion or hosted run. The browser proxy limitation above must
remain explicit in the review and any final hosted report.
