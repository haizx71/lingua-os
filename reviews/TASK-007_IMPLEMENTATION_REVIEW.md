# TASK-007 — Recovered implementation and verification

Date: 2026-09-06. State: **READY_FOR_REVIEW**, not DONE.
Starting HEAD: `c6bebbf`. No reset, revert, checkout-over-changes or remote push.

## Recovery

Eight files already contained interrupted work:

- `apps/web/src/features/index.ts`
- `apps/web/src/features/review/ReviewSession.tsx`
- `apps/web/src/features/review/adapters.ts` (untracked)
- `apps/web/src/features/review/index.ts` (untracked)
- `apps/web/src/features/review/useReviewSession.ts` (untracked)
- `tests/frontend/http-client.test.ts`
- `tests/frontend/task007-review-live.test.tsx` (untracked)
- `plans/TASK-007-review-ui-integration.md`

The previous implementation had the live ApiClient calls, view-model adapter, answer UI,
in-memory retry key, queue sequence and basic actor guards, plus 22 Review and two HTTP tests.
These were continued, not discarded. `pendingAnswer.ts` was added for LOCAL_ONLY recovery.
Typecheck/build also updated the already tracked `apps/web/tsconfig.tsbuildinfo`; that generated
cache is deliberately left unstaged, not reverted and not part of the implementation commits.

## Failures and root causes

- The reported 40/41 result was not reproduced initially: the recovered suites first exposed
  18 failures, mostly duplicate text selectors (heading and ConceptChip), provisional DTO fixture
  fields and incorrect error construction. The adapter imported a nonexistent generated alias.
- TEST-007-19 incorrectly expected an A-named concept to disappear even though B's fixture used
  the same concept. B now has a distinct fixture and its state is positively asserted.
- TEST-007-21 rerendered identical props instead of issuing a second request. It now calls the
  real hook refetch and asserts the newer result after the old promise settles.
- Live auth loading could issue an extra injected-client queue request. Query object identity
  also caused an infinite loading loop with languageProfileId. Both implementation causes were fixed.
- The adapter confused context translation with prompt meaning. Both are now separately preserved
  and asserted. No provisional concept.term fallback or rating-derived scheduling copy remains.
- Added red/green tests exposed missing reload receipts, immediate duplicate suppression,
  same-actor answer invalidation, cursor traversal and historical replay-count reconciliation.
- At the 461/462 checkpoint, TEST-007-09 fired Space after the DOM commit but before passive
  keyboard effect installation under the full-suite workload. An awaited React act boundary now
  flushes installation before keypress; both post-keypress assertions remain synchronous. No sleep,
  relaxed assertion, deleted test or test.skip was introduced. The audio fixture also awaits actor
  transition completion to avoid test-only unwrapped-act warnings.

## Contract and lifecycle review

| Area | Review evidence / result |
| --- | --- |
| Contract | GET `/v1/review/queue` with optional cursor/limit/languageProfileId; POST `/v1/review/{reviewItemId}/answer`; UUID Idempotency-Key; body rating + responseTimeMs. No ETag/If-Match, invented DTO/path or generated schema edits. |
| Layering | Existing generated DTOs and shared ApiClient feed feature adapters; React consumes Review view models. Shared transport production code is unchanged. |
| Answer authority | Only learner button/keyboard actions create answers. No optimistic advance; validated response ID, server feedback/count. Memory and competence calculations remain backend-only. |
| Retry | One UUID and exact frozen rating/time payload. Pending outcomes block alternative answers; explicit retry only. No automatic mutation during mount/re-entry. |
| Reload | Receipt is written before dispatch and validated on read; actor/profile scoped. Successful replay triggers fresh queue read because its stored count can be historical. |
| Actor isolation | Epoch + actor + mount + request sequence checked after awaited operations and on errors/finally. Token-owned cleanup cannot clear B's busy state. Same-actor refresh preserves the operation. |
| Same actor | Stable primitive query dependencies avoid render loops. Refetch supersedes old reads/answer continuations while retaining pending recovery identity. |
| Pagination | Opaque cursor traversal preserves server order, rejects missing/repeated cursors and duplicate items. No offset or client ranking. Snapshot exhaustion with remaining work refreshes reads. |
| Errors | Machine-code mapping; raw exception/database text is not rendered. Corrupt/unavailable receipt storage fails closed. |
| Regression | Existing GSAP choreography, design tokens, accessibility and backend-ownership suites remain. Audio uses supplied URL on explicit click, stops on actor/card change and produces no evidence. |
| Boundaries | No contracts/services/database/migration diff; no FSRS, competence, placement, Today or new learning-loop implementation. |

Spec-compliance and five-axis code review completed against the current diff. No required issue
identified in the reviewed flows; independent milestone acceptance is still required.

## Verification

| Command | Actual result |
| --- | --- |
| Focused TEST-007-09 verbose selection | PASS, 1 selected test; other tests filtered only for diagnosis |
| Focused Review + HTTP verbose | PASS, 48/48 (35 + 13), two files |
| `pnpm contracts:check-generated` | PASS, openapi-typescript 7.9.1 |
| `pnpm typecheck` | PASS, all three workspace packages |
| `pnpm lint` | PASS, zero warnings |
| `pnpm test` | PASS, 466/466 across 35 files, no skipped/todo |
| `pnpm build-storybook` | PASS, 1,729 modules; static output generated |
| `pnpm build` | PASS, Next.js 15.5.23, 15/15 static pages |
| `git diff --check` | PASS |
| Diff from `c6bebbf` and worktree for contracts/services/database | ZERO |

Count accounting: accepted baseline 429/34 files + 35 new Review tests + two HTTP tests =
466/35 files. No accepted baseline tests were removed.

Non-failing existing tooling diagnostics remain: controlled-input fixture warning, JSDOM media
pause warning in TASK-017, Storybook directive/sourcemap/eval/chunk warnings and the Next.js ESLint
plugin warning. These are not reported as warning-free builds.

## Limitations / handoff

- Verification uses deterministic ApiClient fixtures and real HttpApiClient serialization with
  stubbed fetch. It does not claim a live authenticated browser → FastAPI → PostgreSQL learning loop.
  Chrome DevTools MCP is unavailable; no real-browser acceptance is claimed.
- Receipt retention is same-tab sessionStorage (cleared on successful confirmation or tab-session
  removal), not cross-device sync. No auth secrets or Memory/competence state are stored there.
- Definitive rejection/corrupt receipt remains fail-closed; the UI never silently discards an
  uncertain answer or invents a replacement key. No cross-tab concurrent review coordinator is added.
- Isolated preview fixtures remain for legacy UI tests/catalog use, not configured live fallback.
- No backend suite rerun: backend/schema/contracts are unchanged. First Real Learning Loop is not
  started. Next action is independent TASK-007 review only.
