# LINGUA OS — Comprehensive Frontend Specification & Contract Survey Report

- **Author**: Specification & Contract Miner (`survey_specs_1`)
- **Date**: 2026-08-22
- **Status**: APPROVED COMPREHENSIVE SURVEY
- **Scope**: Frontend Web (`apps/web`), UI Components (`packages/ui`), Shared Contracts (`contracts/`), Design System (`design-system/`)

---

## 1. Executive Summary & Authority Hierarchy

LINGUA OS is an intelligent, calm, and evidence-centered language learning workspace tailored for Vietnamese learners studying English from A0 to B1 within a 20–30 minute daily commitment.

### 1.1 Source-of-Truth Hierarchy
Per `MASTER_PROJECT.md` §6 and `DECISIONS.md`, when requirements conflict, resolve in strict order:
1. `MASTER_PROJECT.md` (Master Product Contract)
2. `DECISIONS.md` (Accepted ADRs: ADR-001 through ADR-013)
3. `contracts/openapi.yaml`, `contracts/enums.json`, `contracts/errors.json`
4. `docs/CODEX_PROJECT_SPEC.md` (Backend & domain logic specifications)
5. `docs/GEMINI_PROJECT_SPEC.md` (Frontend & UI/UX specifications)
6. `docs/UI_UX_SKILL_POLICY.md` & `design-system/MASTER.md`
7. `TASKS.md` (Execution backlog & dependencies)

### 1.2 Core MVP Guardrails & Invariants
- **Primary Learning Loop**: Today → Reader → Language Brain → Smart Review → Progress.
- **Single FSRS Memory Lineage (ADR-003)**: One primary FSRS schedule per user+concept. Modalities (recognition, listening, cloze, production) provide distinct evidence streams but update one combined memory queue.
- **Language Brain Visibility (ADR-002)**: Real-time visualization of known, learning, and weak concepts across 3 skill dimensions (Recognition, Listening, Production) with confidence and memory health %.
- **Starting Level Estimate (ADR-009)**: Diagnostic onboarding is an *estimate with confidence*, never an official CEFR certificate.
- **Strictly Deferred Features (ADR-004, ADR-005, ADR-006)**: AI Tutor (`/tutor`), Speak Lab & Real-time Pronunciation (`/speak`), Chinese/Japanese modes, and Social/Gamification (gems, XP leaderboards, casino rewards) MUST NOT appear in MVP navigation or routes.
- **Accessibility by Default**: WCAG 2.2 AA compliance, keyboard navigation, visible focus rings, non-color-only state indicators, and `prefers-reduced-motion` support.

---

