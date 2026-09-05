# TASK-007 — Review Live Frontend Integration Plan

## Objective

Connect the existing Review UI to the authoritative Review backend (`GET /v1/review/queue` and `POST /v1/review/{reviewItemId}/answer`) via `ApiClient` and `useReviewSession`, establishing server-authoritative queue loading, explicit answer ratings, stable idempotency recovery, duplicate click suppression, and multi-actor lifecycle isolation. Zero client-side FSRS calculations, zero intervals or due date derivations, and zero fake learning evidence.

## Frozen Contract & Backend Invariants

### Endpoints
1. `GET /v1/review/queue` (`listReviewQueue`):
   - Query: `cursor?: string`, `limit?: number`, `languageProfileId?: string`
   - Response: `ReviewQueueResponseDto` (`data: ReviewQueueItemDto[]`, `meta: CursorResponseMetaDto`)
2. `POST /v1/review/{reviewItemId}/answer` (`answerReviewItem`):
   - Path: `reviewItemId: string` (UUID)
   - Headers: `Idempotency-Key: string` (UUID)
   - Body: `ReviewAnswerRequestDto` (`rating: ReviewRating`, `responseTimeMs: number`, `correct?: boolean`, `responseText?: string`, `selectedOptionId?: string`)
   - Response: `ReviewAnswerResponseDto` (`data: ReviewAnswerResponseDto['data']`, `meta: ResponseMetaDto`). No Review ETag / If-Match requirement.

### Invariants
- Memory Engine owns FSRS; exactly one scheduling lineage per learner × concept.
- Review transaction is atomic backend-side.
- Button click ≠ successful Review transition: UI only advances after server confirms success.
- One logical learner answer = one stable idempotency key (survives transport retry).
- New review item = new idempotency key.
- Actor isolation: capture `actorEpoch` and `actorId` on every async step; stale operations cannot mutate active actor state.
- Zero client-side FSRS stability/difficulty/interval math, due computation, or competence inference.

## Proposed Changes

### 1. `apps/web/src/features/review/adapters.ts` [NEW]
- Pure DTO-to-view-model presentation mapping.
- `mapReviewQueueItemToViewModel(item: ReviewQueueItemDto): ReviewCardItem`:
  - Preserves exact `reviewItemId`, `conceptId`, `term`, `ipa`, `pos`, `prompt`, `contextSentence`, `contextTranslationVi`, `status`, `isDue`, `dueText`, `exerciseMode`.
- `mapReviewAnswerResultToViewModel(result: ReviewAnswerResponseDto['data'])`:
  - Preserves backend feedback/count/memory display state; missing feedback gets a neutral acknowledgement, not a rating-derived scheduling claim.

### 2. `apps/web/src/features/review/useReviewSession.ts` [NEW]
- Live hook coordinating:
  - Queue loading (`api.listReviewQueue()`).
  - Sequence ref (`sequenceRef.current`) for same-actor race suppression.
  - Actor lifecycle (`useOptionalAuth()`, `getActorEpoch`, `isCurrentActor`, `LinguaActorAbortedError`).
  - Active review item and index pointer.
  - Synchronous in-flight token locking plus `isSubmitting` presentation state.
  - Stable idempotency key tracking:
    - Retries of the same answer attempt reuse the same key.
    - Subsequent cards generate a new key (`crypto.randomUUID()`).
  - Ambiguous failure tracking (`pendingRetryOperation`).
  - Response time tracking (`cardStartTimeRef`).
  - Server-authoritative advancement upon 200 OK.
  - Rollback / failure isolation: retains current card and surfaces actionable error on failure.

### 3. `apps/web/src/features/review/ReviewSession.tsx` [MODIFY]
- Wire `useReviewSession` into `ReviewSession`:
  - Consumes live hook when in configured auth or when `apiClient` is provided.
  - Backward-compatible props: `initialQueue`, `forcedState`, `forcedErrorCode`, `onRatingSubmit`, `onSessionComplete`.
  - Replaces arbitrary `setTimeout` in `handleRetry` with `refetch()`.
  - Disables rating buttons and space reveal while submitting (`aria-busy="true"`).
  - Renders retry button on ambiguous or network failure.
  - Renders server-provided remaining count and progress.

