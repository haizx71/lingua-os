# PILOT-005 — Explicit Reader Content Selection: Independent Source Review

Date: 2026-10-10  
Reviewer configuration: GPT-6 Luna / Max (configured reviewer model; runtime introspection unavailable)  
Initial verdict (historical): **FAIL / HOLD — one HIGH finding remained.**  
Current verdict: **PASS for the exact nine-file selection source slice, with verification limits.**  
Scope: independent review of the frozen nine-file PILOT-005 source set in the isolated selection worktree. This review does not authorize source integration, hosted verification, learner activity, or promotion.

## Frozen evidence

Selection worktree: `C:\Users\pc\.codex\worktrees\pilot-reader-selection\LINGUA_OS_PROJECT_STARTER`  
Branch/base reported for this slice: `codex/pilot-reader-explicit-selection` / `af813`  
Bounded plan: `plans/PILOT-READER-EXPLICIT-SELECTION.md`, SHA-256 `9bb2038b78dc697ab832a225feaa6437f4c20519896628636a33a222cd4f3095`.  
Plan review: `reviews/PILOT-READER-EXPLICIT-SELECTION-PLAN-REVIEW.md`, SHA-256 `1e0f79157f2dfe1e2b9e5b6a704874f0442c1a1aef2cef98dc18059ae0ab78ec`.

The nine reviewed source hashes are:

| SHA-256 | File |
| --- | --- |
| `21fb2a095848ca96dd3d64b9f063cd8be261595b7a936203850dcd165732896b` | `apps/web/src/app/read/page.tsx` |
| `fa380a4200cda329b6e9daa988d80998ecf805226bfe8bc8b18a9f610d82273b` | `apps/web/src/features/library/LibraryView.tsx` |
| `7893fb61710a0928b0e60329c34f1c93bd2c85fce43975fd15e344d6eaf198a8` | `apps/web/src/features/read/InteractiveReader.tsx` |
| `f19c7b8f04b620bb2a0ff45138f7ae6530cb839827271d518e84186c3fcebbcb` | `apps/web/src/features/read/useReaderSession.ts` |
| `eaa1422c20c08e2ef399c1a8eb4434e736f30a632b319e5bb25bf3907b920c26` | `apps/web/src/features/today/adapters.ts` |
| `e065b7fd0893c3a9fc732a59e95ab029f0dca6d45a61ab21ed8bb3091b5ff642` | `tests/frontend/reader-explicit-selection.test.tsx` |
| `c8ba17092e670d519b46f4dbf48449faea19545cb3546e71dd68b7230e2bd439` | `tests/frontend/task-library-001-library-live.test.tsx` |
| `1aefff65d59d37d8e20b6f2828c2e99ab1960f20674ffe15be797365945509ac` | `tests/frontend/task-read-001-reader-live.test.tsx` |
| `f8ed7633142ce53dd20a09da89ac23ccb3a0557dd046caa7cf04ae59a57258db` | `tests/frontend/task011-today-live.test.tsx` |

All nine raw hashes were independently recomputed in the isolated source worktree and matched these pins. Generated `apps/web/tsconfig.tsbuildinfo` is excluded from the reviewed source set.

## Finding

### HIGH — `/read` is declared as an async Client Component

`apps/web/src/app/read/page.tsx:1` begins with `'use client'`, while lines 10–14 declare `export default async function ReadPage(...)` and `await searchParams`. The package uses Next.js `^15.5.24` and React `^19.0.0`.