## 2. Features Discovered & Probe Matrix

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Navigation | Primary Navigation Shell | 5-item responsive nav: Today, Read, Review, Brain, Progress | Active route pathname | Rendered bottom nav (<768px), tablet rail (768-1199px), desktop sidebar (>=1200px) | Fallback to Today route if invalid route | `GEMINI_PROJECT_SPEC.md` §4, §5 |
| 2 | Navigation | Secondary Navigation Group | Docked access to Library, Dictionary, Settings, Profile | User click / tap | Route change or slide-over drawer | Graceful route fallback | `GEMINI_PROJECT_SPEC.md` §4 |
| 3 | Navigation | Learning Focus Mode | Distraction-free full-screen UI hiding sidebar/bottom nav during Review/Assessment | `focusMode: boolean` prop | Minimal top bar (Exit, Progress bar) + Card surface | Exit confirmation modal before discarding in-flight session | `GEMINI_PROJECT_SPEC.md` §5, `AppShell.tsx` |
| 4 | Onboarding | Multi-step Profile Setup | Setup native language (VI), target (EN), goal, daily time budget (10/20/30/45m), self-estimate | Form selections | Updated user language profile via `POST /v1/me/languages` | Inline validation error with retry | `GEMINI_PROJECT_SPEC.md` §13 |
| 5 | Assessment | Starting Level Estimate | Bounded adaptive diagnostic test measuring lexical/reading/listening ability | Question responses | Estimated starting level (e.g. A2), confidence (`low`/`medium`/`high`), assessed skills | Retry turn on network error; no test abortion | `GEMINI_PROJECT_SPEC.md` §14, `CODEX_PROJECT_SPEC.md` §11 |
| 6 | Today | Daily Plan Dashboard | Daily learning plan displaying total time (e.g., 25 min), 4 activities with explainable reasons | User profile & time budget | `TodayPlan` with activity cards, memory health badge, primary CTA | Empty state with "Generate Plan" button; error banner with retry | `GEMINI_PROJECT_SPEC.md` §15, `CODEX_PROJECT_SPEC.md` §10 |
| 7 | Today | Explainable Activity Card | Action card displaying activity type, title, duration, badge, and human-readable reason | Activity item object | Formatted card with Start button and reason text (e.g. *"Ôn vì sắp quên"*) | Default fallback reason text if code unknown | `GEMINI_PROJECT_SPEC.md` §15 |
| 8 | Today | Activity Completion | Marks an activity completed and updates Today progress | Activity ID, `Idempotency-Key` | Updated activity status (`completed`), refreshed daily progress bar | Retry prompt with cached state | `CODEX_PROJECT_SPEC.md` §15 |
| 9 | Review | Smart Review Queue | Due memory review queue ordered by FSRS urgency | `GET /v1/review/queue` | Array of `ReviewItem` with prompt, target concept, and exercise mode | Empty state ("Không có từ đến hạn ôn") | `GEMINI_PROJECT_SPEC.md` §16, `CODEX_PROJECT_SPEC.md` §9 |
| 10 | Review | Exercise Modes Presentation | 5 presentation modes: `self_recall`, `multiple_choice`, `typing`, `cloze`, `listening` | Exercise mode config | Interactive card with reveal/input/audio playback controls | Mode fallback to self-recall if payload malformed | `GEMINI_PROJECT_SPEC.md` §16 |
| 11 | Review | FSRS Rating Submission | 4-tier memory feedback (`again`, `hard`, `good`, `easy`) updating single FSRS lineage | Rating, latency ms, correctness, `Idempotency-Key` | Next review item + updated FSRS state (`stability`, `due_at`) | Network retry queue without duplicate rating | `GEMINI_PROJECT_SPEC.md` §16, `CODEX_PROJECT_SPEC.md` §9 |
| 12 | Reader | Comprehensible Input Reader | Reading passage with difficulty rating (% known words) and split context panel | Content ID / text payload | Interactive passage with tokenized words and sentence segments | Content not found error card with library link | `GEMINI_PROJECT_SPEC.md` §17, `CODEX_PROJECT_SPEC.md` §7 |
| 13 | Reader | Word Concept Popover | Tap word to view definition, IPA pronunciation, audio, POS, concept status, quick save | Word tap event | Concept popover (Desktop: right rail; Mobile: bottom sheet) | Fallback to basic dictionary search if unindexed | `GEMINI_PROJECT_SPEC.md` §17 |
| 14 | Reader | Sentence Mining & Translation | Tap sentence to reveal Vietnamese translation, audio playback, and one-tap save | Sentence tap event | Inline translation reveal + save confirmation toast | Network error toast with retry button | `GEMINI_PROJECT_SPEC.md` §17, `CODEX_PROJECT_SPEC.md` §7 |
| 15 | Reader | Exposure Tracking | Background capture of concept encounters during reading | Scroll / read completion | `POST /v1/reader/analyze` / exposure event | Silent retry in background | `GEMINI_PROJECT_SPEC.md` §17 |
| 16 | Language Brain | Brain Summary & Concept List | Master view of learner's vocabulary state (known/learning/weak) and 3 skill signals | Filter params (status, skill, query) | Summary cards (Known: 483, Learning: 71, Weak: 28) + paginated concept list | Empty state with suggested reading/learning CTA | `GEMINI_PROJECT_SPEC.md` §21, `CODEX_PROJECT_SPEC.md` §8 |
| 17 | Language Brain | Concept Detail View | In-depth concept drill-down: recognition %, listening %, production %, memory health, last seen | Concept ID | Modal / page showing senses, examples, collocations, next due date | 404 Not Found error state | `GEMINI_PROJECT_SPEC.md` §18, §21 |
| 18 | Progress | Evidence-Based Analytics | Visualizes retention trends, memory health %, weekly successful learning days (e.g. 5/7) | Date range | Trend charts, concept acquisition stats, skill signal meters | Empty state for new users with onboarding context | `GEMINI_PROJECT_SPEC.md` §21, `CODEX_PROJECT_SPEC.md` §8 |
| 19 | Dictionary | Concept Search & Lookup | Fast lookup for English words, phrases, grammatical forms, and Vietnamese senses | Query string | Search results with canonical form, IPA, audio, and Brain status | Empty search state ("Không tìm thấy từ") | `GEMINI_PROJECT_SPEC.md` §18 |
| 20 | Library | Study Material Collection | Tabbed collection: Saved Content, Mined Sentences, Saved Concepts, History | Tab selection, filters | Grid/list of cards with progress indicators and resume points | Empty state per tab with action buttons | `GEMINI_PROJECT_SPEC.md` §23 |
| 21 | Settings | Learner Preferences | Configure daily minutes, goal, language, audio autoplay, reduced motion, dark mode | Form inputs | `PATCH /v1/me` update confirmation | Inline validation errors | `GEMINI_PROJECT_SPEC.md` §24 |
| 22 | Profile | User Identity & Languages | View account details, active learning languages, starting level estimates, data export | User session | Profile overview card with edit triggers and export action | Unauthenticated redirect to login | `GEMINI_PROJECT_SPEC.md` §24 |
| 23 | System | Global 4-State Primitives | Reusable Loading (Skeleton), Empty, Error (with retry), and Success feedback | State props | Accessible UI components matching final layout dimensions | Error boundary fallback | `GEMINI_PROJECT_SPEC.md` §12, `design-system/MASTER.md` §6 |
| 24 | System | Feature Flag Guardrails | Central gate keeping post-MVP features (AI Tutor, Speak Lab) disabled | Feature flag state | Suppressed navigation items and protected route handlers | 404 / redirect if direct URL visited while disabled | `GEMINI_PROJECT_SPEC.md` §28.1 |

---

## 3. Edge Cases Matrix

