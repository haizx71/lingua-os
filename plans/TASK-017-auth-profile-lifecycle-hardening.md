# TASK-017 Controlled Hardening Plan & Implementation Record

Date: 2026-09-04
Baseline Commit: `31b1cd39305d128facd35698a4d732b9d507e720`
Status: COMPLETE — READY FOR INDEPENDENT REVIEW

## Scope & Non-Negotiables

Hardening of TASK-017 live integration findings C-1 through C-6 under architecture freeze adjudicated by GPT-5.6 Sol:
- No `onboardingCompleted` synthetic boolean
- No persisted skip flags
- No fake A0 estimates
- No client-side scoring or FSRS math
- No client-side ETag hashing
- No single-resource language profile endpoints
- Preserve TASK-017A child ETags and collection discovery
- Preserve 412 refetch and intentional resubmission
- Today surface remains contract mock

## Slices Implemented

### Slice A: Actor Runtime Isolation & Actor-Scoped Pointer (C-2, C-1)
- `packages/types/src/errors.ts`: Added `LinguaActorAbortedError` (`code: 'ABORTED'`), `isLinguaActorAbortedError`, and updated error normalization.
- `packages/types/src/client.ts`: Extended `ApiClient` interface and `MockApiClient` with `setActor(actorId: string | null)`. Added `currentActorId`, `actorGeneration`, and generation-checked request completion in `HttpApiClient` to abort stale in-flight requests and flush cached ETags on actor switch.
- `apps/web/src/features/auth/AuthContext.tsx`: Synchronized active `user.id` to `getApiClient().setActor` on auth changes and sign-out.
- `apps/web/src/features/onboarding/LiveOnboardingFlow.tsx`: Replaced global storage key with actor-scoped `lingua:starting-level:active-assessment:${userId}`.

### Slice B: Readiness Predicate & Route Gating (C-4, C-3)
- `apps/web/src/hooks/useProductReadiness.ts`: Implemented 6-point readiness predicate (requires authenticated session, non-empty timezone, and active vi→en language profile; unassessed learners are authoritatively ready).
- `apps/web/src/components/auth/AppRouteBoundary.tsx`: Implemented loop-free route gating truth table with loading fallback preserving protected state during bootstrap.
- `apps/web/src/features/onboarding/LiveOnboardingFlow.tsx`: Updated `loadBootstrap` so ready learners without estimates default to `READY_FOR_TODAY` unless `mode=assessment` is explicitly requested in URL query.

### Slice C: Language Profile Conflict Reconciliation (C-5)
- `apps/web/src/features/onboarding/LiveOnboardingFlow.tsx`: Updated `createLanguageProfile` error handling:
  - Catches 409 `CONFLICT` and calls `listMyLanguageProfiles()` to authoritatively discover existing profiles.
  - If active profile found: smoothly adopts it and advances without error banner.
  - If archived profile found: transitions to `LANGUAGE_PROFILE_REQUIRED` showing reactivation UI with its child ETag.
  - If 409 `IDEMPOTENCY_KEY_REUSED`: fails closed with fatal error banner.

### Slice D: Assessment Stimulus Preservation (C-6)
- `packages/types/src/adapters/index.ts`: Added `textSnippet` and `audioUrl` to `OnboardingAssessmentItemViewModel`; mapped from `AssessmentItemDto`.
- `apps/web/src/features/onboarding/LiveOnboardingFlow.tsx`:
  - Renders styled `textSnippet` context block above prompt for reading/grammar items.
  - Implemented accessible `AssessmentAudioPlayer` with play/pause button, keyboard controls, ARIA labels, automatic playback reset on question switch, and non-blocking error alert.

## Tests & Verification
- `http-client.test.ts`: Actor generation, ETag isolation, and stale response abort tests.
- `AppRouteBoundary.test.tsx`: 6 route gating tests (TEST-READY-01 through TEST-READY-05).
- `task017-boundaries.test.ts`: 7 boundary invariant tests including stimulus mapping.
- `task017-live-onboarding.test.tsx`: 21 comprehensive integration tests covering C-1 through C-6 (TEST-PTR-01..05, TEST-LANG-01..06, TEST-STIM-01..05).
