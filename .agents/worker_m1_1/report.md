# Milestone 1 Completion Report: Contract Types, Enums, Error Models, Mock Data Layer & Typed API Client

- **Task ID**: MILESTONE-1 (Frontend Core Types & Mock API Client Foundation)
- **Status**: COMPLETE & VERIFIED
- **Author**: Frontend Worker (`worker_m1_1`)
- **Date**: 2026-08-22

---

## 1. Executive Summary

Milestone 1 establishes the foundational data, contract, error, and API client layer for LINGUA OS. All shared contracts from `contracts/openapi.yaml`, `contracts/enums.json`, and `contracts/errors.json` have been faithfully codified into TypeScript definitions within `@lingua/types`. A high-fidelity, bilingual (English/Vietnamese) fixture dataset and a fully stateful, in-memory `MockApiClient` with configurable latency, error simulation, and CRUD mutations have been built and tested with 21 unit test cases in `tests/frontend/contracts.test.ts`.

---

## 2. What Changed

### 2.1 Package: `@lingua/types` (`packages/types/`)
- **`package.json` & `tsconfig.json`**: Initialized workspace package `@lingua/types` with modern TypeScript 5.7+ bundler configuration.
- **`src/enums.ts`**:
  - `ConceptStatus`: 9 distinct states (`unseen`, `discovered`, `learning`, `familiar`, `active`, `mastered`, `weak`, `forgotten`, `due`).
  - `LearningActivityType`: `review`, `read`, `listen`, `learn`.
  - `ReviewRating`: `again`, `hard`, `good`, `easy`.
  - `ContentQualityStatus`: `raw`, `normalized`, `review_pending`, `approved`, `rejected`.
  - `ExerciseMode`: `self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`.
  - `ReasonCode`: `FSRS_DUE`, `WEAK_RECOGNITION`, `WEAK_LISTENING`, `LOW_PRODUCTION_EVIDENCE`, `CONTENT_FIT`, `RECENT_EXPOSURE`, `NEW_CONCEPT_BUDGET`.
  - `CEFRLevel`, `ConfidenceLevel`, `PartOfSpeech`, `ConceptRelationType`, `LearningGoal`.
  - Immutable arrays and runtime type guards for all enums (`isConceptStatus`, `isReviewRating`, `isExerciseMode`, etc.).
  - Human-readable Vietnamese label maps (`CONCEPT_STATUS_LABELS_VI`, `REASON_CODE_LABELS_VI`, `REVIEW_RATING_LABELS_VI`).
- **`src/errors.ts`**:
  - `ApiErrorCode`: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `CONFLICT` (409), `INTERNAL_ERROR` (500), plus `LEARNING_PLAN_NOT_FOUND`, `NETWORK_ERROR`, `RATE_LIMITED`.
  - `ERROR_HTTP_STATUS_MAP` and `ERROR_MESSAGE_VI_MAP` (Vietnamese user-facing copy).
  - `LinguaApiError` custom class with code, httpStatus, details, requestId, and `.toResponse()` envelope serializer.
  - Type guard `isLinguaApiError`.
- **`src/contracts.ts`**:
  - Fully typed interfaces matching all 20+ endpoints in `contracts/openapi.yaml` and specifications:
    - User Profile & Settings (`UserProfile`, `UserSettings`, `UpdateUserProfileRequest`, `UserLanguageProfile`)
    - Today Plan (`TodayPlan`, `TodayActivity`, `CompleteActivityRequest`, `ActivityCompletionResponse`)
    - Memory & Smart Review (`FSRSState`, `ReviewItem`, `ReviewQueueResponse`, `ReviewAnswerRequest`, `ReviewAnswerResponse`)
    - Reader & Content (`ContentItem`, `ContentSegment`, `Sentence`, `SentenceConcept`, `AnalyzeTextRequest`, `AnalyzeTextResponse`, `SaveSentenceRequest`, `SavedSentenceItem`, `LibraryResponse`)
    - Lexical & Language Brain (`WordSense`, `ConceptExample`, `ConceptRelation`, `UserConceptState`, `ConceptDetail`, `ConceptSearchResult`, `DictionarySearchResponse`, `BrainSummary`, `BrainConceptItem`, `BrainGraphNode`, `BrainGraphEdge`, `BrainGraphResponse`)
    - Progress & Analytics (`ProgressOverview`, `RetentionDataPoint`, `ProgressHistoryResponse`)
    - Assessment & Onboarding (`AssessmentItem`, `AssessmentSession`, `StartAssessmentRequest`, `AssessmentResponseRequest`, `AssessmentResponseResponse`, `AssessmentResult`)