| # | Feature | Edge Case Input | Expected / Observed System Behavior |
|---|---------|-----------------|--------------------------------------|
| 1 | Review Queue | 0 items due (`queue.length === 0`) | Render calm EmptyState ("Không có từ nào đến hạn ôn tập hôm nay") with CTA to read new material or explore Brain. |
| 2 | Review Queue | Large backlog (>100 items due) | Display queue progress without anxiety-inducing red alert banners; paginate reviews in focused batches of 10–20. |
| 3 | Review Submission | Offline / network drop during rating submit | Store rating in local queue with idempotency key; show non-blocking toast; auto-retry on reconnect without blocking next card. |
| 4 | Review Interaction | Rapid consecutive key presses / double-tap on rating | Debounce rating submission; disable rating buttons immediately on first click to prevent duplicate submissions. |
| 5 | Today Plan | User completes all 4 activities | Show celebration summary card ("Hôm nay đã hoàn thành xuất sắc!") with Language Brain updates (+X concepts strengthened). |
| 6 | Today Plan | Time budget set to 10 min vs 45 min | Heuristic generates 2 compact activities (10m) vs 5-6 diversified activities (45m) respecting FSRS due priority first. |
| 7 | Reader Passage | High ratio of unknown words (<80% known) | Display warning badge ("Bài đọc có độ khó cao: 72% từ quen thuộc") with recommendation to review prerequisite concepts. |
| 8 | Reader Interaction | Word with multiple lexical senses in context | Popover highlights the primary sense matched in context while providing expandable list of secondary senses. |
| 9 | Reader Interaction | Missing audio asset for sentence | Audio button disabled with tooltip ("Audio chưa khả dụng"); text reading and concept lookup remain fully functional. |
| 10 | Typography | Long Vietnamese diacritic text (e.g., *"khuynh hướng phát triển"*) | Layout maintains `line-height: 1.6` without clipping diacritic tone marks or overlapping adjacent lines. |
| 11 | Starting Estimate | User selects "Skip" / "Not sure" for question | Recorded as valid low-confidence evidence without penalizing latency or forcing guessing. |
| 12 | Starting Estimate | Assessment reaches maximum item budget (e.g. 15 items) | Session automatically concludes and generates estimate with computed confidence level (`low`/`medium`/`high`). |
| 13 | Language Brain | Concept with 0 production evidence | Display Production score as 0% / "Chưa có dữ liệu" with explanation tooltip rather than marking concept as forgotten. |
| 14 | Library | Mined sentence contains deleted/modified concept | Sentence renders verbatim; concept tag links to canonical dictionary lemma. |
| 15 | Accessibility | User activates `prefers-reduced-motion: reduce` | All transitions, card flips, and skeleton pulses collapse to 0ms instant changes or subtle opacity fades. |
| 16 | Navigation | Direct browser URL navigation to `/tutor` or `/speak` | Next.js route returns 404 or redirects to `/today` if central feature flag is false. |

---

## 4. Navigation Architecture & Viewport Adaptations

### 4.1 Navigation Matrix

| Viewport | Primary Navigation | Secondary Navigation | Focus Mode Behavior |
| :--- | :--- | :--- | :--- |
| **Mobile (`< 768px`)** | Fixed Bottom Nav (5 items): Today, Read, Review, Brain, Progress | Top header avatar menu linking to Library, Dictionary, Settings, Profile | Bottom nav and header hidden; top minimal exit bar with progress indicator |
| **Tablet (`768px – 1199px`)** | Collapsible Left Rail (64px) with icons and active indicators | Bottom-pinned secondary icons in rail for Library, Dictionary, Settings | Rail collapsed and hidden; centered focus layout |
| **Desktop (`≥ 1200px`)** | Fixed Left Sidebar (260px) with logo, primary links, and user summary | Dedicated secondary links group in sidebar for Library, Dictionary, Settings, Profile | Sidebar hidden; centered focus container (max 768px) with escape shortcut |

### 4.2 Route Directory & Guardrail Table

| Route | Display Name | Type | Access Rule | Guardrail / Boundary |
| :--- | :--- | :--- | :--- | :--- |
| `/today` | Today (Hôm nay) | Primary | Authenticated | Default landing surface after onboarding |
| `/read` | Read (Đọc bài) | Primary | Authenticated | Comprehensible input reader and library browser |
| `/review` | Review (Ôn tập) | Primary | Authenticated | Smart Review focus mode; accessible in 1 click |
| `/brain` | Brain (Trí nhớ) | Primary | Authenticated | Language Brain concept list, skill signals, and filters |
| `/progress` | Progress (Tiến độ) | Primary | Authenticated | Evidence trends, memory health %, weekly learning days |
| `/library` | Library (Thư viện) | Secondary | Authenticated | Saved articles, mined sentences, vocabulary lists |
| `/dictionary`| Dictionary (Từ điển) | Secondary | Authenticated | Concept lookup, IPA, audio, and lexical senses |
| `/settings` | Settings (Cài đặt) | Secondary | Authenticated | Goals, daily minutes, audio, theme, accessibility |
| `/profile` | Profile (Hồ sơ) | Secondary | Authenticated | Account info, language proficiency estimates |
| `/onboarding`| Onboarding (Bắt đầu) | Special | Unauthenticated / New | Multi-step setup + Starting Level Estimate |
| `/tutor` | AI Tutor | Deferred | **BLOCKED** | Post-MVP. Must not exist in navigation or route map |
| `/speak` | Speak Lab | Deferred | **BLOCKED** | Post-MVP. Must not exist in navigation or route map |

