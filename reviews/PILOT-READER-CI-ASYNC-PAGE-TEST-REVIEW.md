# PILOT-READER async page test adapter review

**Date:** 2026-10-10  
**Reviewer configuration:** GPT-6 Luna / Max (assigned reviewer configuration; runtime introspection unavailable).  
**Verdict:** **PASS for the exact test-only change; no HIGH or BLOCKER findings.** This review covers the unit-test adapter only and does not constitute exact-head CI or hosted acceptance evidence.

## Frozen scope

- Integration HEAD at review: `58cfbdeec6408f18661362b5c41c081363fcca78`.
- Implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-pr68-combo10-test-adapter.md`, SHA-256 `86ae22397fb8fd362e60d2b0c23fb506abc78fda225dfde8bf6e5e980f8386b5`.
- Only changed file: `tests/frontend/e2e/tier3-combinations.test.tsx`, raw SHA-256 `fb922916a80a2461da6d02fd0388d7650d0457832243a91259e415334afd364b`.

The diff changes `combo_10_appshell_renders_across_all_5_primary_routes_cleanly` to an async test, awaits the actual imported `ReadPage({ searchParams: Promise.resolve({}) })`, and mounts the returned React element for `/read`. The other four route components and the existing main-landmark assertion loop are unchanged. The test file has no other direct `ReadPage` invocation.

This adapts the test to the current Next page contract, where `searchParams` is a Promise and `ReadPage` is async. It calls the real page component with an empty promised parameter object, which exercises the route's no-selection behavior. The change adds no mock, skip, weakened assertion, production edit, contract change, or workflow change. It does not alter the route's actual request or recommendation behavior.

## Independent verification

- `pnpm exec vitest run tests/frontend/e2e/tier3-combinations.test.tsx --maxWorkers=1` — **1 file passed; 12 tests passed**. The test output included GSAP target/scope warnings, with no assertion failures.
- `pnpm exec eslint tests/frontend/e2e/tier3-combinations.test.tsx` — passed.
- Recomputed the packet and changed-file SHA-256 values; both matched their pins. The targeted worktree status showed only this test file modified; `apps/web/src/app/read/page.tsx` was unchanged.
- The implementation packet reports `pnpm typecheck` and a broader local run of 73 files / 1,076 passed / 1 optional FRLL skip. Those broader checks are implementation-worker evidence, not independent reruns in this review.

No hosted actors, cloud state, production UI, or learner data were used. The fix addresses the single test-adapter failure only. Exact-head CI remains the next verification gate; this PASS is not a hosted or promotion claim.