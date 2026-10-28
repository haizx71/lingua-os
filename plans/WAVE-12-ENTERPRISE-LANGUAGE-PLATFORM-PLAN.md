# LINGUA OS — Wave 12 Enterprise Language Platform Plan (Continuous QA Loop Iteration #9 / Cycle 4 of 5)

## 1. Objective
Execute **Cycle 4 of 5 (`Wave 12`)** in the Continuous QA & 10-Point Enterprise Language Platform Upgrade Loop:
1. Verify Wave 11 with `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`) and audit the next 10 highest-leverage pedagogical & UX improvements.
2. Dispatch 5 micro-scoped `Model: 'flash'` worker subagents (`W12-1` .. `W12-5`) with strict non-overlapping file ownership boundaries.
3. Re-verify all tests, typechecks, and lint rules via `qa-web-auditor`.

---

## 2. The 10 Enterprise Upgrades (Wave 12)

### Group W12-1 — Interactive Reader Sentence Count Pill & Beginner Lexicon Semantic Contrast (`InteractiveReader.tsx`, `beginnerLexicon.ts`)
1. **Passage Sentence Count & Progress Pill (`data-testid="reader-sentence-count-pill"`)**:
   - In `InteractiveReader.tsx`, display a live sentence count pill (`📄 ${passage.sentences.length} câu trong bài`) inside the Reader header so learners can gauge passage length at a glance.
2. **Semantic Contrast / Antonym & Nuance Note (`data-testid="inspector-semantic-contrast"`)**:
   - In `beginnerLexicon.ts`, export `getSemanticContrastTip(term: string): string | null` returning an antonym or semantic nuance contrast (e.g., `morning` ↔ `Trái nghĩa: evening (buổi tối) / night (ban đêm)`, `hot` ↔ `Trái nghĩa: cold (lạnh) / cool (mát)`, `early` ↔ `Trái nghĩa: late (muộn)`, or a general contrast recall tip).
   - Render `data-testid="inspector-semantic-contrast"` inside the Word Inspector dialog (`selectedToken`).

### Group W12-2 — Smart Review Mode Guidance Banner & Language Brain Mastery Percentage Badge (`ReviewSession.tsx`, `LanguageBrainCanvas.tsx`)
3. **Exercise Mode Pedagogical Guidance Banner (`data-testid="review-mode-guidance"`)**:
   - In `ReviewSession.tsx`, display a dynamic pedagogical tip (`data-testid="review-mode-guidance"`) explaining how to succeed in the currently selected `exerciseMode` (`flashcard` → `Nhẩm nghĩa và đọc to câu trước khi lật thẻ`, `cloze` → `Đọc cả câu ngữ cảnh để đoán từ còn thiếu`, `typing` → `Gõ chính xác từng chữ cái để rèn trí nhớ cơ tay`).
4. **Mastered Concept Percentage Badge (`data-testid="brain-mastery-percent-badge"`)**:
   - In `LanguageBrainCanvas.tsx`, compute the percentage of mastered nodes (`const masteredPercent = nodes.length > 0 ? Math.round((nodes.filter((n) => n.status === 'mastered').length / nodes.length) * 100) : 0;`) and render `data-testid="brain-mastery-percent-badge"` (`🏆 Tỷ lệ làm chủ mạng lưới: ${masteredPercent}%`).

### Group W12-3 — Dictionary Practice in Reader Link & Library Due-Only Filter Toggle (`DictionaryView.tsx`, `LibraryView.tsx`)
5. **Quick Jump to Contextual Reader Practice (`data-testid="dictionary-practice-reader-link"`)**:
   - In `DictionaryView.tsx`, inside the Dictionary header, render a quick navigation button (`📖 Luyện đọc ngữ cảnh`) that navigates to `/read` via `clientNavigate('/read')`.
6. **Library Due-for-Review Quick Filter Toggle (`data-testid="library-due-only-toggle"`)**:
   - In `LibraryView.tsx`, add state `dueOnly` (`false` by default, reset on `library-reset-filters` and included in `hasActiveFilters`) and a button (`data-testid="library-due-only-toggle"`) that filters concept items where `item.isDueForReview` (or `item.status !== 'mastered'`).

### Group W12-4 — Today Completed Activity Ratio Pill & Progress Solidified Ratio Bar (`TodayDashboard.tsx`, `ProgressAnalytics.tsx`)
7. **Completed Activities Ratio Pill (`data-testid="today-activity-ratio-pill"`)**:
   - In `TodayDashboard.tsx`, inside `<aside>`, render `data-testid="today-activity-ratio-pill"` (`✅ Hoàn tất ${effectivePlan.completedActivitiesCount}/${effectivePlan.totalActivitiesCount} nhiệm vụ`).
8. **Words Solidified vs Target Ratio Badge (`data-testid="progress-solidified-ratio"`)**:
   - In `ProgressAnalytics.tsx`, inside `<section data-testid="progress-cefr-milestone">`, render `data-testid="progress-solidified-ratio"` (`📚 Tích lũy bền vững: ${data.wordsSolidified} từ vững`).

### Group W12-5 — Profile Open Language Brain Link, Onboarding Question Category Tag & Wave 12 Test Suite (`ProfileView.tsx`, `OnboardingDiagnostic.tsx`, `tests/frontend/wave12-enterprise-upgrades.test.tsx`)
9. **Quick Jump to Language Brain from Profile (`data-testid="profile-open-brain-link"`)**:
   - In `ProfileView.tsx`, inside the `"Tổng quan bộ nhớ"` card, render a button (`data-testid="profile-open-brain-link"`) that navigates to `/brain` (`🧠 Mở bản đồ Language Brain`).
10. **Onboarding Question Skill Category Tag (`data-testid="onboarding-question-category-tag"`)**:
   - In `OnboardingDiagnostic.tsx`, inside the active question card (`!isCompleted && currentQuestion`), render `data-testid="onboarding-question-category-tag"` (`🎯 Kỹ năng: Đọc hiểu & Ngữ cảnh CEFR ${currentQuestion.cefrBand}`).
   - Create `tests/frontend/wave12-enterprise-upgrades.test.tsx` testing all 10 Wave 12 upgrades.