---

## 5. Screen-by-Screen Specification & 4-State UI Matrix

### 5.1 Today (`/today`)
- **Primary Objective**: Answer *"What should I do today, for how long, why, and where do I start?"* within 5 seconds.
- **Key Components**: Header with greeting & time budget badge; Daily Progress bar; Activity Timeline (4 cards: Review, Read, Listen, Learn); Language Brain summary widget.
- **Reason Codes**: `FSRS_DUE`, `WEAK_RECOGNITION`, `WEAK_LISTENING`, `LOW_PRODUCTION_EVIDENCE`, `CONTENT_FIT`, `RECENT_EXPOSURE`, `NEW_CONCEPT_BUDGET`.
- **States Matrix**:
  - *Loading*: 4 skeleton cards matching exact dimensions + progress bar skeleton.
  - *Empty*: Illustrated card: "Chưa có kế hoạch cho hôm nay" + "Tạo kế hoạch học tập" CTA.
  - *Error*: `InlineAlert` with retry button ("Không thể tải kế hoạch học hôm nay. Thử lại").
  - *Success / Completed*: All activities checked + celebration badge + summary of concepts strengthened.

### 5.2 Smart Review (`/review`)
- **Primary Objective**: Distraction-free active recall session powered by FSRS.
- **Workflow**: Prompt (Question/Audio/Cloze) → Think → Reveal Answer → Rating (`Again`, `Hard`, `Good`, `Easy`) → Immediate transition.
- **Exercise Modes**: `self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`.
- **Keyboard Shortcuts (Desktop)**: `Space` (Reveal), `1` (Again), `2` (Hard), `3` (Good), `4` (Easy), `R` (Replay Audio).
- **States Matrix**:
  - *Loading*: Centered flashcard skeleton with subtle pulse.
  - *Empty*: Calm empty state: "Tuyệt vời! Không có từ nào đến hạn ôn tập" + "Đọc bài mới" button.
  - *Error*: Card-level alert with retry button without losing the current card queue.
  - *Success*: Session summary screen showing reviewed count, retention rate %, and next due schedule.

### 5.3 Reader & Immersion (`/read`)
- **Primary Objective**: Comprehensible input reading with frictionless word lookup and sentence mining.
- **Layout**: Desktop split view (Left: Reading passage max 720px; Right: Concept / Sentence context panel). Mobile: Full-width text with slide-up bottom sheet for concept details.
- **Interactions**: Tap word → Popover with meaning, IPA, audio, POS, and save button. Tap sentence → Reveal translation, play sentence audio, one-tap sentence mining.
- **States Matrix**:
  - *Loading*: Text passage skeleton with paragraph placeholders.
  - *Empty*: Library recommendation list with "Chọn bài đọc phù hợp" prompt.
  - *Error*: Error banner with "Tải lại bài đọc" CTA.
  - *Success*: End-of-article recap showing concepts exposed and sentences saved.

### 5.4 Language Brain (`/brain`)
- **Primary Objective**: Make the learner's cognitive state visible, concrete, and explainable.
- **Key Metrics**:
  - Concept Status Counts: Known / Mastered (e.g. 483), Learning (71), Weak (28).
  - Memory Health % (e.g. 87%).
  - 3 Skill Signals: Recognition %, Listening %, Production %.
- **Concept List & Filters**: Search by term, filter by status (`mastered`, `learning`, `weak`, `due`), sort by last seen or memory health.
- **States Matrix**:
  - *Loading*: Metrics cards skeleton + 5-row table/list skeleton.
  - *Empty*: Filter empty state: "Không có từ vựng nào khớp với bộ lọc" + "Xóa bộ lọc" button.
  - *Error*: Full-page error state with retry.
  - *Success*: Interactive list with drawer/modal drill-down for concept details.

### 5.5 Progress & Analytics (`/progress`)
- **Primary Objective**: Provide retention and learning evidence trends without vanity gamification.
- **Key Metrics**: Weekly successful learning days (e.g. 5/7 days), concepts exposed (+43), concepts strengthened (+18), retention curve, Starting Level Estimate with confidence badge.
- **States Matrix**:
  - *Loading*: Chart and metric card skeletons.
  - *Empty*: Welcome state explaining that progress metrics will populate after the first 3 days of learning.
  - *Error*: Metric section alert with refresh action.
  - *Success*: Rendered accessible charts with alternative text descriptions.

### 5.6 Starting Level Estimate & Onboarding (`/onboarding`)
- **Primary Objective**: Multi-step onboarding to initialize user profile and establish starting baseline.
- **Flow**: Welcome → Native Language (VI) → Target (EN) → Goal Selection → Daily Time Budget (10/20/30/45m) → Self-Estimate → Adaptive Test → Result with Confidence (`low`/`medium`/`high`) → Generate First Today Plan.
- **Wording Invariant**: Uses *"Ước lượng khởi điểm"* and *"Độ tin cậy"*; never claims official CEFR certification.

