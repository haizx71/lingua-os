# Independent Review — K2-08 Dictionary Fixture Query

Date: 2026-10-02
Reviewer: GPT-6 Luna / Max
Disposition: **PASS for this bounded harness fix; no HIGH/BLOCKER findings.** This review does not establish hosted K2-08 acceptance.

## Reviewed source

- Base: `25e7e1a3b85b302f7f1c6a9613e55b82e6f0ef55`
- Reviewed uncommitted diff SHA-256: `49c569db05e6a921576ff7e6c0b2a974f752afa583dd23235667dba0eecd2562`
- Changed files: `tests/acceptance/support/k2_hosted_runner.ts` and `tests/acceptance/support/k2_hosted_runner.test.ts`

The request normalizer had validated the Dictionary route’s three allowed query parameters, but left the outbound route as `url.pathname`. The transport therefore sent `/v1/dictionary/search` without the required query and received HTTP 422. This was a harness transport defect; the existing API contract accepts one-character queries and limits from 1 through 100.

The fix reconstructs the outbound query only from the already validated `query`, `languageCode: en`, and `limit: 100`. The shared duplicate-key rejection remains before route-specific processing, and exact-key validation still rejects additional parameters. Method, body, idempotency, actor identity, Auth, RLS, and API scope are unchanged. The regression test exercises the outbound URL through the HTTP helper and rejects an extra `cursor` parameter.

## Verification

- Independent focused Vitest run: **1 passed**, with 35 unrelated tests skipped.
- The implementation worker reported **54/54** related runner, K2-08, due-only, and workflow-security tests passing, plus typecheck, lint, and diff checks.
- The prior hosted run `36894644581` on `25e7e1a3` failed at `fixture_k208_due_seed` with HTTP 422. The sanitized checkpoint record reports actor cleanup, fresh-identity cleanup, retained-state comparison, and finalizer completion passing; the hosted job and current-run-cleanup job statuses were independently checked as failure and success respectively. The retained snapshot was reported unchanged at 61 rows / 51,535 bytes. The run remains **FAIL**, not K2-08 acceptance.

The failed seed path begins with Dictionary GET searches; Save/Learn PUTs happen only after 20 concepts are selected. No API limit change or parser workaround is indicated. Re-run the full workflow only after the corrected diff passes exact-head CI and is merged. Final K2-08 acceptance still requires the corrected full harness run and its cleanup and retained-state gates to pass.

No hosted changes, source edits, or Git commits were made; this review added only this review file.