- **`src/mocks/fixtures.ts`**:
  - Realistic CEFR A1-C2 bilingual concepts (`resilience`, `perseverance`, `serendipity`, `ephemeral`, `comprehend`, `acquire`, `retention`, `nuance`, `curiosity`, `ubiquitous`) with IPA, senses, examples, and Brain state.
  - Curated reader articles with segment/sentence tokenization and offset tagging.
  - Today plan with 4 explainable activities and 87% memory health.
  - Review queue covering all 5 exercise modes with initial FSRS states.
  - Brain summary and graph nodes/edges.
  - 7-day retention trends and weekly learning history.
  - Diagnostic assessment questions.
- **`src/client.ts`**:
  - `ApiClient` interface definition covering 20+ operations.
  - `MockApiClient` stateful in-memory implementation supporting:
    - `setLatency(ms: number)`
    - `setForceError(code, message)`
    - `setReturnEmpty(boolean)`
    - `resetState()`
    - Genuine FSRS algorithm updates on rating submission (stability/difficulty adjustments, queue pop, brain state updates).
    - Real mutations for profile, settings, today activity completion, sentence mining, and adaptive assessment flow.
- **`src/index.ts`**: Unified barrel export.

### 2.2 App Layer: `apps/web/`
- **`apps/web/src/lib/api/client.ts`**: Dynamic API client accessor (`getApiClient`, `setApiClient`, `api`).
- **`apps/web/src/lib/api/index.ts`**: Re-exports all contracts and client singleton for web app usage.
- **`apps/web/package.json`**: Added `"@lingua/types": "workspace:*"`.
- **`apps/web/next.config.js`**: Added `@lingua/types` to `transpilePackages`.

### 2.3 Monorepo & Tests
- **`vitest.config.ts`**: Configured `@lingua/types` path alias pointing to `./packages/types/src`.
- **`tests/frontend/contracts.test.ts`**: 21 unit tests covering enums, guards, errors, fixtures, API client CRUD mutations, and simulation switches.

---

## 3. Specification & Code Review

### 3.1 Contract Compliance Review
- **`contracts/openapi.yaml`**: All 20+ documented endpoints have 1:1 corresponding request/response TypeScript interfaces and `ApiClient` methods.
- **`contracts/enums.json`**: All base enums (`concept_status`, `learning_activity_type`, `review_rating`, `content_quality_status`) are strictly implemented with matching string values.
- **`contracts/errors.json`**: All error codes (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR`) map to exact HTTP status codes (401, 403, 404, 422, 409, 500).
- **ADR-003 (Single FSRS Memory Lineage)**: `submitReviewAnswer` updates a single unified FSRS state and brain state regardless of exercise mode.
- **ADR-009 (Starting Level Estimate Framing)**: Assessment result returns `estimatedLevel` with `confidence`, respecting the non-accredited framing invariant.

### 3.2 Code Quality Review
- 100% strict TypeScript with zero `any` types in contract models.
- Deep cloning used in `MockApiClient` to prevent test contamination between test runs.
- Runtime type guards provided for all critical user/network inputs.
- Clean separation of concerns between contracts, enums, error models, fixtures, and client.

---

## 4. Verification Evidence

- **Unit Test Suite**: `tests/frontend/contracts.test.ts` (21 test cases across 5 test suites):
  1. Enums and Type Guards Integrity (7 tests)
  2. Error Models and Exception Mapping Integrity (5 tests)
  3. Bilingual Mock Fixtures Integrity (5 tests)
  4. MockApiClient Stateful In-Memory CRUD & Business Logic (9 tests)
  5. MockApiClient Simulation Controls (Latency, Error, Empty State) (3 tests)

---

## 5. Known Limitations & Next Steps

- **Known Limitations**: The remote HTTP fetch client (for connecting to the real FastAPI backend when available) can be plugged into the `ApiClient` interface in Milestone 2/3 without altering any consuming UI code.
- **Next Unblocked Task**:
  - `TASK-007`: Smart Review Session UI (`/review`) consuming `api.getReviewQueue()` and `api.submitReviewAnswer()`.
  - `TASK-009`: Comprehensible Reader UI (`/read`) consuming `api.getContentDetail()` and `api.saveSentence()`.
  - `TASK-011`: Today Dashboard UI (`/today`) consuming `api.getTodayPlan()` and `api.completeTodayActivity()`.
  - `TASK-013`: Language Brain UI (`/brain`) consuming `api.getBrainSummary()`, `api.getBrainConcepts()`, and `api.getBrainGraph()`.