### 5.7 Dictionary & Concept Detail (`/dictionary`)
- **Primary Objective**: Comprehensive lexical lookup with Language Brain status integration.
- **Content**: Canonical lemma, IPA phonetic transcription, native audio playback, part of speech, sense definitions in Vietnamese, difficulty-graded example sentences, collocations, and current Brain status.

### 5.8 Library (`/library`)
- **Primary Objective**: Central repository for saved materials.
- **Tabs**: 1. Saved Articles; 2. Mined Sentences; 3. Saved Concepts; 4. Reading History.
- **States Matrix**: Dedicated empty state for each tab with direct navigation CTAs.

### 5.9 Settings & Profile (`/settings`, `/profile`)
- **Primary Objective**: Manage learning parameters, audio preferences, accessibility, and account privacy.
- **Settings Groups**: Learning goals & time budget, UI locale, audio autoplay/speed, accessibility (reduced motion, font size), notification reminders, data export (JSON), account deletion.

---

## 6. API Endpoints & Contract Mapping

All endpoints conform to OpenAPI 3.1/3.2 specifications.

| # | HTTP Method | Endpoint Path | Request Headers / Body | Response Payload (200/201) | Handled Error Codes |
|---|-------------|---------------|------------------------|----------------------------|---------------------|
| 1 | `GET` | `/api/v1/me` | `Authorization: Bearer <token>` | `UserProfileResponse` | `UNAUTHENTICATED`, `INTERNAL_ERROR` |
| 2 | `PATCH` | `/api/v1/me` | `UpdateUserProfileRequest` | `UserProfileResponse` | `UNAUTHENTICATED`, `VALIDATION_ERROR` |
| 3 | `GET` | `/api/v1/me/languages` | `Authorization: Bearer <token>` | `UserLanguageProfile[]` | `UNAUTHENTICATED` |
| 4 | `POST` | `/api/v1/me/languages` | `CreateLanguageProfileRequest` | `UserLanguageProfile` | `VALIDATION_ERROR`, `CONFLICT` |
| 5 | `PATCH` | `/api/v1/me/languages/{id}`| `UpdateLanguageProfileRequest` | `UserLanguageProfile` | `NOT_FOUND`, `VALIDATION_ERROR` |
| 6 | `GET` | `/api/v1/today` | Optional query `date=YYYY-MM-DD` | `TodayPlanResponse` | `UNAUTHENTICATED`, `INTERNAL_ERROR` |
| 7 | `POST` | `/api/v1/today/{planId}/activities/{id}/complete` | Header: `Idempotency-Key` | `ActivityCompletionResponse`| `NOT_FOUND`, `CONFLICT` |
| 8 | `GET` | `/api/v1/review/queue` | Query `limit=20`, `mode=all` | `ReviewQueueResponse` | `UNAUTHENTICATED` |
| 9 | `POST` | `/api/v1/review/{itemId}/answer` | Header: `Idempotency-Key`, Body: `ReviewAnswerRequest` | `ReviewAnswerResponse` | `NOT_FOUND`, `VALIDATION_ERROR` |
| 10| `GET` | `/api/v1/concepts/{id}` | Path param `id: uuid` | `ConceptDetailResponse` | `NOT_FOUND` |
| 11| `GET` | `/api/v1/dictionary/search` | Query `q=string`, `lang=en`, `limit=10` | `ConceptSearchResult[]` | `VALIDATION_ERROR` |
| 12| `POST` | `/api/v1/reader/analyze` | Body: `AnalyzeTextRequest` | `AnalyzeTextResponse` | `VALIDATION_ERROR` |
| 13| `POST` | `/api/v1/reader/save-sentence` | Header: `Idempotency-Key`, Body: `SaveSentenceRequest` | `SavedSentenceResponse`| `VALIDATION_ERROR`, `CONFLICT` |
| 14| `GET` | `/api/v1/content/recommended`| Query `limit=10`, `level=A2` | `ContentItemSummary[]` | `UNAUTHENTICATED` |
| 15| `GET` | `/api/v1/content/{id}` | Path param `id: uuid` | `ContentItemDetailResponse`| `NOT_FOUND` |
| 16| `POST` | `/api/v1/assessments` | Body: `StartAssessmentRequest` | `AssessmentSessionResponse`| `VALIDATION_ERROR` |
| 17| `POST` | `/api/v1/assessments/{id}/responses` | Header: `Idempotency-Key`, Body: `AssessmentResponseRequest` | `AssessmentNextStepResponse` | `NOT_FOUND`, `VALIDATION_ERROR` |
| 18| `GET` | `/api/v1/progress/overview`| Query `window=7d\|30d` | `ProgressOverviewResponse` | `UNAUTHENTICATED` |
| 19| `GET` | `/api/v1/brain/summary` | Query `lang=en` | `BrainSummaryResponse` | `UNAUTHENTICATED` |
| 20| `GET` | `/api/v1/brain/concepts` | Query `status`, `skill`, `q`, `page`, `limit` | `PaginatedConceptStatesResponse` | `VALIDATION_ERROR` |

