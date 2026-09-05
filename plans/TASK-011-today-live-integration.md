# Implementation Plan: TASK-011 — Today Live Frontend Integration

Status: READY_FOR_REVIEW
Outcome: Implemented and fully verified against quality gates

## 1. Overview & Objective
Implement live Today frontend integration connecting an authenticated, product-ready learner to:
1. The authoritative Today plan via `GET /v1/today`
2. Server-authoritative plan and activity presentation via dedicated adapter
3. Authoritative activity completion via `POST /v1/today/{planId}/activities/{activityId}/complete`
4. Strict preservation of server plan ID, item order, item types, and durations (zero client-side ranking or heuristics)
5. Robust actor lifecycle isolation (`isCurrentActor`, `LinguaActorAbortedError`, epoch tracking)
6. Same-actor request sequence racing protection
7. Loading / empty / error / retry states with zero fake evidence generation

## 2. Invariants & Guardrails
- **Zero backend/contract/database diff**: Absolutely no changes in `services/`, `database/`, or `contracts/`.
- **Server authority**: Client performs zero Today scoring/ranking, review priority, FSRS due state, novelty windows, unseen concept caps, content reserve minutes, learning evidence, competence, mastery, or timezone-derived planning logic.
- **No fake evidence**: Merely loading, rendering, or clicking activity cards on Today does NOT write learning events, review events, or competence evidence.
- **Exact item order**: The server-provided array order of activities is strictly preserved without client-side reordering.
- **Authoritative completion**: If `completeTodayActivity` is called, it requires server confirmation before marking an item complete. On failure, state is rolled back and an error is surfaced without optimistic corruption.
- **Actor lifecycle isolation**: An in-flight load or completion for Actor A must never mutate Actor B UI, plan, error, or loading states.
- **Same-actor race protection**: If request #1 resolves after request #2 has already succeeded, request #1 is silently dropped.

## 3. Architecture & File Structure

### A. Presentation Adapter (`apps/web/src/features/today/adapters.ts`)
- Pure DTO-to-view-model mapping:
  - `TodayPlanDto` -> `TodayPlanViewModel`
  - `TodayActivityDto` -> `TodayActivityViewModel`
- Calculates presentation-only derived fields (`progressPercent`, `badgeVariant`, `badgeLabel`, `targetUrl`, `completed`).
- Preserves exact server array ordering: `plan.activities.map(mapTodayActivity)`.

### B. Live Today Plan Hook (`apps/web/src/features/today/useTodayPlan.ts`)
- Manages:
  - `plan: TodayPlanViewModel | null`
  - `isLoading: boolean`
  - `error: Error | null`
  - `completingActivityIds: ReadonlySet<string>`
  - `actionError: Error | null`
  - `alertMessage: string | null`
  - `refetch: () => Promise<void>`
  - `completeActivity: (activityId: string, durationSeconds?: number) => Promise<void>`
- Sequence ref (`sequenceRef`) for same-actor race protection.
- Actor epoch and ID checking (`isCurrentActor`, `getActorEpoch`) across all async steps.
- Actor switch effect resetting state cleanly upon user identity transitions.
- Discards `LinguaActorAbortedError` silently without surfacing user-facing error banners.
- In-flight duplicate prevention for activity completion.

### C. Today Dashboard Component (`apps/web/src/features/today/TodayDashboard.tsx`)
- Integrates `useTodayPlan`.
- Supports backwards-compatible props: `initialPlan`, `initialTargetMinutes`, `initialCompletedMinutes`, `initialStreakDays`, `initialMemoryHealth`, `forcedState`, `forcedErrorCode`, `onActivityStart`, `apiClient`.
- Full state rendering:
  - Loading: `<LoadingState message="Đang tải kế hoạch học tập hôm nay..." />`
  - Error: `<ErrorState code={errorCode} onRetry={refetch} />`
  - Empty: `<EmptyState ... />`
  - Active / Completed Plan: Header, daily progress bar, activities timeline, completion buttons with busy/disabled state, and Language Brain preview link.

### D. Verification Suite (`tests/frontend/task011-today-live.test.tsx`)
- `TEST-011-01` .. `TEST-011-06`: Plan loading, adapter fidelity, loading authority, error handling, retry, persisted re-entry.
- `TEST-011-07` .. `TEST-011-10`: Actor lifecycle isolation (A cannot mutate B, A error cannot contaminate B, stale request #1 cannot overwrite #2, stale finally cannot clear loading state).
- `TEST-011-11` .. `TEST-011-14`: Authority invariants (exact item order, zero local sorting, zero fake evidence, timezone authority).
- `TEST-011-TZ-01` .. `TEST-011-TZ-05` (TIMEZONE-011-R1): Timezone authority (stored timezone parameter, browser timezone suppression, setup-required fail-closed UI, actor switch isolation, reactive profile update).
- `TEST-011-COMP-01` .. `TEST-011-COMP-06`: Completion semantics (exact parameters, duplicate suppression, authoritative update, failure rollback, actor isolation, idempotent replay).

## 4. Verification Plan
- `pnpm test` (full suite passes, 427+ tests)
- `pnpm typecheck` (0 errors)
- `pnpm lint` (0 warnings/errors)
- `pnpm build-storybook`
- `pnpm build`
- `git diff f679425..HEAD -- contracts services database` strictly empty

## 5. Verification Results
- `vitest run tests/frontend/task011-today-live.test.tsx`: 25/25 passed (including TEST-011-TZ-01..05)
- `vitest run tests/frontend/contracts.test.ts`: 41/41 passed
- `vitest run tests/frontend/e2e/tier5-adversarial-hardening.test.tsx`: 20/20 passed
- `pnpm test`: 427/427 passed across all 34 test files
- `pnpm typecheck`: 0 errors across 4 workspace packages
- `pnpm lint`: 0 errors, 0 warnings
- `pnpm build-storybook`: clean build in 12s
- `pnpm build`: clean Next.js 15 production build
- `git diff f679425..HEAD -- contracts services database`: strictly empty (0 lines modified)
