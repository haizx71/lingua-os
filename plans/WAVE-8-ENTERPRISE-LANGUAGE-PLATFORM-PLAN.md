# WAVE 8: Enterprise Language Platform Upgrade Plan (Continuous QA Loop — Iteration 6)

**Status:** In Progress  
**Date:** 2026-10-28  
**QA Auditor Subagent:** `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`)  
**Worker Subagents:** 5 micro-scoped `Model: 'flash'` workers (`W8-1` .. `W8-5`)

---

## 1. 10-Point Enterprise Language Platform Audit Findings (Wave 8)

1. **Reader Focus/Zen Mode Toggle (`InteractiveReader.tsx`)**:
   - `data-testid="reader-focus-mode-toggle"` (`aria-label="Bật/tắt chế độ đọc tập trung (Zen Mode)"`) toggling `data-reader-zen="true|false"` in React state (zero `localStorage` writes on passive mount).
2. **Idiomatic Expressions & Phrasal Verbs Map (`beginnerLexicon.ts`)**:
   - `PHRASAL_VERBS_MAP` in `beginnerLexicon.ts` enabling `lookupBeginnerWord(raw)` to resolve multi-word phrasal verbs and idioms (`wake up`, `look forward to`, `take off`, `give up`, `get up`, `put on`, `turn on`, `come in`, `a lot of`, `sit down`, `find out`).
3. **Session Streak & Real-Time Accuracy HUD Badge (`ReviewSession.tsx`)**:
   - `data-testid="review-session-accuracy-badge"` (`aria-label="Độ chính xác và chuỗi trả lời đúng trong buổi học"`) displaying real-time session accuracy and consecutive correct streak in the Review header.
4. **Mastery Health Summary Filter (`LanguageBrainCanvas.tsx`)**:
   - `data-testid="brain-mastery-summary-filter"` (`aria-label="Lọc nhanh khái niệm theo sức khỏe ghi nhớ"`) exposing status counts alongside the cognitive graph filter pills.
5. **Contextual Example Sentence Audio Pronunciation (`DictionaryView.tsx`)**:
   - `data-testid="dictionary-example-audio"` (`aria-label="Phát âm câu ví dụ"`) next to dictionary example sentences so learners can hear words spoken inside full English sentences.
6. **Library Quick Filter Reset Button (`LibraryView.tsx`)**:
   - `data-testid="library-reset-filters"` (`aria-label="Đặt lại bộ lọc thư viện"`) when a search query or non-default tab/sort is active.
7. **Estimated Remaining Study Time Counter (`TodayDashboard.tsx`)**:
   - `data-testid="today-remaining-time-indicator"` (`aria-label="Thời gian học ước tính còn lại hôm nay"`) inside the Today goal card showing remaining minutes to complete the daily target.
8. **Memory Retention Health Status Badge (`ProgressAnalytics.tsx`)**:
   - `data-testid="progress-retention-status-badge"` (`aria-label="Đánh giá sức khỏe trí nhớ FSRS"`) translating retention percentage into actionable guidance (`💚 Trí nhớ rất tốt` / `💛 Cần củng cố thêm`).
9. **Learner Identity Summary 1-Click Clipboard Share (`ProfileView.tsx`)**:
   - `data-testid="profile-copy-summary"` (`aria-label="Sao chép tóm tắt hồ sơ học tập"`) allowing 1-click copy of the learner's CEFR level, mastered concepts, and streak summary.
10. **Visual Question Progress Percentage Indicator (`OnboardingDiagnostic.tsx`)**:
    - `data-testid="diagnostic-percentage-indicator"` (`aria-label="Tỷ lệ hoàn thành bài chẩn đoán"`) displaying numeric completion percentage (`33%`, `67%`, `100%`) in the diagnostic questionnaire header.

---

## 2. Subagent Task Partitioning (Strict Non-Overlapping Ownership)

| Subagent | Owned Files | Scope |
|---|---|---|
| **W8-1** (`flash`) | `apps/web/src/features/read/InteractiveReader.tsx`, `apps/web/src/features/read/beginnerLexicon.ts` | Items #1 & #2 (Reader Zen Mode & Phrasal Verbs Lexicon) |
| **W8-2** (`flash`) | `apps/web/src/features/review/ReviewSession.tsx`, `apps/web/src/features/brain/LanguageBrainCanvas.tsx` | Items #3 & #4 (Review Session Accuracy HUD & Brain Mastery Summary Filter) |
| **W8-3** (`flash`) | `apps/web/src/features/dictionary/DictionaryView.tsx`, `apps/web/src/features/library/LibraryView.tsx` | Items #5 & #6 (Dictionary Example Sentence Audio & Library Filter Reset) |
| **W8-4** (`flash`) | `apps/web/src/features/today/TodayDashboard.tsx`, `apps/web/src/features/progress/ProgressAnalytics.tsx` | Items #7 & #8 (Today Remaining Time Indicator & Progress Retention Health Badge) |
| **W8-5** (`flash`) | `apps/web/src/features/profile/ProfileView.tsx`, `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx`, `tests/frontend/wave8-enterprise-upgrades.test.tsx` | Items #9, #10 & Wave 8 Automated Test Suite |