---

## 7. Data Models, Schemas & TypeScript Definitions

```typescript
// ==========================================
// 1. Shared Enums & Identifiers
// ==========================================

export type UUID = string;
export type ISODateString = string;

export type ConceptStatus = 
  | 'unseen' 
  | 'discovered' 
  | 'learning' 
  | 'familiar' 
  | 'active' 
  | 'mastered' 
  | 'weak' 
  | 'forgotten' 
  | 'due'; // UI pseudo-status

export type LearningActivityType = 'review' | 'read' | 'listen' | 'learn';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export type ExerciseMode = 'self_recall' | 'multiple_choice' | 'typing' | 'cloze' | 'listening';

export type ReasonCode = 
  | 'FSRS_DUE'
  | 'WEAK_RECOGNITION'
  | 'WEAK_LISTENING'
  | 'LOW_PRODUCTION_EVIDENCE'
  | 'CONTENT_FIT'
  | 'RECENT_EXPOSURE'
  | 'NEW_CONCEPT_BUDGET';

export type ContentQualityStatus = 'raw' | 'normalized' | 'review_pending' | 'approved' | 'rejected';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type ErrorCode = 
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'LEARNING_PLAN_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED';

// ==========================================
// 2. User & Language Profiles
// ==========================================

export interface UserProfile {
  id: UUID;
  email: string;
  displayName: string;
  nativeLanguage: string; // 'vi'
  uiLocale: string;       // 'vi'
  createdAt: ISODateString;
  settings: UserSettings;
}

export interface UserSettings {
  dailyMinutes: number; // 10 | 20 | 30 | 45
  reducedMotion: boolean;
  audioAutoplay: boolean;
  playbackSpeed: number; // 0.75 | 1.0 | 1.25
  reminderEnabled: boolean;
}

export interface UserLanguageProfile {
  id: UUID;
  userId: UUID;
  languageCode: string; // 'en'
  goal: 'communication' | 'work' | 'travel' | 'basics';
  dailyMinutes: number;
  currentLevelEstimate?: string; // 'A0' | 'A1' | 'A2' | 'B1'
  levelConfidence?: ConfidenceLevel;
  targetLevel?: string;
  status: 'active' | 'paused';
}

// ==========================================
// 3. Today Plan & Activities
// ==========================================

export interface TodayPlan {
  id: UUID;
  userId: UUID;
  date: string; // 'YYYY-MM-DD'
  targetMinutes: number;
  completedMinutes: number;
  totalActivities: number;
  completedActivities: number;
  engineVersion: string;
  activities: TodayActivity[];
  memoryHealthScore: number; // 0..100
}

export interface TodayActivity {
  id: UUID;
  planId: UUID;
  orderIndex: number;
  activityType: LearningActivityType;
  title: string;
  description: string;
  durationMinutes: number;
  reasonCode: ReasonCode;
  reasonText: string;
  status: 'pending' | 'in_progress' | 'completed';
  targetCount?: number;
  contentId?: UUID;
}

// ==========================================
// 4. Memory & Review Engine (FSRS)
// ==========================================

export interface ReviewItem {
  id: UUID;
  userId: UUID;
  conceptId: UUID;
  term: string;
  lemma: string;
  pos: string;
  ipa?: string;
  audioUrl?: string;
  exerciseMode: ExerciseMode;
  prompt: string;
  sentenceContext?: string;
  translationVi?: string;
  options?: string[]; // for multiple choice
  clozeSentence?: string;
  fsrsState: FSRSState;
}

export interface FSRSState {
  reviewItemId: UUID;
  difficulty: number;
  stability: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  dueAt: ISODateString;
  lastReviewAt?: ISODateString;
  reps: number;
  lapses: number;
}

export interface ReviewAnswerRequest {
  rating: ReviewRating;
  exerciseMode: ExerciseMode;
  responseTimeMs: number;
  correct: boolean;
  evidenceJson?: Record<string, unknown>;
}

export interface ReviewAnswerResponse {
  success: boolean;
  updatedFSRSState: FSRSState;
  nextItem?: ReviewItem;
  conceptStatus: ConceptStatus;
  memoryHealth: number;
}

// ==========================================
// 5. Reader & Content Engine
// ==========================================

export interface ContentItem {
  id: UUID;
  type: 'story' | 'article' | 'dialogue';
  title: string;
  difficultyLevel: string; // 'A1' | 'A2' | 'B1'
  knownRatio: number;      // e.g. 0.95 (95%)
  durationMinutes: number;
  qualityStatus: ContentQualityStatus;
  sourceAttribution?: string;
  segments: ContentSegment[];
}

export interface ContentSegment {
  id: UUID;
  orderIndex: number;
  text: string;
  audioUrl?: string;
  sentences: Sentence[];
}

export interface Sentence {
  id: UUID;
  text: string;
  normalizedText: string;
  translationVi: string;
  audioStartMs?: number;
  audioEndMs?: number;
  concepts: SentenceConcept[];
}

export interface SentenceConcept {
  conceptId: UUID;
  term: string;
  startOffset: number;
  endOffset: number;
  status: ConceptStatus;
}

export interface SaveSentenceRequest {
  sentenceId: UUID;
  contentId?: UUID;
  targetConceptIds: UUID[];
  userNotes?: string;
}

// ==========================================
// 6. Lexical & Language Brain
// ==========================================

export interface ConceptDetail {
  id: UUID;
  languageCode: string;
  canonicalForm: string;
  pos: string;
  ipa?: string;
  audioUrl?: string;
  senses: WordSense[];
  examples: ConceptExample[];
  relations: ConceptRelation[];
  brainState?: UserConceptState;
}

export interface WordSense {
  id: UUID;
  definitionEn: string;
  translationVi: string;
  cefrLevel: string;
}

export interface ConceptExample {
  id: UUID;
  sentenceEn: string;
  translationVi: string;
  audioUrl?: string;
}

export interface ConceptRelation {
  relationType: 'synonym' | 'antonym' | 'collocation' | 'family';
  targetConceptId: UUID;
  targetTerm: string;
}

export interface UserConceptState {
  conceptId: UUID;
  status: ConceptStatus;
  masteryScore: number;     // 0..1
  confidence: number;       // 0..1
  recognitionScore: number; // 0..1
  listeningScore: number;   // 0..1
  productionScore: number;  // 0..1
  exposureCount: number;
  lastSeenAt?: ISODateString;
  nextDueAt?: ISODateString;
}

export interface BrainSummary {
  totalConcepts: number;
  knownCount: number;
  learningCount: number;
  weakCount: number;
  memoryHealth: number; // 0..100
  signals: {
    recognitionAvg: number; // 0..100
    listeningAvg: number;   // 0..100
    productionAvg: number;  // 0..100
  };
  recentExposures: Array<{
    conceptId: UUID;
    term: string;
    status: ConceptStatus;
    lastSeenAt: ISODateString;
  }>;
}

// ==========================================
// 7. Progress & Analytics
// ==========================================

export interface ProgressOverview {
  currentLevelEstimate: string; // 'A2'
  levelConfidence: ConfidenceLevel;
  memoryHealth: number;         // 87%
  successfulDaysThisWeek: number; // e.g. 5
  conceptsExposedThisWeek: number; // +43
  conceptsStrengthenedThisWeek: number; // +18
  retentionTrend: Array<{
    date: string;
    retentionRate: number;
    reviewedCount: number;
  }>;
  skillSignals: {
    recognition: number;
    listening: number;
    production: number;
  };
}

// ==========================================
// 8. Assessment Engine
// ==========================================

export interface AssessmentSession {
  id: UUID;
  templateId: UUID;
  status: 'in_progress' | 'completed';
  currentItemIndex: number;
  totalEstimatedItems: number;
  currentItem?: AssessmentItem;
}

export interface AssessmentItem {
  id: UUID;
  skillTarget: 'vocabulary' | 'reading' | 'listening';
  prompt: string;
  audioUrl?: string;
  options: Array<{ id: string; text: string }>;
  allowSkip: boolean;
}

export interface AssessmentResult {
  estimateLevel: string; // 'A2'
  confidence: ConfidenceLevel;
  evidenceCount: number;
  assessedSkills: Array<{ skill: string; score: number }>;
  recommendedStartingAction: string;
  methodVersion: string;
}

// ==========================================
// 9. Generic Envelopes & Errors
// ==========================================

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: ISODateString;
  };
}

export interface ApiErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}
```

