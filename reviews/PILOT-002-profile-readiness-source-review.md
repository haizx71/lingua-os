# PILOT-002 profile readiness — independent source review

## Verdict

**PASS for the frozen source patch; no HIGH or BLOCKER findings.** This is a source review, not exact-head CI, Preview, a hosted actor run, or proof of a production latency improvement. Root promotion remains gated on exact-head CI and serialized normal merge.

## Reviewer and evidence identity

- Reviewer assignment: GPT-6 Luna, reasoning effort Max (independent configured assignment; runtime introspection unavailable).
- Frozen source manifest: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-09-profile-readiness-source-manifest.json`, SHA-256 `4c061f04d287c0fe83e9e39638318b3d93c039cd92b7af88e23e20764196844f`; branch `codex/pilot-profile-readiness`, base `a64e6ff602e0d71cd7285b8f8cd3f98f1ed93d37`, writer released.
- All six listed source hashes matched the manifest:
  - `.github/workflows/pilot-onboarding-regression.yml` — `446bc395324e417f593b5b8dc5003b881dff2f20998b195ed20918303d5e3531`
  - `apps/web/src/hooks/useProductReadiness.ts` — `e6b55bd9b1ba84ed3bbb4434ede3ef58efac710b26a0c247601e1f8d3540b3ae`
  - `packages/types/src/client.ts` — `515648bb29099dbefb5f7034ff384251682da3178311624d0e2ed43dd09f7d01`
  - `tests/frontend/AppRouteBoundary.test.tsx` — `56b20ca197f09429b11ea43e7fa0ae4c0631ef2bcb48f43160a3462a26e4f34d`
  - `tests/frontend/http-client.test.ts` — `a895de3a664884a455ade0b4ffcd4064fc6888e6021fc08d85fd6f0bc115be6f`
  - `tests/frontend/pilot-profile-readiness.test.tsx` — `fb339c57800638f69f52232532a5472834f4a7926413eb22b9f2df7f64301b96`
- The owner-exception artifact was read and hash-checked: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-09-pilot002-owner-exception.json`, SHA-256 `fbf95147d38af8f9bd34e5e4a9ed3cefb10a0e8d2829178f59158281ca0986ee`. It records the specific PILOT-002 P2 authorization, the reviewed plan hash, and that the general P0/P1 policy remains unchanged.
- The implementation evidence packet is `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-09-profile-readiness-implementation.md`, SHA-256 `64fed753824d5fa81b2538452e130cc7a72820f7e04002491ecf8681f12e5221`.
- The read-only review covered the six manifested paths, the frozen PILOT-002 plan and plan-review record, and the final docs manifest snapshot. No repository files, Git state, hosted systems, learner accounts, or actors were changed. No tests were rerun by this reviewer.

## Source findings

- `useProductReadiness` now uses the complete `/v1/me.languageProfiles` snapshot and routes missing or malformed lists through the existing fail-closed predicate. The six readiness checks remain in place; no readiness default or optimistic route release was added.
- The 45-second deadline races the whole `getMe` operation. The internal optional signal stops waiting on token acquisition, is checked before fetch, is passed to fetch, and is applied while reading the response body. Timeout preserves the route gate, shows a recoverable error, and waits for a manual retry. No automatic retry or cache was introduced.
- Each check has an operation generation, actor epoch and actor ID. Retry and effect cleanup invalidate and abort the old operation; the rendered snapshot is clamped to the current actor epoch/ID. This keeps stale readiness hidden during actor change and batched A→logout→A transitions.
- `HttpApiClient` checks cancellation after parsing and before writing the shared `me` ETag. The focused tests hold an old same-actor response body, complete a newer read, then resolve the old body and assert the newer ETag remains. Separate tests cover abort during token acquisition before fetch, late token/fetch/body completion after timeout, actor changes, logout, unmount, manual retry, the 30-second response path, malformed readiness data, and release from the complete DTO without a `/v1/me/languages` request.
- The existing actor A→B boundary regression remains meaningful with the authoritative profile embedded in each `/v1/me` response. The change does not touch the separate onboarding profile-list request, Today authority, backend, schema, OpenAPI wire contract, hosting configuration, or accepted K2 evidence. No full journey or performance improvement is claimed.
- The changed workflow is pull-request-only with `contents: read`, pinned actions, checkout credentials disabled, lifecycle scripts disabled during install, and no deploy or hosted-write step. Its path filters include the readiness hook, `packages/types/src/client.ts`, and the new regression test; the test is included in the job command. No secrets or credential references were added.

## Non-blocking coverage note

The new test verifies readiness disabled at mount without a profile request, but does not directly transition an in-flight enabled hook to `enabled=false`. The hook's effect cleanup does cancel and invalidate the active operation when the `enabled` dependency changes, and no behavior defect was found in that path. This is a test-coverage limitation, not a HIGH/BLOCKER finding; it may be covered later if that transition becomes a concrete regression risk.

## Verification boundaries

The implementation packet reports 7 focused frontend files and 122/122 passing tests, workspace typecheck, and focused lint. I inspected that report and the exact frozen source; I did not rerun those commands. The source worktree also contains a generated `apps/web/tsconfig.tsbuildinfo` modification that is outside the six-file manifest and its source diff; it was not altered or treated as part of this review and should remain excluded from integration.

The reproductions and implementation tests use a synthetic actor and local mocked transport. They confirm the conditional frontend mechanism and recovery behavior, not the owner's production request path, cause, incidence, or measured speedup. Exact-head CI/Preview and normal root-controlled promotion remain prospective; no CI, deployment, or hosted-journey success is asserted here.

## Documentation follow-up

The frozen documentation manifest accurately recorded the source review as pending when written. This review changes that status: before integrating those docs, replace the PILOT-002 phrases saying independent source review “remains required” with “independent GPT-6 Luna / Max source review PASS” and a link to this record. Keep exact-head CI and serialized normal merge as the remaining promotion gates; do not claim CI, Preview, deployment, or live learner success. Preserve the frozen plan and plan-review verdict as historical records; if a current status note is needed in the plan-review file, append a subsequent-status note rather than rewriting the original plan verdict.