### 4. `apps/web/src/features/review/index.ts` [MODIFY]
- Export `ReviewSession`, `useReviewSession`, and adapters.

### 5. `tests/frontend/http-client.test.ts` [MODIFY]
- Add real transport tests for:
  - `listReviewQueue`: verifies GET `/v1/review/queue`, query serialization, Bearer auth header, and no userId/actorId leakage.
  - `answerReviewItem`: verifies POST `/v1/review/{id}/answer`, JSON body, `Idempotency-Key` header, Bearer auth header, and no userId leakage.

### 6. `tests/frontend/task007-review-live.test.tsx` [NEW]
- Preserve and correct the original 22-test suite:
  - `TEST-007-01..06`: Queue loading, server order, loading state, error retry, empty/completed state.
  - `TEST-007-07..11`: Explicit answer submission, no auto-mutation on mount/hover, pending locking, server advancement, failure rollback.
  - `TEST-007-12..16`: Idempotency key lifecycle, retry key reuse, fresh key on card advance, ambiguous failure and answer response advancement.
  - `TEST-007-17..20`: Actor switch, stale queue/answer success and signout.
  - `TEST-007-21..22`: Actual same-actor refetch race and server count/feedback authority.
- Add 13 recovery/lifecycle/audio regressions (35 Review tests total): reload/retry receipt,
  immediate duplicate calls, historical replay count reconciliation, queue exhaustion refresh,
  storage failure, same-actor stale answer, cursor order/cycle rejection, neutral feedback,
  stale A success/error/finally while B submits, same-actor refresh, explicit supplied audio.

## Recovered implementation, 2026-09-06

- Starting HEAD: `c6bebbf`; continue eight pre-existing uncommitted files, never reset/revert.
- Dependencies TASK-009 Mini and TASK-011 are accepted. User explicitly authorizes Codex to
  finish this bounded frontend integration; no backend/schema/contract edits.
- Query dependencies use primitive fields, preventing repeat renders from restarting requests.
- Queue loading follows opaque cursors in exact server order to exhaustion before presenting a
  complete queue. Missing/repeated cursor and duplicate item anomalies fail closed.
- `pendingAnswer.ts`: LOCAL_ONLY sessionStorage receipt keyed by actor and language-profile scope.
  Only item ID, explicit rating, measured response time and UUID key; no tokens, profile contents,
  Memory/competence state or fake events. Persist before dispatch; validate on read; fail closed
  on unavailable/corrupt storage. Same-tab reload/re-entry restores the receipt but never auto-POSTs.
- Ambiguous outcomes block a new rating. Explicit retry reuses the exact key and body. A successful
  retry refreshes the queue because replay count/snapshot can be historical. Receipt clears only
  after validated success; a definitive rejection remains fail-closed rather than minting a key.
- Epoch + actor + request sequence + mounted guard protect asynchronous commits. Token-owned
  finally cannot clear a newer operation's busy state. Same-actor token refresh preserves work.
- Preview fixtures remain for isolated tests/catalog usage. Configured product mode does not
  silently use MockApiClient. Existing route readiness/auth boundary is unchanged.
- Supplied audio playback replaces the preview timer, stops on actor/card change, never creates
  learner evidence, and respects reduced motion. GSAP timeline/parameters are unchanged.
- Lifecycle/recovery orchestration stays in the hook; React consumes view models, not raw DTOs.
- Completion target: READY_FOR_REVIEW, not DONE. First Real Learning Loop is outside this task.

## Verification Plan

### Automated Tests
```bash
pnpm test tests/frontend/http-client.test.ts
pnpm test tests/frontend/task007-review-live.test.tsx
pnpm test
pnpm contracts:check-generated
pnpm typecheck
pnpm lint
pnpm build-storybook
pnpm build
git diff c6bebbf..HEAD -- contracts services database
git diff -- contracts services database
```