---

## 8. Shared Enums & Semantic Error Mapping

### 8.1 Concept Status & UI Representation Matrix

| Enum Value | Label (VI) | Color Role | Icon Name | Border / Fill Treatment |
| :--- | :--- | :--- | :--- | :--- |
| `unseen` | Chưa gặp | Slate subtle | `EyeOff` | Dashed border, transparent |
| `discovered` | Mới phát hiện | Slate / Indigo subtle | `Sparkles` | Thin solid border, subtle background |
| `learning` | Đang học | Sky (`sky-600`) | `BookOpen` | Solid pill, soft sky fill |
| `familiar` | Quen thuộc | Sky / Emerald | `Check` | Solid pill, medium sky-emerald fill |
| `active` | Đang luyện | Primary (`primary-600`)| `Zap` | Indigo accent border + soft fill |
| `mastered` | Đã nắm vững | Emerald (`emerald-600`)| `Award` / `CheckCircle` | Solid emerald badge + bold text |
| `weak` | Cần củng cố | Amber (`amber-600`) | `AlertTriangle` | Amber warning badge + icon |
| `forgotten` | Đã quên | Rose (`rose-600`) | `RotateCcw` | Rose danger badge + icon |
| `due` *(UI status)*| Đến hạn ôn | Primary / Amber | `Clock` | Priority indicator + badge count |

### 8.2 Error Code Mapping & UI Recovery Strategy