Next.js documents that Client Components cannot be async functions and identifies this exact shape as the “No async Client Component” error. Its page/search-parameter guidance says to read the Promise in an async Server Component page, or keep a Client Component synchronous and unwrap the Promise with React `use`. See the [official error guidance](https://nextjs.org/docs/messages/no-async-client-component) and [official page search-parameter guidance](https://nextjs.org/docs/app/api-reference/functions/use-search-params).

The new test helper at `tests/frontend/reader-explicit-selection.test.tsx:72–74` directly calls `ReadPage(...)`, awaits its return, then renders the returned element. This bypasses Next App Router's Client Component boundary and therefore accepts the invalid async Client Component shape. The 76 passing component tests do not close this route-level failure. Type checking and linting likewise do not establish that Next can render this route.

**Required closure:** make `ReadPage` a Server Component by removing the page-level `'use client'` directive while retaining the awaited `searchParams` Promise and passing the validated primitive to the client `InteractiveReader`; or keep it synchronous and unwrap the Promise with React `use` in a supported Suspense arrangement. Add and run a Next route/build or App Router smoke that exercises both `/read?contentId=<valid-id>` and `/read` without the `No async Client Component` failure. Preserve the current duplicate/malformed fail-closed behavior. Do not treat direct invocation of the exported page function as this route-level proof.

## Reviewed behavior and boundaries

Aside from the HIGH route-boundary finding above, source inspection found the requested selection and stale-operation logic aligned with the bounded plan:

- Absent `contentId` preserves recommendation-first behavior. Duplicate values map to `null`; malformed, blank, or non-UUID values fail closed; a supplied valid UUID is not trimmed and loads through existing `getContent`. Explicit-selection failures do not fall back to recommendations. The returned content identity is checked against the requested identity.
- Library content links and Today read/listen actions encode an existing content ID. Generic routes and actions without an ID retain their previous destinations.
- Load, lookup/exposure, concept save, sentence/content save, and progress operations capture route/content, actor epoch/identity, active profile, and operation sequence as applicable. Success/error/finally state writes are guarded. An already-dispatched mutation remains bound to its captured A payload; stale A completion cannot replace B state or clear B's busy state. Retry/profile and actor changes invalidate relevant work. No API, schema, Auth, RLS, grant, idempotency, or persistent-learning change was found.
- Save-to-review feedback still follows a confirmed save and a user-clicked Review link; completion/Today affordance follows server-confirmed progress and a user click; route prefetch is disabled on these transitions; translation reveal remains local presentation state with no learning effect.

These are bounded source findings, not hosted evidence. No real learner session or actor, hosted request, secret, Git mutation, Auth/RLS mutation, or publication/promotion was used or observed.

## Verification and limits

Independently run focused test command:

```text
pnpm exec vitest run tests/frontend/reader-explicit-selection.test.tsx tests/frontend/task-library-001-library-live.test.tsx tests/frontend/task-read-001-reader-live.test.tsx tests/frontend/task011-today-live.test.tsx --maxWorkers=1
```

Result: **4 files passed, 76 tests passed**. The selection test covers valid/absent/malformed/duplicate selection, no-fallback behavior, route and actor switches, stale lookup/exposure and save/progress completions, retry/profile invalidation, and existing Library/Today behavior. It is a component-level test and does not run the Next App Router.

The implementation worker reported typecheck, lint, and diff checks passing; those checks were not independently rerun in this review. A Next route/build smoke was not run; the framework rule is directly confirmed by the official documentation and the frozen source lines above. No unrelated frontend suite was rerun.

## Initial verdict disposition (historical)

At the initial snapshot, the bounded owner-authorized P2 scope was not reclassified. The source review was **FAIL / HOLD** because one HIGH framework/runtime finding was open. The next review required the exact route correction and route-level evidence before clearing this frozen selection source. No hosted acceptance or promotion claim was made.

## HIGH remediation re-review — 2026-10-10

The earlier FAIL finding and its historical evidence above are preserved. The frozen correction changes only the page boundary: `apps/web/src/app/read/page.tsx` no longer declares `'use client'` and remains an async page awaiting Next.js 15 `searchParams`. The other eight frozen files are unchanged.

Implementation evidence packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-explicit-selection-implementation.md`, SHA-256 `c26e2bcbce011a137a4e916706b444ea8b3aeb1792a163358ed9dd3ec6a42d61`. Its nine-file canonical aggregate is `d5121d717aa91ebb5899c33aa2e057f398c9c488211b89d8c778348ff1414303` (sorted relative path, one ASCII space, raw-file SHA-256, LF, UTF-8). The packet identifies implementation assignment as GPT-6 Luna / Max and packet preparation as GPT-6 Luna / Medium; this independent review uses the assigned GPT-6 Luna / Max configuration stated above.

Updated frozen source pins:

| SHA-256 | File |
| --- | --- |
| `827cdd32eaf895b654a14b2ec8f00ecf18e155fe7dea41eb05d6cdc2e274d033` | `apps/web/src/app/read/page.tsx` |
| `fa380a4200cda329b6e9daa988d80998ecf805226bfe8bc8b18a9f610d82273b` | `apps/web/src/features/library/LibraryView.tsx` |
| `7893fb61710a0928b0e60329c34f1c93bd2c85fce43975fd15e344d6eaf198a8` | `apps/web/src/features/read/InteractiveReader.tsx` |
| `f19c7b8f04b620bb2a0ff45138f7ae6530cb839827271d518e84186c3fcebbcb` | `apps/web/src/features/read/useReaderSession.ts` |
| `eaa1422c20c08e2ef399c1a8eb4434e736f30a632b319e5bb25bf3907b920c26` | `apps/web/src/features/today/adapters.ts` |
| `e065b7fd0893c3a9fc732a59e95ab029f0dca6d45a61ab21ed8bb3091b5ff642` | `tests/frontend/reader-explicit-selection.test.tsx` |
| `c8ba17092e670d519b46f4dbf48449faea19545cb3546e71dd68b7230e2bd439` | `tests/frontend/task-library-001-library-live.test.tsx` |
| `1aefff65d59d37d8e20b6f2828c2e99ab1960f20674ffe15be797365945509ac` | `tests/frontend/task-read-001-reader-live.test.tsx` |
| `f8ed7633142ce53dd20a09da89ac23ccb3a0557dd046caa7cf04ae59a57258db` | `tests/frontend/task011-today-live.test.tsx` |

All nine raw file hashes were independently recomputed and match the remediation pins. The installed Next.js package resolved to 15.5.24. The existing production build artifacts include `/read/page` in the App Router route manifest. The compiled `/read/page_client-reference-manifest.js` lists `InteractiveReader.tsx` among its client modules and does not list `app/read/page.tsx`; this supports that the corrected page is classified as a Server Component while its interactive child remains client-side.

I started the existing local production build and made direct HTTP GET requests to `/read` and `/read?contentId=20000000-0000-4000-8000-000000000032`. Both returned HTTP 200, and neither response contained the async Client Component error text. This is an unauthenticated route check only. The implementation worker separately reports that its isolated Playwright check, with non-local requests blocked and `/api` answered by a synthetic 401, reached the auth gate on both URLs without the async-client error. The worker also reports the production build, focused 76-test suite, typecheck, lint, and diff checks passed; these were not rerun for this single-directive remediation.

**HIGH finding closed for the exact nine-file selection source set.** The review verdict for this source-only slice is now **PASS, with verification limits**: no HIGH or BLOCKER remains in the reviewed selection source. The route check reaches only the unauthenticated auth gate; it does not prove authenticated Reader rendering, selected-content fetch, or a learner journey. React 418 in the synthetic unauthenticated browser path is separately tracked auth-hardening evidence and was not bypassed or changed here. Normal-auth hosted verification remains a later, separately gated acceptance requirement. This closure does not claim hosted acceptance, learner benefit, integration of any later harness adaptation, or promotion.