| Error Code | HTTP Status | Vietnamese User Message | UI Component & Action |
| :--- | :--- | :--- | :--- |
| `UNAUTHENTICATED` | 401 | *"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."* | Redirect to auth route preserving `returnUrl` |
| `FORBIDDEN` | 403 | *"Bạn không có quyền thực hiện thao tác này."* | Inline toast / error modal |
| `NOT_FOUND` | 404 | *"Không tìm thấy nội dung hoặc bài tập yêu cầu."* | `ErrorState` with "Quay lại trang chủ" CTA |
| `VALIDATION_ERROR` | 422 | *"Dữ liệu nhập vào chưa hợp lệ. Vui lòng kiểm tra lại."* | Inline form field error highlights |
| `CONFLICT` | 409 | *"Dữ liệu đã được cập nhật ở nơi khác. Đang tải lại..."* | Automatic cache invalidation & re-fetch |
| `INTERNAL_ERROR` | 500 | *"Hệ thống gặp sự cố tạm thời. Vui lòng thử lại sau."* | `ErrorState` with actionable "Thử lại" button |
| `LEARNING_PLAN_NOT_FOUND`| 404 | *"Chưa tìm thấy kế hoạch học hôm nay."* | Trigger plan regeneration workflow |
| `NETWORK_ERROR` | 0 / offline | *"Không có kết nối mạng. Đang dùng dữ liệu đã lưu."* | Non-intrusive offline banner + queue actions |
| `RATE_LIMITED` | 429 | *"Bạn thao tác quá nhanh. Vui lòng chờ vài giây."* | Action button cooldown timer countdown |

---

## 9. Frontend Business Rules, State Invariants & Ergonomics

1. **Single Memory Lineage Invariant (ADR-003)**:
   - Regardless of whether the user reviews via typing, self-recall, cloze, or listening, the rating updates **one** primary FSRS scheduler lineage per concept.
   - The UI must never display 3 disparate review due dates (e.g. "due for reading", "due for listening") for the same concept.
2. **Explainable Adaptation Rule**:
   - Every activity recommendation on Today must have an explicit reason shown to the user (e.g. *"Ôn vì sắp quên"*, *"Luyện nghe vì đang yếu"*).
3. **No Casino Gamification Invariant**:
   - The frontend must never introduce spinning reward wheels, gem currencies, coin stores, or aggressive streak loss intimidation banners.
   - Progress is communicated through concept mastery, memory health %, and weekly learning consistency.
4. **Starting Level Estimate Framing (ADR-009)**:
   - Always render as *"Ước lượng khởi điểm"* with a confidence indicator (`low`, `medium`, `high`). Never show as an accredited CEFR certificate.
5. **Non-Color Dependent Visual Communication**:
   - A colored dot alone is strictly prohibited. Every status indicator must pair color with an icon and human-readable label.
6. **Focus Mode State Preservation**:
   - In Review and Assessment sessions, accidental back navigation triggers a lightweight confirmation dialog to prevent accidental data loss.
7. **Idempotent Critical Writes**:
   - All review submissions, activity completions, and sentence saves must send a client-generated UUID `Idempotency-Key` header.

---

## 10. Design System Tokens & Accessibility Standards

### 10.1 3-Tier Token System (DTCG 2025.10)
- **Tier 1 (Primitives)**: Slate (`50..950`), Indigo (`50..700`), Emerald (`50..700`), Amber (`50..700`), Rose (`50..700`), Sky (`50..600`).
- **Tier 2 (Semantics)**: `--color-canvas`, `--color-surface`, `--color-surface-subtle`, `--color-text-primary`, `--color-text-secondary`, `--color-action-primary`, `--color-status-success`, `--color-status-warning`, `--color-status-danger`, `--color-focus-ring`.
- **Tier 3 (Components)**: Scoped tokens in `packages/ui` (`Button`, `Card`, `Badge`, `ConceptChip`, `Progress`, `States`).

### 10.2 Typography Scale & Vietnamese Diacritic Support
- Generous line-heights (`1.6` for body and learning sentences) to accommodate Vietnamese tone markers (` dấu sắc, huyền, hỏi, ngã, nặng`).
- Styles: `type-display` (36px/30px), `type-h1` (28px/24px), `type-h2` (22px/20px), `type-body` (16px/15px), `type-learning` (20px/18px), `type-label` (13px/12px), `type-data` (14px/13px).

### 10.3 Accessibility (WCAG 2.2 AA)
- Contrast ratio ≥ 4.5:1 for normal body text and ≥ 3:1 for UI controls and large headings.
- Touch target minimum: 44px × 44px (primary interactive buttons use 48px).
- Visible focus rings (`--color-focus-ring`) on all interactive elements via keyboard navigation.
- Dialog and modal focus trapping with `Escape` to close and return focus to trigger.
- Full support for `prefers-reduced-motion: reduce`.

---

## 11. Verification Strategy & QA Gates

To ensure total compliance, the frontend implementation must pass all 4 verification gates:

1. **Type Check**: `pnpm --filter @lingua/web typecheck` and `pnpm --filter @lingua/ui typecheck` with 0 errors.
2. **Lint**: `pnpm --filter @lingua/web lint` and `pnpm --filter @lingua/ui lint` with 0 warnings.
3. **Unit & Component Tests**: `pnpm test` (Vitest testing UI components, token resolution, and state machines).
4. **Storybook Catalog & A11y Suite**: `pnpm --filter @lingua/ui build-storybook` with automated axe accessibility checks.

---
*Report compiled by Specification & Contract Miner. Ready for orchestrator and frontend worker execution.*
